/**
 * Admin Routes - Service Portal API-Endpunkte für HNEE
 * 
 * Diese Datei definiert alle Service Portal Admin-Routen für das
 * HNEE IT-Service Zentrum. Fokus auf Service-Management statt
 * System-Administration.
 * 
 * Endpunkte:
 * - GET /api/admin/stats - Portal-Dashboard-Statistiken
 * - GET /api/admin/users - Detaillierte Benutzerinformationen aus LDAP
 * - GET /api/admin/wireguard/peers - WireGuard Konfiguration abrufen
 * - GET /api/admin/wireguard/service - WireGuard Service-Status
 * - GET /api/admin/wireguard/general - WireGuard Allgemeine Einstellungen
 * - GET /api/admin/system/diagnostics - System-Diagnose und Ressourcen
 * - GET /api/admin/dashboard - OPNsense Dashboard-Informationen
 * - GET /api/admin/firewall/diagnostics - Firewall-Diagnose und Status
 * - POST /api/admin/ldap/sync - LDAP-Synchronisation
 * 
 * Sicherheit:
 * - Alle Routen erfordern gültige JWT-Authentifizierung
 * - Admin-Rollenbasierte Zugriffskontrolle
 * - Rate Limiting für kritische Operationen
 * - Input-Validierung und Sanitization
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 2.0.0 - Service Portal Focus
 */

import express from 'express';
import { 
  getPortalStats,
  syncLDAP,
  getUserDetails,
  getWireGuardPeers,
  getWireGuardServiceStatus,
  getWireGuardGeneral,
  getSystemDiagnostics,
  getDashboardInfo,
  getFirewallDiagnostics,
} from '../controllers/adminController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { generalLimiter } from '../middleware/securityMiddleware.js';

// Router-Instanz erstellen
export const router = express.Router();

/**
 * Portal Dashboard
 */

// Portal-Statistiken abrufen - GET /api/admin/stats
router.get('/stats', verifyToken, getPortalStats);

// Detaillierte Benutzerinformationen - GET /api/admin/users
router.get('/users', verifyToken, getUserDetails);

/**
 * VPN Management
 */

// WireGuard Konfiguration abrufen - GET /api/admin/wireguard/peers
router.get('/wireguard/peers', verifyToken, getWireGuardPeers);

// WireGuard Service-Status - GET /api/admin/wireguard/service
router.get('/wireguard/service', verifyToken, getWireGuardServiceStatus);

// WireGuard Allgemeine Einstellungen - GET /api/admin/wireguard/general
router.get('/wireguard/general', verifyToken, getWireGuardGeneral);

/**
 * System Monitoring
 */

// System-Diagnose und Ressourcen - GET /api/admin/system/diagnostics
router.get('/system/diagnostics', verifyToken, getSystemDiagnostics);

// OPNsense Dashboard-Informationen - GET /api/admin/dashboard
router.get('/dashboard', verifyToken, getDashboardInfo);

/**
 * Firewall Management
 */

// Firewall-Diagnose und Status - GET /api/admin/firewall/diagnostics
router.get('/firewall/diagnostics', verifyToken, getFirewallDiagnostics);

/**
 * LDAP Integration
 */

// LDAP-Synchronisation - POST /api/admin/ldap/sync
router.post('/ldap/sync', verifyToken, generalLimiter, syncLDAP);

/**
 * Router exportieren
 */
export default router;
