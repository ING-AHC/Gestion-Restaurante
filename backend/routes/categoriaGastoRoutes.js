const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createcategoriaGasto, getcategoriaGasto, deletecategoriaGasto } = require('../controllers/categoriaGastoController');

router.post('/', protect, createcategoriaGasto);
router.get('/', protect,  getcategoriaGasto);
router.delete('/:id', protect, deletecategoriaGasto);

module.exports = router;