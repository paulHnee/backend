/**
 * Routes für Support & Help - HNEE Service Portal
 * 
 * Zammad-Integration und einfache Diagnose-Tools
 */

import express from 'express';
import { 
  getZammadInfo,
  getDiagnosticTools,
  getContactInfo
} from '../controllers/supportController.js';

const router = express.Router();

// ===== ZAMMAD INTEGRATION =====
router.get('/zammad-info', getZammadInfo);

// ===== SELF-HELP TOOLS =====
router.get('/diagnostic-tools', getDiagnosticTools);

// ===== CONTACT INFO =====
router.get('/contact', getContactInfo);

export default router;
