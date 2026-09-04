const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createPlato, getPlatos, asignarInsumos } = require('../controllers/platoController');

router.post('/', protect, createPlato);
router.get('/', protect, getPlatos);
router.post('/:plato_id/insumos', protect, asignarInsumos);

module.exports = router;