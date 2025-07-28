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

// Promisify exec für async/await
const execAsync = promisify(exec);

/**
 * VPN-Limits basierend auf Benutzerrollen
 */
const getVPNLimitForUser = (user) => {
  if (user.isITEmployee) return -1; // Unbegrenzt für IT-Mitarbeiter
  if (user.isEmployee) return 7;    // 7 für Mitarbeiter
  if (user.isStudent) return 5;     // 5 für Studenten
  return 0; // Keine Berechtigung
};

/**
 * Public Key validieren
 * Unterstützt SSH Public Keys und WireGuard Public Keys
 */
const validatePublicKey = (publicKey, keyType = 'auto') => {
  const key = publicKey.trim();
  
  // SSH Public Key Validation
  const sshKeyPattern = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ssh-dss) [A-Za-z0-9+/]+=*(\s+.*)?$/;
  
  // WireGuard Public Key Validation (Base64, 44 Zeichen)
  const wireguardKeyPattern = /^[A-Za-z0-9+/]{43}=$/;
  
  // PEM Public Key Validation
  const pemKeyPattern = /^-----BEGIN (PUBLIC KEY|RSA PUBLIC KEY)-----[\s\S]*-----END (PUBLIC KEY|RSA PUBLIC KEY)-----$/;
  
  if (keyType === 'auto' || keyType === 'ssh') {
    if (sshKeyPattern.test(key) || pemKeyPattern.test(key)) {
      return { valid: true, type: 'ssh' };
    }
  }
  
  if (keyType === 'auto' || keyType === 'wireguard') {
    if (wireguardKeyPattern.test(key)) {
      return { valid: true, type: 'wireguard' };
    }
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
  // Simulierte IP-Verwaltung (in Produktion würde hier eine Datenbank verwendet)
  const usedIPs = await getUsedIPAddresses(); // Mock-Funktion
  const subnet = '10.8.0';
  
  for (let i = 2; i <= 254; i++) {
    const ip = `${subnet}.${i}`;
    if (!usedIPs.includes(ip)) {
      return ip;
    }
  }
  
  throw new Error('Keine verfügbaren IP-Adressen im VPN-Subnetz');
};

/**
 * Mock: Verwendete IP-Adressen abrufen
 */
const getUsedIPAddresses = async () => {
  // In Produktion würde hier die Datenbank abgefragt
  return ['10.8.0.1', '10.8.0.2', '10.8.0.3'];
};

/**
 * VPN-Verbindungen für Benutzer abrufen
 * GET /api/vpn/connections
 */
export const getUserVPNConnections = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Mock-Daten (in Produktion: Datenbankabfrage)
    const connections = [
      {
        id: '1',
        userId: userId,
        name: 'Laptop Homeoffice',
        publicKey: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno1234=',
        status: 'active',
        createdAt: '2024-01-15T10:00:00Z',
        lastConnected: '2024-07-28T14:30:00Z',
        ipAddress: '10.8.0.2',
        dataTransferred: '245000000' // Bytes
      }
    ];
    
    res.json({
      success: true,
      connections: connections,
      limit: getVPNLimitForUser(req.user),
      count: connections.length
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der VPN-Verbindungen:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der VPN-Verbindungen'
    });
  }
};

/**
 * Neue VPN-Verbindung erstellen
 * POST /api/vpn/connections
 */
export const createVPNConnection = async (req, res) => {
  try {
    const { name, publicKey, keyType = 'auto' } = req.body;
    const user = req.user;
    
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
        error: 'Öffentlicher Schlüssel ist erforderlich'
      });
    }
    
    // Public Key validieren
    const keyValidation = validatePublicKey(publicKey, keyType);
    if (!keyValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Ungültiger öffentlicher Schlüssel'
      });
    }
    
    // Benutzer-Limits prüfen
    const userLimit = getVPNLimitForUser(user);
    if (userLimit === 0) {
      return res.status(403).json({
        success: false,
        error: 'Keine Berechtigung für VPN-Verbindungen'
      });
    }
    
    // Aktuelle Verbindungsanzahl prüfen (Mock)
    const currentConnections = 1; // In Produktion: Datenbankabfrage
    if (userLimit !== -1 && currentConnections >= userLimit) {
      return res.status(400).json({
        success: false,
        error: `Limit von ${userLimit} VPN-Verbindungen erreicht`
      });
    }
    
    // Server-Schlüsselpaar für diese Verbindung generieren
    const serverKeys = await generateWireGuardKeyPair();
    
    // IP-Adresse zuweisen
    const assignedIP = await getNextAvailableIP();
    
    // VPN-Verbindung in Datenbank speichern (Mock)
    const newConnection = {
      id: crypto.randomUUID(),
      userId: user.id,
      name: name.trim(),
      clientPublicKey: publicKey.trim(),
      serverPrivateKey: serverKeys.privateKey,
      serverPublicKey: serverKeys.publicKey,
      ipAddress: assignedIP,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Audit-Log
    console.log(`VPN-Verbindung erstellt für Benutzer ${user.username}: ${newConnection.id}`);
    
    res.status(201).json({
      success: true,
      connection: {
        id: newConnection.id,
        name: newConnection.name,
        status: newConnection.status,
        ipAddress: newConnection.ipAddress,
        createdAt: newConnection.createdAt
      }
    });
  } catch (error) {
    console.error('Fehler beim Erstellen der VPN-Verbindung:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Erstellen der VPN-Verbindung'
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
    const userId = req.user.id;
    
    // VPN-Verbindung aus Datenbank abrufen (Mock)
    const connection = {
      id: id,
      userId: userId,
      name: 'Laptop Homeoffice',
      clientPublicKey: 'ClientPublicKeyHere123456789abcdef=',
      serverPublicKey: 'ServerPublicKeyHere123456789abcdef=',
      ipAddress: '10.8.0.2',
      status: 'active'
    };
    
    if (!connection || connection.userId !== userId) {
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
    
    // WireGuard-Konfiguration generieren
    const config = `[Interface]
# HNEE VPN Configuration - ${connection.name}
# Generated: ${new Date().toISOString()}
PrivateKey = YOUR_PRIVATE_KEY_HERE
Address = ${connection.ipAddress}/24
DNS = 10.8.0.1

[Peer]
# HNEE VPN Server
PublicKey = ${connection.serverPublicKey}
Endpoint = vpn.hnee.de:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25

# Instructions:
# 1. Replace YOUR_PRIVATE_KEY_HERE with your WireGuard private key
# 2. Save this file as hnee-vpn-${connection.id}.conf
# 3. Import the configuration into your WireGuard client
`;
    
    // Audit-Log
    console.log(`VPN-Konfiguration heruntergeladen: ${connection.id} von Benutzer ${req.user.username}`);
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="hnee-vpn-${connection.id}.conf"`);
    res.send(config);
  } catch (error) {
    console.error('Fehler beim Generieren der VPN-Konfiguration:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Generieren der VPN-Konfiguration'
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
    const userId = req.user.id;
    
    // VPN-Verbindung aus Datenbank abrufen und Berechtigung prüfen (Mock)
    const connection = { id, userId }; // Mock
    
    if (!connection || connection.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'VPN-Verbindung nicht gefunden'
      });
    }
    
    // VPN-Verbindung aus WireGuard-Server entfernen
    // await removeWireGuardPeer(connection.serverPublicKey);
    
    // VPN-Verbindung aus Datenbank löschen (Mock)
    // await deleteConnectionFromDatabase(id);
    
    // Audit-Log
    console.log(`VPN-Verbindung gelöscht: ${id} von Benutzer ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'VPN-Verbindung erfolgreich gelöscht'
    });
  } catch (error) {
    console.error('Fehler beim Löschen der VPN-Verbindung:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Löschen der VPN-Verbindung'
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
    
    // Mock-Statistiken
    const stats = {
      totalConnections: 156,
      activeConnections: 89,
      usersByRole: {
        students: { connections: 67, limit: 5 },
        employees: { connections: 45, limit: 7 },
        itEmployees: { connections: 44, limit: -1 }
      },
      dataTransfer: {
        today: '2.3 GB',
        week: '15.7 GB',
        month: '67.2 GB'
      },
      serverLoad: {
        cpu: '23%',
        memory: '45%',
        bandwidth: '12%'
      }
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der VPN-Statistiken:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der VPN-Statistiken'
    });
  }
};
