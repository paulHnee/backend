/**
 * Admin Routes - Getrennte Monitoring und Administration
 * 
 * Diese Datei definiert sowohl Monitoring- als auch Admin-Routen.
 * Monitoring: Reports-Dashboard Daten
 * Administration: Benutzer- und Systemverwaltung
 * 
 * Monitoring Endpunkte:
 * - GET /api/admin/stats - Portal-Dashboard-Statistiken
 * - GET /api/admin/health - System Health Check
 * - GET /api/admin/wireguard/status - WireGuard Service-Status
 * - GET /api/admin/wireguard/config - WireGuard Konfiguration
 * - GET /api/admin/circuit-breaker/status - Circuit Breaker Status
 * - POST /api/admin/circuit-breaker/reset - Circuit Breaker Reset
 * 
 * Administration Endpunkte:
 * - POST /api/admin/users/:username/groups/:groupDN/add - User zu Gruppe
 * - POST /api/admin/users/:username/groups/:groupDN/remove - User aus Gruppe  
 * - POST /api/admin/users/:username/toggle - Konto aktivieren/deaktivieren
 * - POST /api/admin/users/:username/reset-password - Passwort zurücksetzen
 * - GET /api/admin/system/config - Systemkonfiguration
 * - POST /api/admin/system/config - Systemkonfiguration ändern
 * - GET /api/admin/audit-logs - Audit-Logs
 * - POST /api/admin/batch/group-operations - Batch-Gruppenoperationen
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 2.0.0 - Monitoring/Administration Trennung
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

// Admin Controller für reine Administrations-Funktionen
import {
  addUserToGroup,
  removeUserFromGroup,
  toggleUserAccount,
  resetUserPassword,
  getSystemConfig,
  updateSystemConfig,
  getAuditLogs,
  batchGroupOperations
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
 * Benutzer-Administration (LDAP)
 */

// Benutzer zu Gruppe hinzufügen
router.post('/users/:username/groups/:groupDN/add', verifyToken, requireAdmin, addUserToGroup);

// Benutzer aus Gruppe entfernen
router.post('/users/:username/groups/:groupDN/remove', verifyToken, requireAdmin, removeUserFromGroup);

// Benutzerkonto aktivieren/deaktivieren
router.post('/users/:username/toggle', verifyToken, requireAdmin, toggleUserAccount);

// Benutzer-Passwort zurücksetzen
router.post('/users/:username/reset-password', verifyToken, requireAdmin, resetUserPassword);

/**
 * System-Administration
 */

// Systemkonfiguration abrufen
router.get('/system/config', verifyToken, requireAdmin, getSystemConfig);

// Systemkonfiguration aktualisieren
router.post('/system/config', verifyToken, requireAdmin, updateSystemConfig);

// Audit-Logs abrufen
router.get('/audit-logs', verifyToken, requireAdmin, getAuditLogs);

// Batch-Gruppenoperationen
router.post('/batch/group-operations', verifyToken, requireAdmin, batchGroupOperations);

/**
 * Router exportieren
 */
export default router;
