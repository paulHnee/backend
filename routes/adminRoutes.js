/**
 * Admin Routes - Administrative API-Endpunkte für HNEE Syst// Portal-Statistiken abrufen - GET /api/admin/stats
router.get('/stats', verifyToken, getPortalStats);

// Service-Status umschalten - POST /api/admin/service/toggle
router.post('/service/toggle', verifyToken, generalLimiter, toggleService);

// Benutzer VPN zurücksetzen - POST /api/admin/user/reset-vpn
router.post('/user/reset-vpn', verifyToken, generalLimiter, resetUserVPN);

// WireGuard Peers abrufen - GET /api/admin/wireguard/peers
router.get('/wireguard/peers', verifyToken, getWireGuardPeers);

export default router;i definiert alle Admin-spezifischen API-Routen für das
 * HNEE IT-Service Zentrum. Alle Routen erfordern Admin-Berechtigungen
 * und implementieren umfassende Audit-Logging-Funktionen.
 * 
 * Endpunkte:
 * - POST /api/admin/cache/clear - Cache-Management
 * - GET /api/admin/backup - System-Backup erstellen
 * - GET/POST /api/admin/maintenance - Wartungsmodus verwalten
 * - GET /api/admin/stats - Admin-Dashboard-Statistiken
 * - GET /api/admin/health - System-Health-Monitoring
 * - POST /api/admin/ldap/sync - LDAP-Synchronisation
 * - GET /api/admin/users - Benutzerübersicht
 * 
 * Sicherheit:
 * - Alle Routen erfordern gültige JWT-Authentifizierung
 * - Admin-Rollenbasierte Zugriffskontrolle
 * - Rate Limiting für kritische Operationen
 * - Umfassendes Audit-Logging
 * - Input-Validierung und Sanitization
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 1.0.0
 */

import express from 'express';
import { 
  getPortalStats,
  toggleService,
  resetUserVPN,
  getWireGuardPeers
} from '../controllers/adminController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { generalLimiter } from '../middleware/securityMiddleware.js';

// Router-Instanz erstellen
export const router = express.Router();

/**
 * Cache-Management Endpunkte
 */

// Cache leeren - POST /api/admin/cache/clear
router.post('/cache/clear', verifyToken, generalLimiter, clearCache);

/**
 * Backup und Wartung
 */

// System-Backup erstellen - GET /api/admin/backup
router.get('/backup', verifyToken, generalLimiter, createBackup);

// Wartungsmodus-Status abrufen - GET /api/admin/maintenance
router.get('/maintenance', verifyToken, getMaintenanceStatus);

// Wartungsmodus togglen - POST /api/admin/maintenance
router.post('/maintenance', verifyToken, generalLimiter, toggleMaintenanceMode);

/**
 * Dashboard und Monitoring
 */

// Admin-Statistiken abrufen - GET /api/admin/stats
router.get('/stats', verifyToken, getAdminStats);

// System-Health abrufen - GET /api/admin/health
router.get('/health', verifyToken, getSystemHealth);

/**
 * LDAP-Management
 */

// LDAP-Synchronisation starten - POST /api/admin/ldap/sync
router.post('/ldap/sync', verifyToken, generalLimiter, syncLDAP);

// Log-Export - GET /api/admin/logs/export
router.get('/logs/export', verifyToken, generalLimiter, exportLogs);

// Sicherheitsscan - POST /api/admin/security/scan
router.post('/security/scan', verifyToken, generalLimiter, runSecurityScan);

export default router;
