const pool = require('../config/db');
const { ErrorNegocio, registrarVenta } = require('../services/ventaService');

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

// Mesero: crea un pedido. No toca inventario ni ventas.
const createPedido = async (req, res) => {
  const userId = req.userId;
  const mesa = String(req.body.mesa ?? '').trim();
  const notas = req.body.notas ? String(req.body.notas).trim() : null;
  const { items } = req.body;

  if (!mesa || mesa.length > 30) {
    return res.status(400).json({ error: 'La mesa es obligatoria (máximo 30 caracteres)' });
  }

  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ error: 'El pedido debe tener entre 1 y 50 productos' });
  }

  const lineas = [];
  for (const item of items) {
    const productoId = Number(item.producto_id);
    const cantidad = Number(item.cantidad ?? 1);

    if (
      !Number.isInteger(productoId) || productoId <= 0 ||
      !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100
    ) {
      return res.status(400).json({ error: 'Producto o cantidad no válidos en el pedido' });
    }

    const sopaId = item.sopa_id ? Number(item.sopa_id) : null;
    if (sopaId !== null && (!Number.isInteger(sopaId) || sopaId <= 0)) {
      return res.status(400).json({ error: 'Sopa no válida en el pedido' });
    }

    const principioId = item.principio_id ? Number(item.principio_id) : null;
    if (principioId !== null && (!Number.isInteger(principioId) || principioId <= 0)) {
      return res.status(400).json({ error: 'Principio no válido en el pedido' });
    }

    const nota = item.nota ? String(item.nota).trim().slice(0, 255) : null;
    lineas.push({ productoId, cantidad, nota, sopaId, principioId, sinSopa: item.sin_sopa === true });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

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
          if (!l.principioId || !principiosHoy.has(l.principioId)) {
            throw new ErrorNegocio(400, `Escoge el principio de "${p.nombre}"`);
          }
        } else {
          l.principioId = null;
        }
      } else {
        l.sopaId = null;
        l.principioId = null;
        l.sinSopa = false;
      }
    }

    const pedido = await client.query(
      `INSERT INTO pedidos (user_id, mesa, notas, creado_por) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, mesa, notas, req.actorId]
    );

    for (const l of lineas) {
      await client.query(
        `INSERT INTO pedido_detalle (pedido_id, producto_id, cantidad, nota, sopa_id, principio_id, sin_sopa)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pedido.rows[0].id, l.productoId, l.cantidad, l.nota, l.sopaId, l.principioId, l.sinSopa]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(pedido.rows[0]);
  } catch (error) {
    await manejarError(error, res, client, 'Error al crear el pedido');
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
               'producto_id', d.producto_id,
               'producto_nombre', pr.nombre,
               'cantidad', d.cantidad,
               'nota', d.nota,
               'precio', pr.precio,
               'sopa_nombre', sp.nombre,
               'principio_nombre', pp.nombre,
               'sin_sopa', d.sin_sopa,
               'ajuste', CASE WHEN d.sin_sopa THEN -COALESCE(aj.descuento_sin_sopa, 1000) ELSE 0 END
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
       LEFT JOIN ajustes_menu aj ON aj.user_id = p.user_id
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
      `SELECT d.producto_id, d.cantidad, d.nota, d.sin_sopa,
              sp.nombre AS sopa_nombre,
              pp.nombre AS principio_nombre,
              COALESCE(aj.descuento_sin_sopa, 1000) AS descuento_sin_sopa
       FROM pedido_detalle d
       JOIN productos pr ON pr.id = d.producto_id
       LEFT JOIN productos sp ON sp.id = d.sopa_id
       LEFT JOIN productos pp ON pp.id = d.principio_id
       LEFT JOIN ajustes_menu aj ON aj.user_id = pr.user_id
       WHERE d.pedido_id = $1
       ORDER BY d.id`,
      [id]
    );
    if (detalle.rows.length === 0) {
      throw new ErrorNegocio(409, 'El pedido no tiene productos');
    }

    // La sopa y el principio escogidos quedan anotados; "sin sopa" entra como descuento en la línea
    const items = detalle.rows.map((d) => {
      const partes = [
        d.sin_sopa ? 'Sin sopa' : d.sopa_nombre ? `Sopa: ${d.sopa_nombre}` : null,
        d.principio_nombre ? `Principio: ${d.principio_nombre}` : null,
        d.nota,
      ].filter(Boolean);

      return {
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        adicion_descripcion: partes.length ? partes.join(' · ').slice(0, 255) : null,
        adicion_valor: d.sin_sopa ? -Number(d.descuento_sin_sopa) : 0,
      };
    });

    const venta = await registrarVenta(client, userId, { tipo, fecha, items });

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

module.exports = { createPedido, getPedidos, updateEstado, confirmarPedido };