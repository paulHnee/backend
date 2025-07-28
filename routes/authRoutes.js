import express from 'express';
import { 
  login, 
  logout, 
  checkSession, 
  getDashboardData, 
  getUserGroups, 
  checkUserGroup, 
  searchAvailableGroups 
} from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

// Create router instance
export const router = express.Router();

// Route für die Benutzeranmeldung (Login)
// POST /api/auth/login - Erwartet username und password im Request Body
router.post('/login', login);

// Route für die Benutzerabmeldung (Logout)
// POST /api/auth/logout - Erwartet keinen Body
router.post('/logout', logout);

// Route zum Überprüfen der Benutzersitzung
// GET /api/auth/session - Benötigt gültigen JWT Token im Authorization Header
router.get('/session', verifyToken, checkSession);

// Geschützte Route für Dashboard-Daten
// GET /api/auth/dashboard - Benötigt gültigen JWT Token im Authorization Header
router.get('/dashboard', verifyToken, getDashboardData);

// Route um Benutzergruppen abzurufen
// GET /api/auth/groups - Benötigt gültigen JWT Token
router.get('/groups', verifyToken, getUserGroups);

// Route um Gruppenmitgliedschaft zu überprüfen
// GET /api/auth/groups/:groupName/check - Benötigt gültigen JWT Token
router.get('/groups/:groupName/check', verifyToken, checkUserGroup);

// Route um verfügbare Gruppen zu durchsuchen (nur für Admins/ITSZ)
// GET /api/auth/groups/search?pattern=hnee* - Benötigt gültigen JWT Token und Admin-Rechte
router.get('/groups/search', verifyToken, searchAvailableGroups);