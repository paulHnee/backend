import express from 'express';
import { login, getDashboardData } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

// Create router instance
export const router = express.Router();

// Route für die Benutzeranmeldung (Login)
// POST /api/auth/login - Erwartet username und password im Request Body
router.post('/login', login);

// Geschützte Route für Dashboard-Daten
// GET /api/auth/dashboard - Benötigt gültigen JWT Token im Authorization Header
router.get('/dashboard', authMiddleware, getDashboardData);