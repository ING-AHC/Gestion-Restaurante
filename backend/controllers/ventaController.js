const pool = require('../config/db');
const { ErrorNegocio, registrarVenta, leerPago } = require('../services/ventaService');

const DESCUENTO_SIN_SOPA = 1000;

// Sopa y principio de un ejecutivo o desayuno: se anotan en la línea, "sin sopa" descuenta y lo escogido gasta su receta
const aplicarSopaYPrincipio = async (client, userId, linea, sel) => {
  const r = await client.query(
    `SELECT nombre, tipo, precio, precio_sin_sopa, lleva_sopa FROM productos WHERE id = $1 AND user_id = $2`,
    [linea.producto_id, userId]
  );
  const p = r.rows[0];
  if (!p || !['ejecutivo', 'desayuno'].includes(p.tipo) || !p.lleva_sopa) return;

  const partes = [];
  let ajuste = 0;
  const extras = [];

  if (sel.sin_sopa === true) {
    ajuste -= (p.precio_sin_sopa !== null ? Number(p.precio) - Number(p.precio_sin_sopa) : DESCUENTO_SIN_SOPA) * linea.cantidad;
    partes.push('Sin sopa');
  } else {
    const sopaId = Number(sel.sopa_id);
    const s = Number.isInteger(sopaId)
      ? await client.query(`SELECT id, nombre FROM productos WHERE id = $1 AND user_id = $2 AND tipo = 'sopa'`, [sopaId, userId])
      : { rows: [] };
    if (s.rows.length === 0) throw new ErrorNegocio(400, `Escoge la sopa de "${p.nombre}" o marca "sin sopa"`);
    extras.push(s.rows[0].id);
    partes.push(`Sopa: ${s.rows[0].nombre}`);
  }

  if (sel.sin_principio === true) {
    partes.push('Sin principio');
  } else if (sel.principio_id) {
    const pr = await client.query(
      `SELECT id, nombre FROM productos WHERE id = $1 AND user_id = $2 AND tipo = 'principio'`,
      [Number(sel.principio_id), userId]
    );
    if (pr.rows.length === 0) throw new ErrorNegocio(400, 'El principio escogido no es válido');
    extras.push(pr.rows[0].id);
    partes.push(`Principio: ${pr.rows[0].nombre}`);
  }

  if (linea.adicion_descripcion) partes.push(String(linea.adicion_descripcion));
  linea.adicion_descripcion = partes.join(', ');
  linea.adicion_valor = (Number(linea.adicion_valor) || 0) + ajuste;
  linea.consumos_extra = extras;
};

const createVenta = async (req, res) => {
  const { tipo, items, fecha } = req.body;
  const userId = req.userId;
  const tipoVenta = tipo || 'venta';

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos un producto en la venta' });
  }

  // Cada línea es un producto del menú o un servicio libre (con nombre y valor)
  const lineas = [];
  for (const item of items) {
    const cantidad = item.cantidad === undefined ? 1 : Number(item.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 1000) {
      return res.status(400).json({ error: 'Producto o cantidad no válidos en la venta' });
    }

    const esServicio = item.producto_id === undefined || item.producto_id === null || item.producto_id === '';

    if (esServicio) {
      const concepto = String(item.concepto ?? '').trim();
      const precio = Number(item.precio);
      if (!concepto || concepto.length > 150) {
        return res.status(400).json({ error: 'Escribe qué servicio es (máximo 150 caracteres)' });
      }
      if (!Number.isFinite(precio) || precio <= 0 || precio > 100000000) {
        return res.status(400).json({ error: `El valor de "${concepto}" no es válido` });
      }
      lineas.push({ concepto, precio, cantidad });
    } else {
      if (!Number.isInteger(Number(item.producto_id))) {
        return res.status(400).json({ error: 'Producto o cantidad no válidos en la venta' });
      }
      lineas.push({
        producto_id: Number(item.producto_id),
        cantidad,
        precio_unitario: item.precio_unitario,
        adicion_descripcion: item.adicion_descripcion,
        adicion_valor: item.adicion_valor,
        _sel: { sopa_id: item.sopa_id, sin_sopa: item.sin_sopa, principio_id: item.principio_id, sin_principio: item.sin_principio },
      });
    }
  }

  const client = await pool.connect();

  try {
    const pago = leerPago(req.body);
    await client.query('BEGIN');
    for (const l of lineas) {
      if (l._sel) {
        await aplicarSopaYPrincipio(client, userId, l, l._sel);
        delete l._sel;
      }
    }
    const venta = await registrarVenta(client, userId, { tipo: tipoVenta, fecha, items: lineas, pago });
    await client.query('COMMIT');

    res.status(201).json(venta);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof ErrorNegocio) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la venta' });
  } finally {
    client.release();
  }
};

const getVentas = async (req, res) => {
  const userId = req.userId;

  try {
    const ventas = await pool.query(
      `SELECT
         v.id,
         v.tipo,
         v.fecha,
         v.metodo_pago,
         v.monto_efectivo,
         json_agg(
           json_build_object(
             'producto_nombre', COALESCE(p.nombre, vd.concepto, 'Producto eliminado'),
             'es_servicio', (vd.producto_id IS NULL AND vd.concepto IS NOT NULL),
             'cantidad', vd.cantidad,
             'precio_unitario', vd.precio_unitario,
             'adicion_descripcion', vd.adicion_descripcion,
             'adicion_valor', vd.adicion_valor
           )
         ) AS items,
         SUM(vd.cantidad * vd.precio_unitario + COALESCE(vd.adicion_valor, 0)) AS total
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       LEFT JOIN productos p ON vd.producto_id = p.id
       WHERE v.user_id = $1
       GROUP BY v.id
       ORDER BY v.fecha DESC, v.id DESC`,
      [userId]
    );

    res.json(ventas.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { createVenta, getVentas };