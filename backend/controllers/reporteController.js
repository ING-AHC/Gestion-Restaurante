const pool = require('../config/db');

// Reporte 1: Resumen financiero (ganancia real)
const getResumenFinanciero = async (req, res) => {
  const userId = req.userId;

  try {
    // Sumamos el total de ventas reales (excluyendo consumo interno)
    const ventasResult = await pool.query(
      `SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total
       FROM ventas
       WHERE user_id = $1 AND tipo = 'venta'`,
      [userId]
    );

    // Sumamos el total de consumo interno (por separado, no cuenta como ingreso)
    const consumoInternoResult = await pool.query(
      `SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total
       FROM ventas
       WHERE user_id = $1 AND tipo = 'consumo_interno'`,
      [userId]
    );

    // Sumamos el total de compras (gastos)
    const comprasResult = await pool.query(
      `SELECT COALESCE(SUM(monto_total), 0) AS total
       FROM compras
       WHERE user_id = $1`,
      [userId]
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

// Reporte 2: Cuánto se le debe a cada proveedor
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

// Reporte 3: Gastos agrupados por categoría
const getGastosPorCategoria = async (req, res) => {
  const userId = req.userId;

  try {
    const gastos = await pool.query(
      `SELECT
         cg.nombre AS categoria_nombre,
         SUM(c.monto_total) AS total_gastado
       FROM compras c
       JOIN categorias_gasto cg ON c.categoria_id = cg.id
       WHERE c.user_id = $1
       GROUP BY cg.id, cg.nombre
       ORDER BY total_gastado DESC`,
      [userId]
    );

    res.json(gastos.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { getResumenFinanciero, getDeudasProveedores, getGastosPorCategoria };