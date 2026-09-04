const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createVenta, getVentas } = require('../controllers/ventaController');

router.post('/', protect, createVenta);
router.get('/', protect, getVentas);

module.exports = router;