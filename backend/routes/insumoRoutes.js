const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createInsumo, getInsumos } = require('../controllers/insumoController');

router.post('/', protect, createInsumo);
router.get('/', protect, getInsumos);

module.exports = router;