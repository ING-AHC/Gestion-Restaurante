const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {  createcategoriaGasto, getcategoriaGasto } = require('../controllers/categoriaGastoController');

router.post('/', protect, createcategoriaGasto);
router.get('/', protect,  getcategoriaGasto);

module.exports = router;