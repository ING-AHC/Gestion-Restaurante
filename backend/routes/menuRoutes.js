const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  getMenuAdmin,
  getMenuHoy,
  updateMenuItem,
  reiniciarMenu,
} = require('../controllers/menuController');

router.get('/hoy', protect, getMenuHoy);
router.get('/', protect, getMenuAdmin);
router.post('/reiniciar', protect, reiniciarMenu);
router.patch('/:id', protect, updateMenuItem);

module.exports = router;