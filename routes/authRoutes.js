const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.js');
const authMiddleware = require('../middleware/authMiddleware.js');

// Route für die Benutzeranmeldung (Login)
// POST /api/auth/login - Erwartet username und password im Request Body
router.post('/login', authController.login);

// Geschützte Route für Dashboard-Daten
// GET /api/auth/dashboard - Benötigt gültigen JWT Token im Authorization Header
router.get('/dashboard', authMiddleware, authController.getDashboardData);

module.exports = router;