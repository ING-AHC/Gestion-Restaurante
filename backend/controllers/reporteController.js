const pool = require('../config/db');

// Valida mes y año; devuelve null si no vienen, o un objeto con los dos números
const leerPeriodo = (query) => {
  const { mes, anio } = query;
  if (!mes || !anio) return null;

  const m = Number(mes);
  const a = Number(anio);

  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(a) || a < 2000 || a > 2100) {
    return 'invalido';
  }

  return { mes: m, anio: a };
};

const getResumenFinanciero = async (req, res) => {
  const userId = req.userId;
  const periodo = leerPeriodo(req.query);

  if (periodo === 'invalido') {
    return res.status(400).json({ error: 'Mes o año no válidos' });
  }

  try {
    const filtroVentas = periodo
      ? 'AND EXTRACT(MONTH FROM v.fecha) = $2 AND EXTRACT(YEAR FROM v.fecha) = $3'
      : '';
    const paramsVentas = periodo ? [userId, periodo.mes, periodo.anio] : [userId];

    const filtroCompras = periodo
      ? 'AND EXTRACT(MONTH FROM fecha) = $2 AND EXTRACT(YEAR FROM fecha) = $3'
      : '';
    const paramsCompras = periodo ? [userId, periodo.mes, periodo.anio] : [userId];

    const ventasResult = await pool.query(
      `SELECT COALESCE(SUM(vd.cantidad * vd.precio_unitario + COALESCE(vd.adicion_valor, 0)), 0) AS total
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       WHERE v.user_id = $1 AND v.tipo = 'venta' ${filtroVentas}`,
      paramsVentas
    );

    const consumoInternoResult = await pool.query(
      `SELECT COALESCE(SUM(vd.cantidad * vd.precio_unitario + COALESCE(vd.adicion_valor, 0)), 0) AS total
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       WHERE v.user_id = $1 AND v.tipo = 'consumo_interno' ${filtroVentas}`,
      paramsVentas
    );

    const comprasResult = await pool.query(
      `SELECT COALESCE(SUM(monto_total), 0) AS total
       FROM compras
       WHERE user_id = $1 ${filtroCompras}`,
      paramsCompras
    );

    const totalVentas = parseFloat(ventasResult.rows[0].total);
    const totalConsumoInterno = parseFloat(consumoInternoResult.rows[0].total);
    const totalCompras = parseFloat(comprasResult.rows[0].total);
    const ganancia = totalVentas - totalCompras;

    res.json({
      total_ventas: totalVentas,
      total_consumo_interno: totalConsumoInterno,
      total_compras: totalCompras,
      ganancia_real: ganancia,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const getDeudasProveedores = async (req, res) => {
  const userId = req.userId;

  try {
    const deudas = await pool.query(
      `SELECT
         p.nombre AS proveedor_nombre,
         SUM(c.monto_total) AS total_deuda
       FROM compras c
       JOIN proveedores p ON c.proveedor_id = p.id
       WHERE c.user_id = $1 AND c.estado_pago = 'pendiente'
       GROUP BY p.id, p.nombre
       ORDER BY total_deuda DESC`,
      [userId]
    );

    res.json(deudas.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const getGastosPorCategoria = async (req, res) => {
  const userId = req.userId;
  const periodo = leerPeriodo(req.query);

  if (periodo === 'invalido') {
    return res.status(400).json({ error: 'Mes o año no válidos' });
  }

  try {
    const filtroFecha = periodo
      ? 'AND EXTRACT(MONTH FROM c.fecha) = $2 AND EXTRACT(YEAR FROM c.fecha) = $3'
      : '';
    const params = periodo ? [userId, periodo.mes, periodo.anio] : [userId];

    const gastos = await pool.query(
      `SELECT
         COALESCE(cgi.nombre, cgd.nombre) AS categoria_nombre,
         SUM(cd.valor_unitario) AS total_gastado
       FROM compra_detalle cd
       JOIN compras c ON cd.compra_id = c.id
       LEFT JOIN insumos i ON cd.insumo_id = i.id
       LEFT JOIN categorias_gasto cgi ON i.categoria_id = cgi.id
       LEFT JOIN categorias_gasto cgd ON cd.categoria_id = cgd.id
       WHERE c.user_id = $1 ${filtroFecha}
       GROUP BY COALESCE(cgi.nombre, cgd.nombre)
       ORDER BY total_gastado DESC`,
      params
    );

    res.json(gastos.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const getResumenDiario = async (req, res) => {
  const userId = req.userId;
  const periodo = leerPeriodo(req.query);

  if (periodo === 'invalido') {
    return res.status(400).json({ error: 'Mes o año no válidos' });
  }

  try {
    const filtroVentas = periodo
      ? 'AND EXTRACT(MONTH FROM v.fecha) = $2 AND EXTRACT(YEAR FROM v.fecha) = $3'
      : '';
    const filtroCompras = periodo
      ? 'AND EXTRACT(MONTH FROM fecha) = $2 AND EXTRACT(YEAR FROM fecha) = $3'
      : '';
    const params = periodo ? [userId, periodo.mes, periodo.anio] : [userId];

    const ventasPorDia = await pool.query(
      `SELECT v.fecha, SUM(vd.cantidad * vd.precio_unitario + COALESCE(vd.adicion_valor, 0)) AS total
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       WHERE v.user_id = $1 AND v.tipo = 'venta' ${filtroVentas}
       GROUP BY v.fecha`,
      params
    );

    const comprasPorDia = await pool.query(
      `SELECT fecha, SUM(monto_total) AS total
       FROM compras
       WHERE user_id = $1 ${filtroCompras}
       GROUP BY fecha`,
      params
    );

    const resumenPorFecha = {};

    ventasPorDia.rows.forEach((row) => {
      const fecha = row.fecha;
      if (!resumenPorFecha[fecha]) resumenPorFecha[fecha] = { fecha, ventas: 0, compras: 0 };
      resumenPorFecha[fecha].ventas = parseFloat(row.total);
    });

    comprasPorDia.rows.forEach((row) => {
      const fecha = row.fecha;
      if (!resumenPorFecha[fecha]) resumenPorFecha[fecha] = { fecha, ventas: 0, compras: 0 };
      resumenPorFecha[fecha].compras = parseFloat(row.total);
    });

    const resultado = Object.values(resumenPorFecha)
      .map((dia) => ({ ...dia, ganancia: dia.ventas - dia.compras }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { getResumenFinanciero, getDeudasProveedores, getGastosPorCategoria, getResumenDiario };