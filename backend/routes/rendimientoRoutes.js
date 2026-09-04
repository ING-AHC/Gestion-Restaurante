const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createRendimiento, getRendimientos } = require('../controllers/rendimientoController');

router.post('/', protect, createRendimiento);
router.get('/', protect, getRendimientos);

module.exports = router;