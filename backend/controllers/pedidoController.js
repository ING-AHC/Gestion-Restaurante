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

    const nota = item.nota ? String(item.nota).trim().slice(0, 255) : null;
    lineas.push({ productoId, cantidad, nota });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const ids = [...new Set(lineas.map((l) => l.productoId))];
    const propios = await client.query(
      'SELECT id FROM productos WHERE id = ANY($1::int[]) AND user_id = $2',
      [ids, userId]
    );
    if (propios.rows.length !== ids.length) {
      throw new ErrorNegocio(404, 'Alguno de los productos no existe');
    }

    const pedido = await client.query(
      `INSERT INTO pedidos (user_id, mesa, notas, creado_por) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, mesa, notas, req.actorId]
    );

    for (const l of lineas) {
      await client.query(
        `INSERT INTO pedido_detalle (pedido_id, producto_id, cantidad, nota)
         VALUES ($1, $2, $3, $4)`,
        [pedido.rows[0].id, l.productoId, l.cantidad, l.nota]
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
               'precio', pr.precio
             ) ORDER BY d.id
           ) FILTER (WHERE d.id IS NOT NULL),
           '[]'
         ) AS items
       FROM pedidos p
       LEFT JOIN users u ON u.id = p.creado_por
       LEFT JOIN pedido_detalle d ON d.pedido_id = p.id
       LEFT JOIN productos pr ON pr.id = d.producto_id
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
      'SELECT producto_id, cantidad, nota FROM pedido_detalle WHERE pedido_id = $1 ORDER BY id',
      [id]
    );
    if (detalle.rows.length === 0) {
      throw new ErrorNegocio(409, 'El pedido no tiene productos');
    }

    const items = detalle.rows.map((d) => ({
      producto_id: d.producto_id,
      cantidad: d.cantidad,
      adicion_descripcion: d.nota,
      adicion_valor: 0,
    }));

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