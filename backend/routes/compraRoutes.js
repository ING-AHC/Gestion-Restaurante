const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createCompra, getCompras, marcarComoPagada } = require('../controllers/compraController');

router.post('/', protect, createCompra);
router.get('/', protect, getCompras);
router.put('/:id/pagar', protect, marcarComoPagada);

module.exports = router;