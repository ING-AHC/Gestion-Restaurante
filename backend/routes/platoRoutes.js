const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createPlato, getPlatos, asignarInsumos, deletePlato } = require('../controllers/platoController');

router.post('/', protect, createPlato);
router.get('/', protect, getPlatos);
router.post('/:plato_id/insumos', protect, asignarInsumos);
router.delete('/:id', protect, deletePlato);
module.exports = router;