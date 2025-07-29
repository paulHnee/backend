/**
 * VPN-Management Routen für HNEE IT-Service Zentrum
 * 
 * Diese Datei definiert alle API-Endpunkte für die VPN-Verwaltung.
 * Alle Routen erfordern eine gültige Authentifizierung und implementieren
 * rollenbasierte Zugriffskontrolle für verschiedene VPN-Funktionen.
 * 
 * Endpunkte:
 * - GET /api/vpn/connections - Benutzer-VPN-Verbindungen abrufen
 * - POST /api/vpn/connections - Neue VPN-Verbindung erstellen
 * - GET /api/vpn/connections/:id/config - VPN-Konfiguration herunterladen
 * - DELETE /api/vpn/connections/:id - VPN-Verbindung löschen
 * - GET /api/vpn/stats - VPN-Statistiken (nur IT-Mitarbeiter)
 * 
 * Sicherheit:
 * - Alle Routen erfordern gültige JWT-Authentifizierung
 * - Rollenbasierte Zugriffskontrolle
 * - Input-Validierung und Sanitization
 * - Rate-Limiting für VPN-Erstellung
 * - Audit-Logging für alle VPN-Aktionen
 * 
 * @author Paul Buchwald
 * @version 1.0.0
 */

import express from 'express';
import { 
  getUserVPNConnections,
  createVPNConnection,
  downloadVPNConfig,
  deleteVPNConnection,
  getVPNStats
} from '../controllers/vpnController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

// Router-Instanz erstellen
export const router = express.Router();

/**
 * VPN-Verbindungen des aktuellen Benutzers abrufen
 * GET /api/vpn/connections
 * 
 * Gibt alle VPN-Verbindungen des authentifizierten Benutzers zurück,
 * einschließlich Status, IP-Adressen und Nutzungsstatistiken.
 * 
 * Authentifizierung: JWT-Token erforderlich
 * Berechtigung: Alle authentifizierten Benutzer
 * 
 * Response:
 * {
 *   "success": true,
 *   "connections": [...],
 *   "limit": 5,
 *   "count": 2
 * }
 */
router.get('/connections', verifyToken, getUserVPNConnections);

/**
 * Neue VPN-Verbindung erstellen
 * POST /api/vpn/connections
 * 
 * Erstellt eine neue VPN-Verbindung für den authentifizierten Benutzer.
 * Validiert den öffentlichen Schlüssel und prüft Benutzer-Limits.
 * 
 * Authentifizierung: JWT-Token erforderlich
 * Berechtigung: Alle authentifizierten Benutzer (mit Limits)
 * 
 * Request Body:
 * {
 *   "name": "Mein Laptop",
 *   "publicKey": "ssh-rsa AAAAB3NzaC1yc2E...",
 *   "keyType": "ssh" | "wireguard" | "auto"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "connection": {
 *     "id": "uuid",
 *     "name": "Mein Laptop",
 *     "status": "pending",
 *     "ipAddress": "10.8.0.5",
 *     "createdAt": "2024-07-28T..."
 *   }
 * }
 */
router.post('/connections', verifyToken, createVPNConnection);

/**
 * VPN-Konfigurationsdatei herunterladen
 * GET /api/vpn/connections/:id/config
 * 
 * Generiert und liefert die WireGuard-Konfigurationsdatei für eine
 * bestimmte VPN-Verbindung des authentifizierten Benutzers.
 * 
 * Authentifizierung: JWT-Token erforderlich
 * Berechtigung: Nur Eigentümer der VPN-Verbindung
 * 
 * Parameter:
 * - id: UUID der VPN-Verbindung
 * 
 * Response: WireGuard-Konfigurationsdatei (.conf)
 * Content-Type: text/plain
 * Content-Disposition: attachment; filename="hnee-vpn-{id}.conf"
 */
router.get('/connections/:id/config', verifyToken, downloadVPNConfig);

/**
 * VPN-Verbindung löschen
 * DELETE /api/vpn/connections/:id
 * 
 * Löscht eine VPN-Verbindung und entfernt sie vom WireGuard-Server.
 * Nur der Eigentümer der Verbindung kann sie löschen.
 * 
 * Authentifizierung: JWT-Token erforderlich
 * Berechtigung: Nur Eigentümer der VPN-Verbindung
 * 
 * Parameter:
 * - id: UUID der VPN-Verbindung
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "VPN-Verbindung erfolgreich gelöscht"
 * }
 */
router.delete('/connections/:id', verifyToken, deleteVPNConnection);

/**
 * VPN-Server-Statistiken abrufen
 * GET /api/vpn/stats
 * 
 * Liefert umfassende Statistiken über den VPN-Server und alle
 * Verbindungen. Nur für IT-Mitarbeiter verfügbar.
 * 
 * Authentifizierung: JWT-Token erforderlich
 * Berechtigung: Nur IT-Mitarbeiter (isITEmployee: true)
 * 
 * Response:
 * {
 *   "success": true,
 *   "stats": {
 *     "totalConnections": 156,
 *     "activeConnections": 89,
 *     "usersByRole": {...},
 *     "dataTransfer": {...},
 *     "serverLoad": {...}
 *   }
 * }
 */
router.get('/stats', verifyToken, getVPNStats);

/**
 * Alle VPN-Verbindungen für Administratoren
 * GET /api/vpn/admin/connections
 * 
 * Liefert alle VPN-Verbindungen aller Benutzer für administrative Zwecke.
 * Nur für IT-Mitarbeiter verfügbar.
 * 
 * Authentifizierung: JWT-Token erforderlich
 * Berechtigung: Nur IT-Mitarbeiter (isITEmployee: true)
 * 
 * Query Parameters (optional):
 * - user: Filter nach Benutzername
 * - status: Filter nach Verbindungsstatus
 * - limit: Anzahl der Ergebnisse pro Seite
 * - offset: Startposition für Paginierung
 * 
 * Response:
 * {
 *   "success": true,
 *   "connections": [...],
 *   "total": 156,
 *   "page": 1,
 *   "limit": 50
 * }
 */
router.get('/admin/connections', verifyToken, async (req, res) => {
  try {
    // Berechtigung prüfen
    if (!req.user.isITEmployee) {
      return res.status(403).json({
        success: false,
        error: 'Administrative Berechtigung erforderlich'
      });
    }
    
    // Query-Parameter extrahieren
    const { user, status, limit = 50, offset = 0 } = req.query;
    
    // Mock-Daten für alle VPN-Verbindungen
    const allConnections = [
      {
        id: '1',
        userId: 'user1',
        username: 'student1',
        userRole: 'Student',
        name: 'Laptop',
        ipAddress: '10.8.0.2',
        status: 'active',
        createdAt: '2024-01-15T10:00:00Z',
        lastConnected: '2024-07-28T14:30:00Z',
        dataTransferred: '245000000'
      },
      {
        id: '2',
        userId: 'user2',
        username: 'mitarbeiter1',
        userRole: 'Mitarbeiter',
        name: 'Homeoffice PC',
        ipAddress: '10.8.0.3',
        status: 'inactive',
        createdAt: '2024-02-20T09:15:00Z',
        lastConnected: '2024-07-25T16:45:00Z',
        dataTransferred: '89000000'
      }
    ];
    
    // Filter anwenden (in Produktion: SQL-Query)
    let filteredConnections = allConnections;
    
    if (user) {
      filteredConnections = filteredConnections.filter(conn => 
        conn.username.toLowerCase().includes(user.toLowerCase())
      );
    }
    
    if (status) {
      filteredConnections = filteredConnections.filter(conn => 
        conn.status === status
      );
    }
    
    // Paginierung anwenden
    const paginatedConnections = filteredConnections.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );
    
    res.json({
      success: true,
      connections: paginatedConnections,
      total: filteredConnections.length,
      page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Admin-VPN-Verbindungen:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der VPN-Verbindungen'
    });
  }
});
