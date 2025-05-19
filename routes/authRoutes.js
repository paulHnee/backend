const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.js');
const authMiddleware = require('../middleware/authMiddleware.js');

router.post('/login', authController.login);
router.get('/dashboard', authMiddleware, authController.getDashboardData);

module.exports = router;