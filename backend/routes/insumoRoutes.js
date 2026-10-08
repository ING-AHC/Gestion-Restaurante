const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createInsumo, getInsumos, updateInsumo, deleteInsumo } = require('../controllers/insumoController');

router.post('/', protect, createInsumo);
router.get('/', protect, getInsumos);
router.put('/:id', protect, updateInsumo);
router.delete('/:id', protect, deleteInsumo);

module.exports = router;