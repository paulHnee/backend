/**
 * Admin Routes - Service Portal API-Endpunkte für HNEE
 * 
 * Diese Datei definiert alle Service Portal Admin-Routen für das
 * HNEE IT-Service Zentrum. Fokus auf Service-Management statt
 * System-Administration.
 * 
 * Endpunkte:
 * - GET /api/admin/stats - Portal-Dashboard-Statistiken
 * - GET /api/admin/wireguard/peers - WireGuard Peers abrufen
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
  getWireGuardPeers,
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

/**
 * VPN Management
 */

// WireGuard Peers abrufen - GET /api/admin/wireguard/peers
router.get('/wireguard/peers', verifyToken, getWireGuardPeers);

/**
 * LDAP Integration
 */

// LDAP-Synchronisation - POST /api/admin/ldap/sync
router.post('/ldap/sync', verifyToken, generalLimiter, syncLDAP);

/**
 * Router exportieren
 */
export default router;
