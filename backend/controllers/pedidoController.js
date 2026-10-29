const pool = require('../config/db');
const { ErrorNegocio, registrarVenta, leerPago } = require('../services/ventaService');
const { DESCUENTO_SIN_SOPA } = require('./menuController');

const ESTADOS_ACTIVOS = ['pendiente', 'en_preparacion', 'listo'];
const TODOS_LOS_ESTADOS = ['pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado'];

// Desde qué estados se puede pasar a cada uno por la ruta de estado.
// "entregado" solo se alcanza confirmando en caja.
// "listo" significa que el mesero ya entregó el pedido en la mesa y está por cobrar.
const TRANSICIONES = {
  pendiente: ['en_preparacion', 'listo', 'cancelado'],
  en_preparacion: ['listo', 'cancelado'],
  listo: ['en_preparacion', 'cancelado'],
};

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const manejarError = async (error, res, client, mensaje) => {
  if (client) await client.query('ROLLBACK').catch(() => {});
  if (error instanceof ErrorNegocio) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: mensaje });
};

// Valida y normaliza la lista de productos que manda el mesero.
const leerItems = (items) => {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    throw new ErrorNegocio(400, 'El pedido debe tener entre 1 y 50 productos');
  }

  return items.map((item) => {
    const productoId = Number(item.producto_id);
    const cantidad = Number(item.cantidad ?? 1);

    if (
      !Number.isInteger(productoId) || productoId <= 0 ||
      !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100
    ) {
      throw new ErrorNegocio(400, 'Producto o cantidad no válidos en el pedido');
    }

    const sopaId = item.sopa_id ? Number(item.sopa_id) : null;
    if (sopaId !== null && (!Number.isInteger(sopaId) || sopaId <= 0)) {
      throw new ErrorNegocio(400, 'Sopa no válida en el pedido');
    }

    const principioId = item.principio_id ? Number(item.principio_id) : null;
    if (principioId !== null && (!Number.isInteger(principioId) || principioId <= 0)) {
      throw new ErrorNegocio(400, 'Principio no válido en el pedido');
    }

    const nota = item.nota ? String(item.nota).trim().slice(0, 255) : null;
    return {
      productoId,
      cantidad,
      nota,
      sopaId,
      principioId,
      sinSopa: item.sin_sopa === true,
      sinPrincipio: item.sin_principio === true,
    };
  });
};

// Revisa contra la base que los productos existan, estén activos hoy y cumplan las reglas del ejecutivo.
// Corrige en la propia línea lo que no aplica (por ejemplo, la sopa de un producto que no es ejecutivo).
const validarLineas = async (client, userId, lineas) => {
  // Todo ejecutivo incluye sopa: la regla sale del tipo del producto
  const ids = [...new Set(lineas.map((l) => l.productoId))];
  const productos = await client.query(
    `SELECT id, nombre, disponible_hoy, (tipo = 'ejecutivo') AS incluye_sopa
     FROM productos WHERE id = ANY($1::int[]) AND user_id = $2`,
    [ids, userId]
  );
  if (productos.rows.length !== ids.length) {
    throw new ErrorNegocio(404, 'Alguno de los productos no existe');
  }
  const porId = new Map(productos.rows.map((p) => [p.id, p]));

  // Sopas escogidas: deben ser sopas del restaurante y estar disponibles hoy
  const sopaIds = [...new Set(lineas.map((l) => l.sopaId).filter(Boolean))];
  let sopasValidas = new Set();
  if (sopaIds.length > 0) {
    const sopas = await client.query(
      `SELECT id FROM productos
       WHERE id = ANY($1::int[]) AND user_id = $2 AND tipo = 'sopa' AND disponible_hoy`,
      [sopaIds, userId]
    );
    sopasValidas = new Set(sopas.rows.map((s) => s.id));
  }

  // Principios activos hoy: si hay, cada ejecutivo debe llevar uno
  const principios = await client.query(
    `SELECT id FROM productos WHERE user_id = $1 AND tipo = 'principio' AND disponible_hoy`,
    [userId]
  );
  const principiosHoy = new Set(principios.rows.map((r) => r.id));

  for (const l of lineas) {
    const p = porId.get(l.productoId);

    if (!p.disponible_hoy) {
      throw new ErrorNegocio(409, `"${p.nombre}" no está disponible hoy`);
    }

    if (p.incluye_sopa) {
      if (l.cantidad !== 1) {
        throw new ErrorNegocio(400, `"${p.nombre}" se pide de a uno, para escoger la sopa de cada plato`);
      }
      if (l.sinSopa) {
        l.sopaId = null;
      } else if (!l.sopaId || !sopasValidas.has(l.sopaId)) {
        throw new ErrorNegocio(400, `Escoge la sopa de "${p.nombre}" o marca "sin sopa"`);
      }

      if (principiosHoy.size > 0) {
        if (l.sinPrincipio) {
          l.principioId = null;
        } else if (!l.principioId || !principiosHoy.has(l.principioId)) {
          throw new ErrorNegocio(400, `Escoge el principio de "${p.nombre}" o marca "sin principio"`);
        }
      } else {
        l.principioId = null;
        l.sinPrincipio = false;
      }
    } else {
      l.sopaId = null;
      l.principioId = null;
      l.sinSopa = false;
      l.sinPrincipio = false;
    }
  }
};

const insertarLineas = async (client, pedidoId, lineas, agregado) => {
  for (const l of lineas) {
    await client.query(
      `INSERT INTO pedido_detalle
         (pedido_id, producto_id, cantidad, nota, sopa_id, principio_id, sin_sopa, sin_principio, agregado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [pedidoId, l.productoId, l.cantidad, l.nota, l.sopaId, l.principioId, l.sinSopa, l.sinPrincipio, agregado]
    );
  }
};

// Mesero: crea un pedido. No toca inventario ni ventas.
const createPedido = async (req, res) => {
  const userId = req.userId;
  const mesa = String(req.body.mesa ?? '').trim();
  const notas = req.body.notas ? String(req.body.notas).trim() : null;

  if (!mesa || mesa.length > 30) {
    return res.status(400).json({ error: 'La mesa es obligatoria (máximo 30 caracteres)' });
  }

  const client = await pool.connect();

  try {
    const lineas = leerItems(req.body.items);

    await client.query('BEGIN');
    await validarLineas(client, userId, lineas);

    const pedido = await client.query(
      `INSERT INTO pedidos (user_id, mesa, notas, creado_por) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, mesa, notas, req.actorId]
    );
    await insertarLineas(client, pedido.rows[0].id, lineas, false);

    await client.query('COMMIT');
    res.status(201).json(pedido.rows[0]);
  } catch (error) {
    await manejarError(error, res, client, 'Error al crear el pedido');
  } finally {
    client.release();
  }
};

// Mesero o caja: agrega productos a un pedido que todavía no se ha cobrado.
// Si ya estaba entregado, vuelve a cocina como pendiente para que preparen lo nuevo.
const agregarItems = async (req, res) => {
  const userId = req.userId;
  const id = Number(req.params.id);
  const soloDe = req.rol === 'mesero' ? req.actorId : null;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Pedido no válido' });
  }

  const client = await pool.connect();

  try {
    const lineas = leerItems(req.body.items);

    await client.query('BEGIN');

    // FOR UPDATE: si caja cobra al mismo tiempo, uno de los dos espera al otro
    const pedidoResult = await client.query(
      `SELECT * FROM pedidos
       WHERE id = $1 AND user_id = $2 AND ($3::int IS NULL OR creado_por = $3)
       FOR UPDATE`,
      [id, userId, soloDe]
    );
    if (pedidoResult.rows.length === 0) {
      throw new ErrorNegocio(404, 'Pedido no encontrado');
    }

    const pedido = pedidoResult.rows[0];
    if (pedido.venta_id || !ESTADOS_ACTIVOS.includes(pedido.estado)) {
      throw new ErrorNegocio(409, 'Este pedido ya no admite más productos: ábrelo como pedido nuevo');
    }

    const total = await client.query('SELECT COUNT(*) FROM pedido_detalle WHERE pedido_id = $1', [id]);
    if (Number(total.rows[0].count) + lineas.length > 100) {
      throw new ErrorNegocio(400, 'El pedido ya tiene demasiados productos');
    }

    await validarLineas(client, userId, lineas);
    await insertarLineas(client, id, lineas, true);

    const actualizado = await client.query(
      `UPDATE pedidos
       SET estado = CASE WHEN estado = 'listo' THEN 'pendiente' ELSE estado END,
           actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query('COMMIT');
    res.status(201).json(actualizado.rows[0]);
  } catch (error) {
    await manejarError(error, res, client, 'Error al agregar productos al pedido');
  } finally {
    client.release();
  }
};

// Lista pedidos (por defecto los activos). El mesero solo ve los suyos.
const getPedidos = async (req, res) => {
  const userId = req.userId;
  const soloDe = req.rol === 'mesero' ? req.actorId : null;
  let estados = ESTADOS_ACTIVOS;

  if (req.query.estado) {
    estados = String(req.query.estado).split(',').map((e) => e.trim());
    if (!estados.every((e) => TODOS_LOS_ESTADOS.includes(e))) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
  }

  try {
    const pedidos = await pool.query(
      `SELECT
         p.id, p.mesa, p.estado, p.notas, p.venta_id, p.creado_en,
         u.name AS mesero,
         COALESCE(
           json_agg(
             json_build_object(
               'detalle_id', d.id,
               'producto_id', d.producto_id,
               'tipo', pr.tipo,
               'producto_nombre', pr.nombre,
               'cantidad', d.cantidad,
               'nota', d.nota,
               'precio', pr.precio,
               'sopa_nombre', sp.nombre,
               'principio_nombre', pp.nombre,
               'sin_sopa', d.sin_sopa,
               'sin_principio', d.sin_principio,
               'agregado', d.agregado,
               'ajuste', CASE WHEN d.sin_sopa THEN -${DESCUENTO_SIN_SOPA} ELSE 0 END
             ) ORDER BY d.id
           ) FILTER (WHERE d.id IS NOT NULL),
           '[]'
         ) AS items
       FROM pedidos p
       LEFT JOIN users u ON u.id = p.creado_por
       LEFT JOIN pedido_detalle d ON d.pedido_id = p.id
       LEFT JOIN productos pr ON pr.id = d.producto_id
       LEFT JOIN productos sp ON sp.id = d.sopa_id
       LEFT JOIN productos pp ON pp.id = d.principio_id
       WHERE p.user_id = $1
         AND p.estado = ANY($2::text[])
         AND ($3::int IS NULL OR p.creado_por = $3)
       GROUP BY p.id, u.name
       ORDER BY p.creado_en ASC
       LIMIT 200`,
      [userId, estados, soloDe]
    );

    res.json(pedidos.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Bloquea un pedido para corregirlo. El mesero solo toca los suyos; caja y admin, cualquiera.
// Solo se corrige mientras no se haya cobrado.
const bloquearPedidoEditable = async (client, req, id) => {
  const soloDe = req.rol === 'mesero' ? req.actorId : null;
  const pedidoResult = await client.query(
    `SELECT * FROM pedidos
     WHERE id = $1 AND user_id = $2 AND ($3::int IS NULL OR creado_por = $3)
     FOR UPDATE`,
    [id, req.userId, soloDe]
  );
  if (pedidoResult.rows.length === 0) {
    throw new ErrorNegocio(404, 'Pedido no encontrado');
  }
  const pedido = pedidoResult.rows[0];
  if (pedido.venta_id || !ESTADOS_ACTIVOS.includes(pedido.estado)) {
    throw new ErrorNegocio(409, 'Este pedido ya se cobró o se cerró: ya no se puede corregir');
  }
  return pedido;
};

const leerId = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Quita un producto de un pedido que todavía no se cobra
const quitarItem = async (req, res) => {
  const id = leerId(req.params.id);
  const detalleId = leerId(req.params.detalleId);
  if (!id || !detalleId) return res.status(400).json({ error: 'Pedido o producto no válido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await bloquearPedidoEditable(client, req, id);

    const lineas = await client.query('SELECT id FROM pedido_detalle WHERE pedido_id = $1', [id]);
    if (!lineas.rows.some((l) => l.id === detalleId)) {
      throw new ErrorNegocio(404, 'Ese producto ya no está en el pedido');
    }
    if (lineas.rows.length <= 1) {
      throw new ErrorNegocio(409, 'Es el único producto del pedido: cancela el pedido completo');
    }

    await client.query('DELETE FROM pedido_detalle WHERE id = $1 AND pedido_id = $2', [detalleId, id]);
    await client.query('UPDATE pedidos SET actualizado_en = NOW() WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: 'Producto quitado del pedido' });
  } catch (error) {
    await manejarError(error, res, client, 'Error al quitar el producto del pedido');
  } finally {
    client.release();
  }
};

// Cambia la cantidad y/o la nota de un producto de un pedido que todavía no se cobra
const editarItem = async (req, res) => {
  const id = leerId(req.params.id);
  const detalleId = leerId(req.params.detalleId);
  if (!id || !detalleId) return res.status(400).json({ error: 'Pedido o producto no válido' });

  const cambiaCantidad = req.body.cantidad !== undefined;
  const cambiaNota = req.body.nota !== undefined;
  if (!cambiaCantidad && !cambiaNota) {
    return res.status(400).json({ error: 'No hay nada que cambiar' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pedido = await bloquearPedidoEditable(client, req, id);

    const linea = await client.query(
      `SELECT d.id, d.cantidad, pr.tipo, pr.nombre
       FROM pedido_detalle d JOIN productos pr ON pr.id = d.producto_id
       WHERE d.id = $1 AND d.pedido_id = $2`,
      [detalleId, id]
    );
    if (linea.rows.length === 0) {
      throw new ErrorNegocio(404, 'Ese producto ya no está en el pedido');
    }
    const actual = linea.rows[0];

    let cantidad = actual.cantidad;
    if (cambiaCantidad) {
      cantidad = Number(req.body.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
        throw new ErrorNegocio(400, 'La cantidad debe ser un número entero entre 1 y 100');
      }
      if (actual.tipo === 'ejecutivo' && cantidad !== 1) {
        throw new ErrorNegocio(400, `"${actual.nombre}" se pide de a uno; agrega otro plato para escoger su sopa`);
      }
    }

    const nota = cambiaNota ? (req.body.nota ? String(req.body.nota).trim().slice(0, 255) || null : null) : undefined;

    await client.query(
      `UPDATE pedido_detalle
       SET cantidad = $1, nota = CASE WHEN $2::boolean THEN $3 ELSE nota END
       WHERE id = $4`,
      [cantidad, cambiaNota, nota ?? null, detalleId]
    );

    // Si ya estaba entregado y piden más, cocina lo vuelve a ver; si baja o cambia la nota, solo se actualiza
    const subio = cambiaCantidad && cantidad > actual.cantidad;
    await client.query(
      `UPDATE pedidos
       SET estado = CASE WHEN $2::boolean AND estado = 'listo' THEN 'pendiente' ELSE estado END,
           actualizado_en = NOW()
       WHERE id = $1`,
      [id, subio]
    );

    await client.query('COMMIT');
    res.json({ message: 'Producto actualizado', estado: pedido.estado });
  } catch (error) {
    await manejarError(error, res, client, 'Error al corregir el producto del pedido');
  } finally {
    client.release();
  }
};

// Cambia la mesa de un pedido que todavía no se cobra
const editarPedido = async (req, res) => {
  const id = leerId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Pedido no válido' });

  const mesa = String(req.body.mesa ?? '').trim();
  if (!mesa || mesa.length > 30) {
    return res.status(400).json({ error: 'La mesa es obligatoria (máximo 30 caracteres)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await bloquearPedidoEditable(client, req, id);
    const actualizado = await client.query(
      'UPDATE pedidos SET mesa = $1, actualizado_en = NOW() WHERE id = $2 RETURNING *',
      [mesa, id]
    );
    await client.query('COMMIT');
    res.json(actualizado.rows[0]);
  } catch (error) {
    await manejarError(error, res, client, 'Error al cambiar la mesa');
  } finally {
    client.release();
  }
};

// Mesero: marca entregado ("listo") o cancela uno suyo pendiente. Caja y admin: cualquier cambio válido.
const updateEstado = async (req, res) => {
  const userId = req.userId;
  const id = Number(req.params.id);
  const { estado } = req.body;
  const esMesero = req.rol === 'mesero';

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Pedido no válido' });
  }

  let origenes = Object.keys(TRANSICIONES).filter((o) => TRANSICIONES[o].includes(estado));
  if (origenes.length === 0) {
    return res.status(400).json({ error: 'Estado no válido. Usa: en_preparacion, listo o cancelado' });
  }

  if (esMesero) {
    if (!['listo', 'cancelado'].includes(estado)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    // El mesero solo cancela lo que aún no ha empezado
    origenes = estado === 'cancelado'
      ? ['pendiente']
      : origenes.filter((o) => ['pendiente', 'en_preparacion'].includes(o));
  }

  const soloDe = esMesero ? req.actorId : null;

  try {
    const result = await pool.query(
      `UPDATE pedidos
       SET estado = $1, actualizado_en = NOW()
       WHERE id = $2 AND user_id = $3 AND estado = ANY($4::text[]) AND venta_id IS NULL
         AND ($5::int IS NULL OR creado_por = $5)
       RETURNING *`,
      [estado, id, userId, origenes, soloDe]
    );

    if (result.rows.length === 0) {
      const existe = await pool.query(
        `SELECT estado FROM pedidos
         WHERE id = $1 AND user_id = $2 AND ($3::int IS NULL OR creado_por = $3)`,
        [id, userId, soloDe]
      );
      if (existe.rows.length === 0) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }
      return res.status(409).json({
        error: `No se puede pasar un pedido de "${existe.rows[0].estado}" a "${estado}"`,
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el pedido' });
  }
};

// Caja: confirma un pedido listo. Crea la venta y descuenta el inventario.
const confirmarPedido = async (req, res) => {
  const userId = req.userId;
  const id = Number(req.params.id);
  const tipo = req.body.tipo === 'consumo_interno' ? 'consumo_interno' : 'venta';
  const fecha = req.body.fecha || null;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Pedido no válido' });
  }

  if (fecha && !FECHA_REGEX.test(fecha)) {
    return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // FOR UPDATE: si dos personas confirman a la vez, la segunda espera y luego falla
    const pedidoResult = await client.query(
      'SELECT * FROM pedidos WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [id, userId]
    );
    if (pedidoResult.rows.length === 0) {
      throw new ErrorNegocio(404, 'Pedido no encontrado');
    }

    const pedido = pedidoResult.rows[0];
    if (pedido.venta_id || pedido.estado !== 'listo') {
      throw new ErrorNegocio(409, 'Solo se puede confirmar un pedido que está listo y aún no cobrado');
    }

    const detalle = await client.query(
      `SELECT d.producto_id, d.cantidad, d.nota, d.sin_sopa, d.sin_principio, d.sopa_id, d.principio_id,
              sp.nombre AS sopa_nombre,
              pp.nombre AS principio_nombre
       FROM pedido_detalle d
       JOIN productos pr ON pr.id = d.producto_id
       LEFT JOIN productos sp ON sp.id = d.sopa_id
       LEFT JOIN productos pp ON pp.id = d.principio_id
       WHERE d.pedido_id = $1
       ORDER BY d.id`,
      [id]
    );
    if (detalle.rows.length === 0) {
      throw new ErrorNegocio(409, 'El pedido no tiene productos');
    }

    // La sopa y el principio escogidos quedan anotados; "sin sopa" entra como descuento fijo en la línea
    const items = detalle.rows.map((d) => {
      const partes = [
        d.sin_sopa ? 'Sin sopa' : d.sopa_nombre ? `Sopa: ${d.sopa_nombre}` : null,
        d.sin_principio ? 'Sin principio' : d.principio_nombre ? `Principio: ${d.principio_nombre}` : null,
        d.nota,
      ].filter(Boolean);

      return {
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        adicion_descripcion: partes.length ? partes.join(' · ').slice(0, 255) : null,
        adicion_valor: d.sin_sopa ? -DESCUENTO_SIN_SOPA : 0,
        // La sopa y el principio escogidos gastan sus propios insumos
        consumos_extra: [d.sopa_id, d.principio_id].filter(Boolean),
      };
    });

    const venta = await registrarVenta(client, userId, { tipo, fecha, items, pago: leerPago(req.body) });

    const actualizado = await client.query(
      `UPDATE pedidos
       SET estado = 'entregado', venta_id = $1, actualizado_en = NOW()
       WHERE id = $2
       RETURNING *`,
      [venta.id, id]
    );

    await client.query('COMMIT');
    res.status(201).json({ pedido: actualizado.rows[0], venta });
  } catch (error) {
    await manejarError(error, res, client, 'Error al confirmar el pedido');
  } finally {
    client.release();
  }
};

module.exports = {
  createPedido,
  agregarItems,
  getPedidos,
  updateEstado,
  confirmarPedido,
  quitarItem,
  editarItem,
  editarPedido,
};