const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  createPedido,
  getPedidos,
  updateEstado,
  confirmarPedido,
} = require('../controllers/pedidoController');

router.post('/', protect, createPedido);
router.get('/', protect, getPedidos);
router.patch('/:id/estado', protect, updateEstado);
router.post('/:id/confirmar', protect, confirmarPedido);

module.exports = router;
