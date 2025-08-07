/**
 * System Routes - Monitoring und Konfiguration
 * 
 * Diese Datei definiert System-Routen für Monitoring und grundlegende Konfiguration.
 * Keine Admin-Operationen - nur Überwachung und Read-Only Konfiguration.
 * 
 * Monitoring Endpunkte:
 * - GET /api/admin/stats - Portal-Dashboard-Statistiken
 * - GET /api/admin/health - System Health Check
 * - GET /api/admin/wireguard/status - WireGuard Service-Status
 * - GET /api/admin/wireguard/config - WireGuard Konfiguration
 * - GET /api/admin/circuit-breaker/status - Circuit Breaker Status
 * - POST /api/admin/circuit-breaker/reset - Circuit Breaker Reset
 * - GET /api/admin/system/config - Systemkonfiguration (Read-Only)
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 3.0.0 - Nur Monitoring, keine Admin-Operationen
 */

import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/securityMiddleware.js';

// Monitoring Controller für alle Überwachungsfunktionen
import {
  getPortalStats,
  getWireGuardServiceStatus,
  getHealthStatus,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  getWireGuardConfig
} from '../controllers/monitoringController.js';

// System-Konfiguration (Read-Only)
import {
  getSystemConfig
} from '../controllers/adminController.js';

// Router-Instanz erstellen
export const router = express.Router();

/**
 * Portal Dashboard & Monitoring
 */

// Health Check - Öffentlich für externe Monitoring-Systeme
router.get('/health', getHealthStatus);

// Portal-Statistiken für Reports Dashboard
router.get('/stats', verifyToken, getPortalStats);

// WireGuard Service Status
router.get('/wireguard/status', verifyToken, getWireGuardServiceStatus);

// WireGuard Konfiguration für Monitoring
router.get('/wireguard/config', verifyToken, getWireGuardConfig);

// Circuit Breaker Status
router.get('/circuit-breaker/status', verifyToken, getCircuitBreakerStatus);

// Circuit Breaker manuell zurücksetzen (Admin-only)
router.post('/circuit-breaker/reset', verifyToken, requireAdmin, resetCircuitBreaker);

/**
 * System-Konfiguration (Read-Only)
 */

// Systemkonfiguration abrufen (nur lesend)
router.get('/system/config', verifyToken, getSystemConfig);

/**
 * Router exportieren
 */
export default router;
