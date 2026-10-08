const pool = require('../config/db');

const getResumenFinanciero = async (req, res) => {
  const userId = req.userId;
  const { mes, anio } = req.query;

  try {
    let filtroFechaVentas = '';
    let paramsVentas = [userId];

    if (mes && anio) {
      filtroFechaVentas = 'AND EXTRACT(MONTH FROM v.fecha) = $2 AND EXTRACT(YEAR FROM v.fecha) = $3';
      paramsVentas = [userId, mes, anio];
    }

    const ventasResult = await pool.query(
      `SELECT COALESCE(SUM(vd.cantidad * vd.precio_unitario), 0) AS total
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       WHERE v.user_id = $1 AND v.tipo = 'venta' ${filtroFechaVentas}`,
      paramsVentas
    );

    const consumoInternoResult = await pool.query(
      `SELECT COALESCE(SUM(vd.cantidad * vd.precio_unitario), 0) AS total
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       WHERE v.user_id = $1 AND v.tipo = 'consumo_interno' ${filtroFechaVentas}`,
      paramsVentas
    );

    let filtroFechaCompras = '';
    let paramsCompras = [userId];

    if (mes && anio) {
      filtroFechaCompras = 'AND EXTRACT(MONTH FROM fecha) = $2 AND EXTRACT(YEAR FROM fecha) = $3';
      paramsCompras = [userId, mes, anio];
    }

    const comprasResult = await pool.query(
      `SELECT COALESCE(SUM(monto_total), 0) AS total
       FROM compras
       WHERE user_id = $1 ${filtroFechaCompras}`,
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
  const { mes, anio } = req.query;

  try {
    let filtroFecha = '';
    let params = [userId];

    if (mes && anio) {
      filtroFecha = 'AND EXTRACT(MONTH FROM c.fecha) = $2 AND EXTRACT(YEAR FROM c.fecha) = $3';
      params = [userId, mes, anio];
    }

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
  const { mes, anio } = req.query;

  try {
    let filtroFecha = '';
    let params = [userId];

    if (mes && anio) {
      filtroFecha = 'AND EXTRACT(MONTH FROM fecha) = $2 AND EXTRACT(YEAR FROM fecha) = $3';
      params = [userId, mes, anio];
    }

    const ventasPorDia = await pool.query(
      `SELECT v.fecha, SUM(vd.cantidad * vd.precio_unitario) AS total
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       WHERE v.user_id = $1 AND v.tipo = 'venta' ${filtroFecha.replace('fecha', 'v.fecha')}
       GROUP BY v.fecha`,
      params
    );

    const comprasPorDia = await pool.query(
      `SELECT fecha, SUM(monto_total) AS total
       FROM compras
       WHERE user_id = $1 ${filtroFecha}
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