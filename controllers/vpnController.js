/**
 * VPN-Management Controller für HNEE IT-Service Zentrum
 * 
 * Dieser Controller implementiert die Backend-Logik für die VPN-Verwaltung.
 * Er bietet Endpunkte für die Erstellung, Verwaltung und Konfiguration von
 * VPN-Verbindungen mit rollenbasierten Limits und Sicherheitsvalidierung.
 * 
 * Features:
 * - VPN-Verbindungen erstellen und verwalten
 * - Public Key Validierung (SSH und WireGuard)
 * - Rollenbasierte Limits (Studenten: 5, Mitarbeiter: 7, IT: unbegrenzt)
 * - WireGuard-Konfigurationsgenerierung
 * - VPN-Status und Monitoring
 * - Sichere Schlüsselverwaltung
 * 
 * Sicherheitsaspekte:
 * - Eingabevalidierung für Public Keys
 * - Benutzerauthentifizierung erforderlich
 * - Rollenbasierte Zugriffskontrolle
 * - Audit-Logging für VPN-Aktionen
 * - Rate-Limiting für VPN-Erstellung
 * 
 * WireGuard Integration:
 * - Automatische Schlüsselpaar-Generierung
 * - Konfigurationsdatei-Erstellung
 * - IP-Adressenverwaltung im VPN-Subnetz
 * - Peer-Management
 * 
 * @author Paul Buchwald
 * @version 1.0.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logSecurityEvent } from '../utils/securityLogger.js';
import { getOPNsenseAPI } from '../config/opnsense.js';

// Promisify exec für async/await
const execAsync = promisify(exec);

/**
 * VPN-Limits basierend auf Benutzerrollen
 */
const getVPNLimitForUser = (user) => {
  // Debug-Ausgabe für Benutzerrollen
  console.log(`🔍 VPN-Limit-Check für Benutzer: ${user.username}`);
  console.log(`   - isITEmployee: ${user.isITEmployee}`);
  console.log(`   - isEmployee: ${user.isEmployee}`);
  console.log(`   - isStudent: ${user.isStudent}`);
  console.log(`   - Gruppen: ${user.groups ? user.groups.join(', ') : 'keine'}`);
  
  if (user.isITEmployee) return -1; // Unbegrenzt für IT-Mitarbeiter
  if (user.isEmployee) return 7;    // 7 für Mitarbeiter
  if (user.isStudent) return 5;     // 5 für Studenten
  
  // Fallback: Geben Sie authentifizierten Benutzern zumindest ein Basic-Limit
  if (user.username) {
    console.log(`⚠️ Benutzer ${user.username} hat keine spezifische Rolle, gebe Basic-Limit (3 Verbindungen)`);
    return 3; // Basic-Limit für alle authentifizierten Benutzer
  }
  
  return 0; // Keine Berechtigung für nicht-authentifizierte Benutzer
};

/**
 * WireGuard Public Key validieren
 * Akzeptiert nur WireGuard Public Keys (Base64, 44 Zeichen)
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
 * WireGuard Schlüsselpaar generieren
 */
const generateWireGuardKeyPair = async () => {
  try {
    // Private Key generieren
    const { stdout: privateKey } = await execAsync('wg genkey');
    
    // Public Key aus Private Key ableiten
    const { stdout: publicKey } = await execAsync(`echo "${privateKey.trim()}" | wg pubkey`);
    
    return {
      privateKey: privateKey.trim(),
      publicKey: publicKey.trim()
    };
  } catch (error) {
    console.error('Fehler beim Generieren der WireGuard-Schlüssel:', error);
    throw new Error('Schlüsselgenerierung fehlgeschlagen');
  }
};

/**
 * Nächste verfügbare IP-Adresse im VPN-Subnetz finden
 */
const getNextAvailableIP = async () => {
  try {
    console.log('🔍 Suche verfügbare IP-Adresse im VPN-Subnetz...');
    
    // Verwendete IP-Adressen aus OPNsense abrufen
    const usedIPs = await getUsedIPAddresses();
    console.log(`📊 Verwendete IPs: ${usedIPs.length}`);
    
    // Standard-VPN-Subnetz für HNEE
    const subnet = '10.88.1'; // Basierend auf der echten OPNsense-Konfiguration
    
    // Suche verfügbare IP im Bereich 10.88.1.2 - 10.88.1.254
    for (let i = 2; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      if (!usedIPs.includes(ip)) {
        console.log(`✅ Verfügbare IP gefunden: ${ip}`);
        return ip;
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
 * VPN-Verbindungen für Benutzer aus OPNsense abrufen
 * Filtert WireGuard-Clients nach Benutzer-Pattern "username-*"
 */
const getUserVPNFiles = async (username) => {
  try {
    console.log(`🔍 Lade VPN-Peers für Benutzer: ${username}`);
    
    const opnsense = getOPNsenseAPI();
    const allClients = await opnsense.getClients();
    
    console.log(`📊 Gefundene Clients insgesamt: ${allClients.length}`);
    
    // Filter nur Clients des aktuellen Benutzers (username-*)
    const pattern = `${username}-`;
    const userClients = allClients.filter(client => 
      client.name && client.name.toLowerCase().startsWith(pattern.toLowerCase())
    );
    
    console.log(`👤 Gefundene Clients für ${username}: ${userClients.length}`);
    
    const connections = [];
    for (const client of userClients) {
      // Device-Name extrahieren (entferne "username-" Prefix)
      const deviceName = client.name.replace(new RegExp(`^${username}-`, 'i'), '');
      
      // Status-Bestimmung basierend auf verschiedenen API-Feldern
      let status = 'inactive';
      let lastConnected = null;
      
      if (client.enabled === '1' || client.enabled === true) {
        status = 'active';
      }
      
      // Verbindungsstatus aus verschiedenen möglichen Feldern
      if (client.connected === '1' || client.connected === true || client.status === 'connected') {
        status = 'connected';
        lastConnected = client.last_handshake || client.lastHandshake || new Date().toISOString();
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
      
      const connection = {
        id: client.uuid || crypto.randomUUID(),
        name: deviceName,
        fullName: client.name, // Vollständiger Name für Debugging
        filename: `${client.name}.conf`,
        status: status,
        enabled: client.enabled === '1' || client.enabled === true,
        createdAt: client.created || client.created_at || new Date().toISOString(),
        lastConnected: lastConnected,
        ipAddress: ipAddress,
        platform: detectPlatform(deviceName),
        publicKey: client.pubkey || client.public_key || '',
        tunnelAddress: ipAddress,
        servers: client.servers || '',
        comment: client.comment || '',
        // Zusätzliche Debug-Informationen
        rawClient: process.env.NODE_ENV === 'development' ? client : undefined
      };
      
      connections.push(connection);
    }
    
    console.log(`✅ VPN-Verbindungen für ${username} erfolgreich geladen: ${connections.length}`);
    
    return connections;
  } catch (error) {
    console.error(`❌ Fehler beim Abrufen der VPN-Verbindungen von OPNsense für ${username}:`, error.message);
    // Fallback auf leeres Array bei API-Fehlern
    return [];
  }
};

/**
 * Plattform basierend auf Device-Namen erkennen
 */
const detectPlatform = (deviceName) => {
  const name = deviceName.toLowerCase();
  if (name.includes('iphone') || name.includes('ipad') || name.includes('ios')) return 'ios';
  if (name.includes('android') || name.includes('phone')) return 'android';
  if (name.includes('mac') || name.includes('macbook')) return 'macos';
  if (name.includes('windows') || name.includes('pc') || name.includes('laptop')) return 'windows';
  return 'linux';
};

/**
 * VPN-Verbindungen für Benutzer abrufen
 * GET /api/vpn/connections
 */
export const getUserVPNConnections = async (req, res) => {
  try {
    const username = req.user.username;
    
    console.log(`📡 API-Aufruf: VPN-Verbindungen für Benutzer ${username}`);
    
    // VPN-Peers des Benutzers aus OPNsense abrufen
    const connections = await getUserVPNFiles(username);
    const userLimit = getVPNLimitForUser(req.user);
    
    // Zusätzliche Statistiken berechnen
    const activeCount = connections.filter(conn => conn.status === 'active' || conn.enabled).length;
    const connectedCount = connections.filter(conn => conn.status === 'connected').length;
    
    // Audit-Log
    logSecurityEvent(username, 'VIEW_VPN_CONNECTIONS', 
      `VPN-Verbindungen abgerufen: ${connections.length} total, ${activeCount} aktiv, ${connectedCount} verbunden`);
    
    console.log(`✅ VPN-Verbindungen für ${username} erfolgreich geladen: ${connections.length} total, ${activeCount} aktiv`);
    
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
 * Neue VPN-Verbindung erstellen
 * POST /api/vpn/connections
 */
export const createVPNConnection = async (req, res) => {
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
    
    // OPNsense API-Client abrufen
    const opnsense = getOPNsenseAPI();
    
    // Client-Name für OPNsense
    const clientName = `${username}-${name.trim().replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // IP-Adresse aus verfügbarem Pool zuweisen
    const assignedIP = await getNextAvailableIP();
    
    // WireGuard-Client in OPNsense erstellen
    const clientData = {
      enabled: '1',
      name: clientName,
      public_key: publicKey.trim(),
      tunnel_addresses: `${assignedIP}/32`,
      server_address: '', // Server bestimmt automatisch
      server_port: '',
      keepalive: '25',
      comment: `${platform} - ${new Date().toISOString()}`
    };
    
    console.log(`🔧 Erstelle WireGuard-Client in OPNsense: ${clientName}`);
    
    const createResponse = await opnsense.createClient(clientData);
    
    if (!createResponse.result || createResponse.result !== 'saved') {
      throw new Error(`OPNsense Client-Erstellung fehlgeschlagen: ${JSON.stringify(createResponse)}`);
    }
    
    // WireGuard-Konfiguration neu laden
    await opnsense.reconfigure();
    
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
    
    // Audit-Log
    console.log(`✅ WireGuard-Verbindung erfolgreich erstellt: ${clientName} (${assignedIP})`);
    
    logSecurityEvent(username, 'CREATE_VPN_CONNECTION', 
      `WireGuard-Verbindung erstellt: ${clientName} auf ${platform}`);
    
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
 * VPN-Konfiguration herunterladen
 * GET /api/vpn/connections/:id/config
 */
export const downloadVPNConfig = async (req, res) => {
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
    const config = `[Interface]
# HNEE WireGuard VPN - ${connection.name}
# User: ${username}
# Generated: ${new Date().toISOString()}
PrivateKey = YOUR_PRIVATE_KEY_HERE
Address = ${connection.ipAddress}
DNS = 10.8.0.1, 1.1.1.1

[Peer]
# HNEE VPN Server
PublicKey = ${status.server_public_key || 'SERVER_PUBLIC_KEY_FROM_OPNSENSE'}
Endpoint = ${process.env.OPNSENSE_HOST || 'vpn.hnee.de'}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25

# Anweisungen:
# 1. Ersetzen Sie YOUR_PRIVATE_KEY_HERE mit Ihrem WireGuard Private Key
# 2. Dieser Key gehört zu Ihrem Public Key: ${connection.publicKey}
# 3. Speichern Sie diese Datei als ${connection.filename}
# 4. Importieren Sie die Konfiguration in Ihren WireGuard-Client
`;
    
    // Audit-Log
    console.log(`📥 VPN-Konfiguration heruntergeladen: ${connection.filename} von ${username}`);
    
    logSecurityEvent(username, 'DOWNLOAD_VPN_CONFIG', 
      `VPN-Konfiguration heruntergeladen: ${connection.filename}`);
    
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
 * VPN-Verbindung löschen
 * DELETE /api/vpn/connections/:id
 */
export const deleteVPNConnection = async (req, res) => {
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
    
    console.log(`🗑️ Lösche WireGuard-Client: ${connection.filename}`);
    
    // Client in OPNsense löschen
    await opnsense.deleteClient(id);
    
    // WireGuard-Konfiguration neu laden
    await opnsense.reconfigure();
    
    // Audit-Log
    console.log(`✅ WireGuard-Verbindung erfolgreich gelöscht: ${connection.filename}`);
    
    logSecurityEvent(username, 'DELETE_VPN_CONNECTION', 
      `WireGuard-Verbindung gelöscht: ${connection.filename}`);
    
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
 * VPN-Statistiken für Administratoren
 * GET /api/vpn/stats
 */
export const getVPNStats = async (req, res) => {
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

/**
 * VPN-Konfiguration für verschiedene Plattformen generieren
 * GET /api/vpn/config
 */
export const generateVpnConfig = async (req, res) => {
  try {
    const username = req.user?.username || 'unknown';
    const { platform = 'windows' } = req.query;

    console.log(`🔐 VPN-Konfiguration für ${username}, Plattform: ${platform}`);

    // Unterstützte Plattformen
    const supportedPlatforms = ['windows', 'macos', 'linux', 'ios', 'android'];
    
    if (!supportedPlatforms.includes(platform)) {
      return res.status(400).json({
        error: 'Unbekannte Plattform',
        supportedPlatforms: supportedPlatforms
      });
    }

    // Plattform-spezifische Konfiguration
    const platformConfigs = {
      windows: {
        filename: `${username}-windows.conf`,
        instructions: [
          'WireGuard für Windows herunterladen: https://www.wireguard.com/install/',
          'Konfigurationsdatei importieren',
          'Tunnel aktivieren'
        ]
      },
      macos: {
        filename: `${username}-macos.conf`,
        instructions: [
          'WireGuard für macOS herunterladen: https://apps.apple.com/app/wireguard/id1451685025',
          'Konfigurationsdatei importieren',
          'Tunnel aktivieren'
        ]
      },
      linux: {
        filename: `${username}-linux.conf`,
        instructions: [
          'WireGuard installieren: sudo apt install wireguard',
          'Konfiguration nach /etc/wireguard/ kopieren',
          'Starten: sudo wg-quick up [filename]'
        ]
      },
      ios: {
        filename: `${username}-ios.conf`,
        instructions: [
          'WireGuard iOS App installieren',
          'QR-Code scannen oder Datei importieren',
          'VPN aktivieren'
        ]
      },
      android: {
        filename: `${username}-android.conf`,
        instructions: [
          'WireGuard Android App installieren',
          'QR-Code scannen oder Datei importieren',
          'VPN aktivieren'
        ]
      }
    };

    const config = platformConfigs[platform];

    logSecurityEvent(username, 'GENERATE_VPN_CONFIG', 
      `VPN-Konfiguration generiert für Plattform: ${platform}`);

    res.json({
      success: true,
      platform: platform,
      config: {
        filename: config.filename,
        instructions: config.instructions,
        downloadUrl: `/api/vpn/download/${username}/${platform}`,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        note: 'Erstellen Sie zuerst eine VPN-Verbindung mit Ihrem WireGuard Public Key'
      },
      supportedPlatforms: supportedPlatforms,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler bei VPN-Konfiguration:', error);
    res.status(500).json({ 
      error: 'Fehler beim Generieren der VPN-Konfiguration',
      details: error.message
    });
  }
};

// ===== HELPER FUNCTIONS =====

/**
 * WireGuard-Konfigurationsdatei generieren
 */
function generateWireGuardConfig(username, deviceName, clientIP, clientPublicKey, serverPublicKey) {
  return `[Interface]
# HNEE WireGuard VPN - ${deviceName}
# User: ${username}
# Generated: ${new Date().toISOString()}
PrivateKey = YOUR_PRIVATE_KEY_HERE
Address = ${clientIP}/24
DNS = 10.8.0.1, 1.1.1.1

[Peer]
# HNEE VPN Server
PublicKey = ${serverPublicKey}
Endpoint = vpn.hnee.de:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25

# Hinweise:
# 1. Ersetzen Sie YOUR_PRIVATE_KEY_HERE mit Ihrem WireGuard Private Key
# 2. Dieser Key gehört zu Ihrem Public Key: ${clientPublicKey}
# 3. Speichern Sie diese Datei als ${username}-${deviceName}.conf
# 4. Importieren Sie die Konfiguration in Ihren WireGuard-Client
`;
}

/**
 * Verwendete IP-Adressen aus OPNsense abrufen
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
        // Extrahiere IP aus "10.88.1.5/32" Format
        const ip = tunnelAddress.split('/')[0];
        if (ip && ip.startsWith('10.88.1.')) {
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
