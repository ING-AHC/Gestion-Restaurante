const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  createProducto,
  getProductos,
  asignarInsumos,
  deleteProducto,
  updateProducto,
} = require('../controllers/productoController');

router.put('/:id', protect, updateProducto);

router.post('/', protect, createProducto);
router.get('/', protect, getProductos);
router.post('/:producto_id/insumos', protect, asignarInsumos);
router.delete('/:id', protect, deleteProducto);

module.exports = router;