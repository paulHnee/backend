/**
 * Routes für HNEE Integrationen - Service Portal
 * 
 * HNEE-spezifische Services und Integrationen
 */

import express from 'express';
import { 
  getQuickServices
} from '../controllers/integrationController.js';

const router = express.Router();

// ===== EINFACHE SERVICES =====
router.get('/quick-services', getQuickServices);

export default router;
