/**
 * VPN-Management Controller für das HNEE IT-Service Zentrum
 *
 * Dieser Controller enthält die gesamte Backend-Logik zur Verwaltung von VPN-Verbindungen.
 * Er stellt REST-API-Endpunkte bereit, um VPN-Accounts zu erstellen, zu löschen, zu konfigurieren
 * und zu überwachen. Die Implementierung ist eng mit OPNsense (Firewall/VPN-Appliance) und WireGuard
 * integriert und berücksichtigt verschiedene Benutzerrollen (Student, Mitarbeiter, IT).
 *
 * Hauptfunktionen:
 * - Erstellen, Löschen und Auflisten von VPN-Verbindungen für Benutzer (Peer-Management)
 * - Validierung und Verwaltung von WireGuard Public Keys (nur gültige Keys werden akzeptiert)
 * - Automatische Zuweisung freier IP-Adressen im VPN-Subnetz (10.88.0.0/16)
 * - Generierung von WireGuard-Konfigurationsdateien für verschiedene Plattformen
 * - Status- und Monitoring-Funktionen für Admins (z.B. letzte Handshakes, aktive Verbindungen)
 * - Audit-Logging aller sicherheitsrelevanten Aktionen (z.B. Download, Löschung, Erstellung)
 *
 * Sicherheitsaspekte:
 * - Strikte Eingabevalidierung (z.B. Public Key Format, Namenskonventionen)
 * - Authentifizierung und rollenbasierte Zugriffskontrolle für alle Endpunkte
 * - Rate-Limiting und Limitierung der maximalen Verbindungen pro Benutzerrolle
 * - Keine Speicherung von Private Keys auf dem Server (Zero-Knowledge-Prinzip)
 * - Logging aller sicherheitsrelevanten Aktionen für Nachvollziehbarkeit
 *
 * WireGuard/OPNsense-Integration:
 * - Direkte API-Kommunikation mit OPNsense zur Peer-Verwaltung
 * - Automatisches Reconfig/Restart des WireGuard-Interfaces nach Änderungen
 * - Flexible Unterstützung für verschiedene Plattformen (Windows, macOS, Linux, iOS, Android)
 *
 * @author Paul Buchwald
 * @version 1.0.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { logSecurityEvent } from '../utils/securityLogger.js';
import { logVPNEvent } from '../utils/vpnLogger.js';
import { getOPNsenseAPI } from '../config/opnsense.js';

// ===== TOTP LOGIC (imported) =====
import { requireVPNAccess } from '../utils/otpAuthenticator.js';
// (TOTP API handlers are not used directly in this controller)

// Promisify exec für async/await
const execAsync = promisify(exec);

/**
 * Ermittelt das maximale VPN-Limit für einen Benutzer basierend auf seiner Rolle.
 *
 * - IT-Mitarbeiter: unbegrenzt (-1)
 * - Mitarbeiter: 7 Verbindungen
 * - Studenten: 5 Verbindungen
 * - Sonstige authentifizierte Nutzer: 3 Verbindungen
 * - Nicht authentifiziert: 0
 *
 * @param {Object} user - Das User-Objekt mit Rolleninformationen
 * @returns {number} Maximale Anzahl an VPN-Verbindungen
 */
const getVPNLimitForUser = (user) => {
  if (user.isITEmployee) return -1; // Unbegrenzt für IT-Mitarbeiter
  if (user.isEmployee) return 7;    // 7 für Mitarbeiter
  if (user.isStudent) return 5;     // 5 für Studenten
  if (user.isGuestLecturer) return 2; // 2 für Gastdozenten
  if (user.username) {
    return 3; // Basic-Limit für alle authentifizierten Benutzer
  }
  return 0; // Keine Berechtigung für nicht-authentifizierte Benutzer
};

/**
 * Prüft, ob ein übergebener Public Key ein gültiger WireGuard Public Key ist.
 *
 * WireGuard Public Keys sind immer 44 Zeichen lang (Base64, endet mit '=')
 *
 * @param {string} publicKey - Der zu prüfende Public Key
 * @returns {Object} { valid: boolean, type: string|null }
 */
const validateWireGuardKey = (publicKey) => {
  const key = publicKey.trim();
  // WireGuard Public Key Validation (Base64, 44 Zeichen)
  const wireguardKeyPattern = /^[A-Za-z0-9+/]{43}=$/;
  if (wireguardKeyPattern.test(key)) {
    return { valid: true, type: 'wireguard' };
  }
  return { valid: false, type: null };
};

/**
 * Sucht die nächste freie IP-Adresse im VPN-Subnetz (10.88.1.2 - 10.88.254.254).
 *
 * Holt alle bereits vergebenen IPs von OPNsense und gibt die erste freie zurück.
 *
 * @returns {Promise<string>} Die nächste verfügbare IP-Adresse
 * @throws {Error} Wenn keine IP mehr frei ist
 */
const getNextAvailableIP = async () => {
  try {
    const usedIPs = await getUsedIPAddresses();
    // Suche verfügbare IP im Bereich 10.88.1.2 - 10.88.254.254
    for (let octet3 = 1; octet3 <= 254; octet3++) {
      for (let octet4 = 2; octet4 <= 254; octet4++) {
        const ip = `10.88.${octet3}.${octet4}`;
        if (!usedIPs.includes(ip)) {
          return ip;
        }
      }
    }
    console.error('❌ Keine verfügbaren IP-Adressen im VPN-Subnetz gefunden');
    throw new Error('Keine verfügbaren IP-Adressen im VPN-Subnetz');
  } catch (error) {
    console.error('❌ Fehler bei IP-Adresszuweisung:', error.message);
    throw error;
  }
};

/**
 * Holt alle VPN-Verbindungen (WireGuard-Clients) eines Benutzers aus OPNsense.
 *
 * Filtert alle Clients, deren Name mit "username-" beginnt. Liefert ein Array
 * mit Verbindungsobjekten inkl. Status, IP, Handshake, Plattform usw.
 *
 * @param {string} username - Der Benutzername
 * @returns {Promise<Array>} Array mit Verbindungsobjekten
 */
const getUserVPNFiles = async (username) => {
  try {
    const opnsense = getOPNsenseAPI();
    const allClients = await opnsense.getClients();
    // Filter nur Clients des aktuellen Benutzers (username-*)
    const pattern = `${username}-`;
    const userClients = allClients.filter(client => 
      client.name && client.name.toLowerCase().startsWith(pattern.toLowerCase())
    );
    const connections = [];
    for (const client of userClients) {
      // Device-Name extrahieren (entferne "username-" Prefix)
      const deviceName = client.name.replace(new RegExp(`^${username}-`, 'i'), '');
      // Status-Bestimmung basierend auf verschiedenen API-Feldern
      let status = 'inactive';
      let lastConnected = null;
      // Nutze 'latest-handshake' (UNIX timestamp) als bevorzugte Quelle
      if (typeof client['latest-handshake'] === 'number' && client['latest-handshake'] > 0) {
        lastConnected = new Date(client['latest-handshake'] * 1000).toISOString();
      } 
      if (client.enabled === '1' || client.enabled === true) {
        status = 'active';
      }
      // Verbindungsstatus aus verschiedenen möglichen Feldern
      if (client.connected === '1' || client.connected === true || client.status === 'connected') {
        status = 'connected';
        // lastConnected bleibt wie oben bestimmt
        if (!lastConnected) lastConnected = new Date().toISOString();
      }
      // IP-Adresse aus verschiedenen möglichen Feldern extrahieren
      let ipAddress = 'Nicht zugewiesen';
      if (client.tunneladdress) {
        ipAddress = client.tunneladdress;
      } else if (client.tunnel_addresses) {
        ipAddress = client.tunnel_addresses;
      } else if (client.address) {
        ipAddress = client.address;
      }
      const latestHandshakeRaw = client['latest-handshake'];
      const latestHandshakeISO = (typeof latestHandshakeRaw === 'number') ? new Date(latestHandshakeRaw * 1000).toISOString() : null;
      const connection = {
        id: client.uuid || crypto.randomUUID(),
        name: deviceName,
        fullName: client.name, // Vollständiger Name für Debugging
        filename: `${client.name}.conf`,
        status: status,
        enabled: client.enabled === '1' || client.enabled === true,
        createdAt: client.created || client.created_at || new Date().toISOString(),
        lastConnected: latestHandshakeISO,
        ipAddress: ipAddress,
        platform: 'unknown',
        publicKey: client.pubkey || client.public_key || '',
        tunnelAddress: ipAddress,
        servers: client.servers || '',
        comment: client.comment || '',
        // Zusätzliche Debug-Informationen
        rawClient: process.env.NODE_ENV === 'development' ? client : undefined
      };
      connections.push(connection);
    }
    return connections;
  } catch (error) {
    console.error(`❌ Fehler beim Abrufen der VPN-Verbindungen von OPNsense für ${username}:`, error.message);
    // Fallback auf leeres Array bei API-Fehlern
    return [];
  }
};


/**
 * API-Handler: Gibt alle VPN-Verbindungen des angemeldeten Benutzers zurück.
 *
 * Holt die Peers aus OPNsense, berechnet Statistiken und prüft Limits.
 * Antwortet mit einer Liste der Verbindungen und Statusinfos.
 *
 * Route: GET /api/vpn/connections
 */
export const getUserVPNConnections = async (req, res) => {
  requireVPNAccess(req, res, () => {
          logVPNEvent(req, 'VIEW_VPN_CONNECTIONS', `User: ${req.user?.username}`);
          logSecurityEvent('VIEW_VPN_CONNECTIONS', req, { username: req.user?.username });
    // ...existing code...
  });
  try {
    const username = req.user.username;
    // VPN-Peers des Benutzers aus OPNsense abrufen
    const connections = await getUserVPNFiles(username);
    const userLimit = getVPNLimitForUser(req.user);
    // Zusätzliche Statistiken berechnen
    const activeCount = connections.filter(conn => conn.status === 'active' || conn.enabled).length;
    const connectedCount = connections.filter(conn => conn.status === 'connected').length;
    // Audit-Log
        logSecurityEvent('VIEW_VPN_CONNECTIONS', req, {
          username,
          total: connections.length,
          active: activeCount,
          connected: connectedCount
        });
    res.json({
      success: true,
      connections: connections,
      stats: {
        total: connections.length,
        active: activeCount,
        connected: connectedCount,
        inactive: connections.length - activeCount
      },
      limit: userLimit,
      count: connections.length,
      canCreateMore: userLimit === -1 || connections.length < userLimit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Fehler beim Abrufen der VPN-Verbindungen für ${req.user?.username}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der VPN-Verbindungen',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * API-Handler: Erstellt eine neue VPN-Verbindung für den angemeldeten Benutzer.
 *
 * Validiert Eingaben, prüft Limits, prüft auf Duplikate, weist eine freie IP zu
 * und legt den Peer via OPNsense API an. Startet das Interface neu.
 *
 * Route: POST /api/vpn/connections
 */
export const createVPNConnection = async (req, res) => {
  requireVPNAccess(req, res, () => {
          logVPNEvent(req, 'CREATE_VPN_CONNECTION', `User: ${req.user?.username}, Name: ${req.body.name}`);
          logSecurityEvent('CREATE_VPN_CONNECTION', req, { username: req.user?.username, name: req.body.name });
    // ...existing code...
  });
  try {
    const { name, publicKey, platform = 'windows' } = req.body;
    const user = req.user;
    const username = user.username;
    // Eingabevalidierung
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Verbindungsname ist erforderlich'
      });
    }
    if (!publicKey || !publicKey.trim()) {
      return res.status(400).json({
        success: false,
        error: 'WireGuard Public Key ist erforderlich'
      });
    }
    // Nur WireGuard Keys akzeptieren
    const keyValidation = validateWireGuardKey(publicKey);
    if (!keyValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Ungültiger WireGuard Public Key (muss 44 Zeichen Base64 sein)'
      });
    }
    // Plattform validieren
    const supportedPlatforms = ['windows', 'macos', 'linux', 'ios', 'android'];
    if (!supportedPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: `Plattform nicht unterstützt. Verfügbar: ${supportedPlatforms.join(', ')}`
      });
    }
    // Aktuelle VPN-Verbindungen prüfen
    const existingConnections = await getUserVPNFiles(username);
    const userLimit = getVPNLimitForUser(user);
    if (userLimit !== -1 && existingConnections.length >= userLimit) {
      return res.status(400).json({
        success: false,
        error: `VPN-Limit erreicht: ${userLimit} Verbindungen maximal`
      });
    }
    // Client-Name für OPNsense
    const clientName = `${username}-${name.trim().replace(/[^a-zA-Z0-9]/g, '_')}`;
    // Check for duplicate client name or public key before creation
    const opnsense = getOPNsenseAPI();
    const allClients = await opnsense.getClients();
    // Check for duplicate name (case-insensitive)
    const duplicateName = allClients.find(client => client.name && client.name.toLowerCase() === clientName.toLowerCase());
    if (duplicateName) {
      return res.status(400).json({
        success: false,
        error: `Der Verbindungsname '${clientName}' ist bereits vergeben. Bitte wählen Sie einen anderen Namen.`
      });
    }
    // Check for duplicate public key (pubkey or public_key)
    const duplicateKey = allClients.find(client => {
      const key = client.pubkey || client.public_key;
      return key && key.trim() === publicKey.trim();
    });
    if (duplicateKey) {
      return res.status(400).json({
        success: false,
        error: 'Der angegebene WireGuard Public Key ist bereits in Benutzung. Bitte verwenden Sie einen neuen Key.'
      });
    }
    // IP-Adresse aus verfügbarem Pool zuweisen
    const assignedIP = await getNextAvailableIP();
    // WireGuard-Client in OPNsense erstellen
    const clientData = {
      enabled: '1',
      name: clientName,
      pubkey: publicKey.trim(),
      tunneladdress: `${assignedIP}/32`,
      servers: '563254ff-299a-45bd-bb7a-64cb9bef6f6b'
    };
    const apiPayload = {
      client: clientData
    };
    let createResponse;
    try {
      createResponse = await opnsense.createClient(apiPayload);
    } catch (apiError) {
      // Log the payload and error for diagnostics
      console.error('❌ OPNsense API createClient() failed:', {
        payload: apiPayload,
        error: apiError && apiError.message ? apiError.message : apiError
      });
      return res.status(500).json({
        success: false,
        error: 'Fehler beim Erstellen des WireGuard-Clients (API-Fehler)',
        details: apiError && apiError.message ? apiError.message : apiError,
        payload: apiPayload
      });
    }
    if (!createResponse.result || createResponse.result !== 'saved') {
      // Log the payload and full response for diagnostics
      console.error('❌ OPNsense Client-Erstellung fehlgeschlagen:', {
        payload: apiPayload,
        response: createResponse
      });
      return res.status(500).json({
        success: false,
        error: 'OPNsense Client-Erstellung fehlgeschlagen',
        response: createResponse,
        payload: apiPayload
      });
    }
    // WireGuard-Konfiguration neu laden und Interface neu starten
    await opnsense.reconfigure();
    await opnsense.restartInterface();
    const newConnection = {
      id: createResponse.uuid || crypto.randomUUID(),
      name: name.trim(),
      filename: `${clientName}.conf`,
      platform: platform,
      ipAddress: assignedIP,
      status: 'active',
      createdAt: new Date().toISOString(),
      publicKey: publicKey.trim()
    };
        logSecurityEvent('CREATE_VPN_CONNECTION', req, {
          username,
          clientName,
          platform,
          assignedIP
        });
    res.status(201).json({
      success: true,
      connection: newConnection,
      message: `WireGuard-Verbindung ${clientName} erfolgreich erstellt`
    });
  } catch (error) {
    console.error('❌ Fehler beim Erstellen der VPN-Verbindung:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Erstellen der VPN-Verbindung',
      details: error.message
    });
  }
};

/**
 * API-Handler: Generiert und liefert die WireGuard-Konfigurationsdatei für eine Verbindung.
 *
 * Prüft Besitz und Status, holt Serverdaten und gibt die Konfiguration als Download zurück.
 *
 * Route: GET /api/vpn/connections/:id/config
 */
export const downloadVPNConfig = async (req, res) => {
  requireVPNAccess(req, res, () => {
          logVPNEvent(req, 'DOWNLOAD_VPN_CONFIG', `User: ${req.user?.username}, ConnectionId: ${req.params.id}`);
          logSecurityEvent('DOWNLOAD_VPN_CONFIG', req, { username: req.user?.username, connectionId: req.params.id });
    // ...existing code...
  });
  try {
    const { id } = req.params;
    const username = req.user.username;
    // VPN-Verbindungen des Benutzers abrufen
    const connections = await getUserVPNFiles(username);
    const connection = connections.find(conn => conn.id === id);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'VPN-Verbindung nicht gefunden'
      });
    }
    if (connection.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'VPN-Verbindung ist nicht aktiv'
      });
    }
    // OPNsense API für Server-Details abrufen
    const opnsense = getOPNsenseAPI();
    const status = await opnsense.getStatus();
    // WireGuard-Konfiguration generieren
    const config = `
Address = ${connection.ipAddress}
DNS = 10.1.1.24, 10.1.1.5
MTU = 1280

[Peer]
PublicKey = ${status.server_public_key || 'vK/0hCkyTSIBk5nyin69Q3wdgrxzrruOw43Qj/thMy8='}
Endpoint = vpn.hnee.de:51820
AllowedIPs = 0.0.0.0/0

# HNEE WireGuard VPN - ${connection.name}
# User: ${username}
# Importieren Sie die Konfiguration in Ihren WireGuard-Client
`;
        logVPNEvent(req, 'DOWNLOAD_VPN_CONFIG', `VPN-Konfiguration heruntergeladen: ${connection.filename}`);
        logSecurityEvent('DOWNLOAD_VPN_CONFIG', req, {
          username,
          filename: connection.filename,
          connectionId: id
        });
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${connection.filename}"`);
    res.send(config);
  } catch (error) {
    console.error('❌ Fehler beim Generieren der VPN-Konfiguration:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Generieren der VPN-Konfiguration',
      details: error.message
    });
  }
};

/**
 * API-Handler: Löscht eine VPN-Verbindung (Peer) für den angemeldeten Benutzer.
 *
 * Prüft Besitz, löscht Peer via OPNsense API, startet Interface neu und loggt die Aktion.
 *
 * Route: DELETE /api/vpn/connections/:id
 */
export const deleteVPNConnection = async (req, res) => {
  requireVPNAccess(req, res, () => {
          logVPNEvent(req, 'DELETE_VPN_CONNECTION', `User: ${req.user?.username}, ConnectionId: ${req.params.id}`);
          logSecurityEvent('DELETE_VPN_CONNECTION', req, { username: req.user?.username, connectionId: req.params.id });
    // ...existing code...
  });
  try {
    const { id } = req.params;
    const username = req.user.username;
    // Aktuelle VPN-Verbindungen abrufen
    const connections = await getUserVPNFiles(username);
    const connection = connections.find(conn => conn.id === id);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'VPN-Verbindung nicht gefunden'
      });
    }
    // OPNsense API-Client abrufen
    const opnsense = getOPNsenseAPI();
    // Client in OPNsense löschen
    await opnsense.deleteClient(id);
    // WireGuard-Konfiguration neu laden und Interface neu starten
    await opnsense.reconfigure();
    await opnsense.restartInterface();
    // Audit-Log
        logVPNEvent(req, 'DELETE_VPN_CONNECTION', `WireGuard-Verbindung gelöscht: ${connection.filename}`);
        logSecurityEvent('DELETE_VPN_CONNECTION', req, {
          username,
          filename: connection.filename,
          connectionId: id
        });
    res.json({
      success: true,
      message: `VPN-Verbindung ${connection.name} erfolgreich gelöscht`
    });
  } catch (error) {
    console.error('❌ Fehler beim Löschen der VPN-Verbindung:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Löschen der VPN-Verbindung',
      details: error.message
    });
  }
};

/**
 * API-Handler: Liefert umfassende VPN-Statistiken für IT-Admins.
 *
 * Holt alle Peers und Statusdaten von OPNsense, gruppiert nach Rollen und gibt
 * Serverstatus, Nutzerverteilung und letzte Aktivitäten zurück.
 *
 * Route: GET /api/vpn/stats
 */
export const getVPNStats = async (req, res) => {
  logVPNEvent(req, 'VIEW_VPN_STATS', `User: ${req.user?.username}`);
  try {
    // Nur für IT-Mitarbeiter verfügbar
    if (!req.user.isITEmployee) {
      return res.status(403).json({
        success: false,
        error: 'Berechtigung erforderlich'
      });
    }
    // Echte Statistiken von OPNsense abrufen
    const opnsense = getOPNsenseAPI();
    // Alle WireGuard-Clients abrufen
    const allClients = await opnsense.getClients();
    const status = await opnsense.getStatus();
    // Statistiken berechnen
    const totalConnections = allClients.length;
    const activeConnections = allClients.filter(client => client.enabled === '1').length;
    // Benutzer nach Rollen gruppieren (aus Client-Namen extrahieren)
    const usersByRole = {
      students: { connections: 0, limit: 5 },
      employees: { connections: 0, limit: 7 },
      itEmployees: { connections: 0, limit: -1 }
    };
    // Client-Namen analysieren für Rollenerkennung
    allClients.forEach(client => {
      const username = client.name ? client.name.split('-')[0] : '';
      // Vereinfachte Rollenerkennung basierend auf Username-Pattern
      if (username.includes('student') || username.includes('stud')) {
        usersByRole.students.connections++;
      } else if (username.includes('itsz') || username.includes('admin')) {
        usersByRole.itEmployees.connections++;
      } else {
        usersByRole.employees.connections++;
      }
    });
    const stats = {
      totalConnections,
      activeConnections,
      inactiveConnections: totalConnections - activeConnections,
      usersByRole,
      serverStatus: {
        running: status.running || false,
        uptime: status.uptime || 'Unknown',
        version: status.version || 'Unknown'
      },
      recentActivity: allClients.slice(0, 10).map(client => ({
        name: client.name,
        lastHandshake: client.last_handshake || 'Never',
        tunnelAddress: client.tunnel_addresses || 'Not assigned',
        enabled: client.enabled === '1'
      }))
    };
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der VPN-Statistiken:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der VPN-Statistiken',
      details: error.message
    });
  }
};

// ===== HILFSFUNKTIONEN =====

/**
 * Holt alle aktuell verwendeten IP-Adressen aus OPNsense (Peers).
 *
 * Prüft verschiedene Felder für die IP, reserviert Server-IP und gibt ein Array
 * aller belegten Adressen zurück. Bei Fehlern Fallback auf Standard-IPs.
 *
 * @returns {Promise<Array<string>>} Array belegter IP-Adressen
 */
const getUsedIPAddresses = async () => {
  try {
    console.log('🔍 Lade verwendete IP-Adressen aus OPNsense...');
    const opnsense = getOPNsenseAPI();
    const clients = await opnsense.getClients();
    // Server-IP und Gateway reservieren
    const usedIPs = ['10.88.1.1']; // Server-IP reserviert
    clients.forEach(client => {
      // Verschiedene Feldnamen für IP-Adressen prüfen
      let tunnelAddress = null;
      if (client.tunneladdress) {
        tunnelAddress = client.tunneladdress;
      } else if (client.tunnel_addresses) {
        tunnelAddress = client.tunnel_addresses;
      } else if (client.address) {
        tunnelAddress = client.address;
      }
      if (tunnelAddress) {
        // Extrahiere IP aus "10.88.x.x/32" Format
        const ip = tunnelAddress.split('/')[0];
        if (ip && ip.startsWith('10.88.')) {
          usedIPs.push(ip);
        }
      }
    });
    console.log(`✅ Verwendete IP-Adressen geladen: ${usedIPs.length} (${usedIPs.slice(0, 5).join(', ')}...)`);
    return usedIPs;
  } catch (error) {
    console.error('❌ Fehler beim Abrufen verwendeter IPs:', error.message);
    // Fallback auf Standard-IPs
    const fallbackIPs = ['10.88.1.1', '10.88.1.2', '10.88.1.3'];
    console.log(`⚠️ Fallback auf Standard-IPs: ${fallbackIPs.join(', ')}`);
    return fallbackIPs;
  }
};
