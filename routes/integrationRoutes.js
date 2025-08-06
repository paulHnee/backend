/**
 * Routes für HNEE Integrationen - Service Portal
 * 
 * HNEE-spezifische Services und Integrationen
 */

import express from 'express';
import { 
  getQuickServices,
  generateVpnConfig
} from '../controllers/integrationController.js';

const router = express.Router();

// ===== EINFACHE SERVICES =====
router.get('/quick-services', getQuickServices);

// ===== VPN =====
router.get('/vpn-config', generateVpnConfig);

export default router;
