/**
 * Routes für User Profile - HNEE Service Portal
 * 
 * Einfache Benutzer-Profil-Routen ohne Self-Service-Features
 */

import express from 'express';
import { 
  getUserProfile,
  getQuickActions
} from '../controllers/userController.js';

const router = express.Router();

// ===== USER PROFILE =====
router.get('/profile', getUserProfile);

// ===== QUICK ACCESS =====
router.get('/quick-actions', getQuickActions);

export default router;
