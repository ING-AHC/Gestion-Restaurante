const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  getResumenFinanciero,
  getDeudasProveedores,
  getGastosPorCategoria,
} = require('../controllers/reporteController');

router.get('/resumen', protect, getResumenFinanciero);
router.get('/deudas-proveedores', protect, getDeudasProveedores);
router.get('/gastos-categoria', protect, getGastosPorCategoria);

module.exports = router;