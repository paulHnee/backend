/**
 * Routes für Dashboard & Monitoring - HNEE Service Portal
 * 
 * Benutzerfreundliche Dashboard-Routen für Monitoring und Analytics
 */

import express from 'express';
import { 
  getDashboard,
  getServiceHealth,
  getUsageAnalytics,
  getCampusInfo,
  getSystemMetrics
} from '../controllers/dashboardController.js';

const router = express.Router();

// ===== MAIN DASHBOARD =====
router.get('/', getDashboard);

// ===== SERVICE MONITORING =====
router.get('/service-health', getServiceHealth);
router.get('/analytics', getUsageAnalytics);

// ===== CAMPUS INFORMATION =====
router.get('/campus-info', getCampusInfo);

// ===== SYSTEM METRICS (ITSZ only) =====
router.get('/system-metrics', getSystemMetrics);

export default router;
