/**
 * Monitoring Routes für HNEE Service Portal
 * 
 * Diese Routen stellen Monitoring und Health Check Endpunkte bereit:
 * - Portal-Statistiken (LDAP + VPN)
 * - WireGuard Service Status
 * - System Health Checks
 * - Circuit Breaker Management
 * - API-Konfigurationsstatus
 * 
 * Alle Endpunkte sind authentifiziert und protokolliert.
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 1.0.0
 */


import express from 'express';
import { 
  getPortalStats,
  getPersonalVpnStats,
  getWireGuardServiceStatus,
  getHealthStatus,
  getWireGuardConfig,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  getWireGuardServiceInfo
} from '../controllers/monitoringController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { logSecurityEvent } from '../utils/securityLogger.js';

const router = express.Router();

/**
 * WireGuard Service-Info (OPNsense)
 * Authentifizierter Endpunkt
 */
router.get('/wireguard/service/info', verifyToken, getWireGuardServiceInfo);

// ===== ÖFFENTLICHE ENDPUNKTE (ohne Authentifizierung) =====

/**
 * Öffentliche System Health Check
 * Einfacher Health Check ohne sensitive Daten
 */
router.get('/health', getHealthStatus);

/**
 * Öffentliche Portal-Statistiken
 * Grundlegende Statistiken für Dashboard ohne sensitive Daten
 */
router.get('/stats/public', async (req, res) => {
  try {
    // Verwende denselben Controller, aber markiere als öffentlichen Zugriff
    req.isPublicAccess = true;
    await getPortalStats(req, res);
  } catch (error) {
    res.status(500).json({ 
      error: 'Fehler beim Abrufen der öffentlichen Statistiken',
      timestamp: new Date().toISOString()
    });
  }
});

// ===== AUTHENTIFIZIERTE ENDPUNKTE =====

// Alle anderen monitoring Endpunkte erfordern Authentifizierung
router.use(verifyToken);

// Logging Middleware für Monitoring-Zugriffe
router.use((req, res, next) => {
  const user = req.user?.username || 'unknown';
  const endpoint = req.path;
  
  logSecurityEvent(user, 'MONITORING_ACCESS', `Zugriff auf Monitoring-Endpoint: ${endpoint}`);
  next();
});

// ===== PORTAL STATISTIKEN =====

/**
 * Umfassende Portal-Statistiken mit RBAC
 * Kombiniert LDAP-Benutzer- und VPN-Peer-Statistiken
 * 
 * GET /api/monitoring/stats
 * 
 * Response (Admin):
 * {
 *   "vpn": { "totalPeers": 150, "connectedPeers": 45, ... },
 *   "users": { "totalRegistered": 2500, "groups": {...}, ... },
 *   "summary": { "systemHealthy": true, ... },
 *   "timestamp": "2025-08-07T..."
 * }
 * 
 * Response (Regular User):
 * {
 *   "services": { "vpn": { "enabled": true }, "portal": { "enabled": true } },
 *   "personalVpn": { "hasAccess": true, "message": "..." },
 *   "summary": { "userRole": "Benutzer", "systemHealthy": true },
 *   "timestamp": "2025-08-07T..."
 * }
 */
router.get('/stats', getPortalStats);

// ===== VPN/WIREGUARD MONITORING =====

/**
 * WireGuard Service Status
 * Detaillierte Informationen über den WireGuard-Service
 * 
 * GET /api/monitoring/wireguard/status
 * 
 * Response:
 * {
 *   "success": true,
 *   "service": { "running": true, "status": "running" },
 *   "peers": { "total": 150, "connected": 45, "newToday": 3 },
 *   "serverReachable": true,
 *   "dataSource": "opnsense-api"
 * }
 */
router.get('/wireguard/status', getWireGuardServiceStatus);

/**
 * WireGuard Konfiguration
 * Ruft die komplette WireGuard-Konfiguration ab
 * 
 * GET /api/monitoring/wireguard/config
 * 
 * Response:
 * {
 *   "success": true,
 *   "config": {
 *     "general": {...},
 *     "servers": [...],
 *     "clients": [...],
 *     "service": {...}
 *   },
 *   "summary": {
 *     "serviceRunning": true,
 *     "clientCount": 150,
 *     "connectedClients": 45
 *   }
 * }
 */
router.get('/wireguard/config', getWireGuardConfig);

// ===== PERSÖNLICHE VPN-STATISTIKEN =====

/**
 * Persönliche VPN-Statistiken für authentifizierte Benutzer
 * Zeigt nur die VPN-Peers des aktuell angemeldeten Benutzers
 * 
 * GET /api/monitoring/vpn/personal
 * 
 * Response:
 * {
 *   "totalConnections": 3,
 *   "activeConnections": 2,
 *   "lastConnected": "2025-08-07T14:30:00Z",
 *   "connections": [
 *     {
 *       "id": "user-laptop-01",
 *       "deviceName": "laptop",
 *       "ipAddress": "10.88.1.15/32",
 *       "status": "connected",
 *       "platform": "Windows"
 *     }
 *   ],
 *   "username": "testuser",
 *   "limits": {
 *     "maxConnections": 5,
 *     "currentUsage": 3,
 *     "remainingSlots": 2
 *   }
 * }
 */
router.get('/vpn/personal', getPersonalVpnStats);

// ===== CIRCUIT BREAKER MANAGEMENT =====

/**
 * Circuit Breaker Status
 * Zeigt den aktuellen Status des Circuit Breakers
 * 
 * GET /api/monitoring/circuit-breaker/status
 * 
 * Response:
 * {
 *   "circuitBreaker": {
 *     "isOpen": false,
 *     "failures": 0,
 *     "timeUntilReset": 0
 *   },
 *   "serverStatus": {
 *     "reachable": true,
 *     "host": "vpn.hnee.de"
 *   },
 *   "apiConfiguration": {
 *     "configured": true,
 *     "timeout": 5000
 *   }
 * }
 */
router.get('/circuit-breaker/status', getCircuitBreakerStatus);

/**
 * Circuit Breaker zurücksetzen
 * Manueller Reset des Circuit Breakers (Admin-Funktion)
 * 
 * POST /api/monitoring/circuit-breaker/reset
 * 
 * Response:
 * {
 *   "message": "Circuit Breaker erfolgreich zurückgesetzt",
 *   "statusBefore": {...},
 *   "statusAfter": {...}
 * }
 */
router.post('/circuit-breaker/reset', (req, res, next) => {
  // Zusätzliches Logging für kritische Admin-Aktionen
  const user = req.user?.username || 'unknown';
  logSecurityEvent(user, 'CIRCUIT_BREAKER_RESET_ATTEMPT', 
    `Benutzer versucht Circuit Breaker Reset - IP: ${req.ip}`);
  next();
}, resetCircuitBreaker);

// ===== ERROR HANDLING =====

// Spezifisches Error Handling für Monitoring-Routen
router.use((error, req, res, next) => {
  console.error('❌ Fehler in Monitoring-Route:', error);
  
  // Log Security Event bei Fehlern
  const user = req.user?.username || 'unknown';
  logSecurityEvent(user, 'MONITORING_ERROR', 
    `Fehler in Monitoring-Route ${req.path}: ${error.message}`);
  
  // Strukturierte Fehlerantwort
  res.status(500).json({
    error: 'Monitoring-Fehler',
    message: 'Ein Fehler ist beim Abrufen der Monitoring-Daten aufgetreten',
    path: req.path,
    timestamp: new Date().toISOString(),
    // Debugging-Info nur in Development
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

export { router };
