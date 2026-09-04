const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createProveedores, getProveedores } = require('../controllers/proveedorController');

router.post('/', protect, createProveedores);
router.get('/', protect, getProveedores);

module.exports = router;