/**
 * AdminController - Umfassende Administration für HNEE Service Portal
 * 
 * ===== ARCHITEKTUR-ÜBERSICHT =====
 * 
 * Dieser Controller implementiert ausschließlich administrative Funktionen für das
 * HNEE Service Portal. Monitoring-Funktionen wurden bewusst in den Reports-Bereich
 * (monitoringController.js) ausgelagert um eine klare Trennung der Verantwortlichkeiten
 * zu gewährleisten.
 * 
 * ===== KERN-FUNKTIONALITÄTEN =====
 * 
 * 1. BENUTZER-MANAGEMENT:
 *    - LDAP-Gruppen-Zuordnungen (Hinzufügen/Entfernen)
 *    - Account-Status-Verwaltung (Aktivieren/Deaktivieren)
 *    - Passwort-Reset-Funktionalität
 *    - Batch-Operationen für Massenänderungen
 * 
 * 2. SYSTEM-KONFIGURATION:
 *    - Admin-Parameter-Verwaltung
 *    - Umgebungsvariablen-Konfiguration
 *    - Service-Limits und -Einstellungen
 * 
 * 3. AUDIT & SICHERHEIT:
 *    - Vollständige Aktions-Protokollierung
 *    - Sicherheits-Event-Logging
 *    - Admin-Benutzer-Anfragen-Management
 * 
 * 4. LDAP-INTEGRATION:
 *    - Direkte Active Directory-Operationen
 *    - Sichere Admin-Authentifizierung
 *    - Robuste Fehlerbehandlung
 * 
 * ===== SICHERHEITSASPEKTE =====
 * 
 * - Alle Funktionen erfordern Admin-Authentifizierung
 * - Umfassende Sicherheits-Audit-Logs für jede Operation
 * - Passwort-Stärke-Validierung bei Resets
 * - LDAP-Verbindungen mit Timeout-Schutz
 * - Strukturierte Eingabe-Validierung
 * 
 * ===== TECHNISCHE IMPLEMENTIERUNG =====
 * 
 * - ES6 Module mit named exports
 * - Express-Route-Handler-Pattern
 * - Promise-basierte LDAP-Operationen
 * - Strukturierte Fehlerbehandlung mit HTTP-Status-Codes
 * - Umgebungsvariablen-basierte Konfiguration
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 3.0.0 (Admin-only, Monitoring ausgelagert)
 * @since 2025-08-06
 */

import { logSecurityEvent } from '../utils/securityLogger.js';
import ldapAuth from '../config/ldap.js';
import ldapjs from 'ldapjs';

// ===== ADMIN-KONFIGURATION =====

/**
 * Zentrale Admin-Konfiguration mit Umgebungsvariablen-Integration
 * 
 * Diese Konfiguration steuert das Verhalten aller administrativen Funktionen:
 * - Benutzer-Limits für Systemschutz
 * - Feature-Flags für verschiedene Admin-Operationen
 * - Sicherheits-Einstellungen für kritische Aktionen
 * 
 * Umgebungsvariablen:
 * - MAX_USER_LIMIT: Maximale Anzahl verwaltbarer Benutzer (Standard: 5000)
 * - ALLOW_USER_CREATION: Benutzer-Erstellung erlauben (true/false)
 * - ALLOW_USER_DELETION: Benutzer-Löschung erlauben (true/false)
 * - REQUIRE_ADMIN_APPROVAL: Admin-Genehmigung für kritische Aktionen (true/false)
 */
const ADMIN_CONFIG = {
  maxUserLimit: process.env.MAX_USER_LIMIT || 5000,           // Maximale Benutzeranzahl
  allowUserCreation: process.env.ALLOW_USER_CREATION === 'true', // Benutzer-Erstellung
  allowUserDeletion: process.env.ALLOW_USER_DELETION === 'true', // Benutzer-Löschung
  requireAdminApproval: process.env.REQUIRE_ADMIN_APPROVAL === 'true' // Genehmigungspflicht
};

/**
 * LDAP-Client für Administrative Operationen erstellen
 * 
 * Diese Funktion erstellt einen speziell konfigurierten LDAP-Client für
 * administrative Operationen im Active Directory:
 * 
 * Konfiguration:
 * - Erweiterte Timeouts für komplexe Admin-Operationen (15s/10s)
 * - Direkte LDAP-URL-Verbindung ohne Connection-Pooling
 * - Fehlerbehandlung bei fehlender LDAP-Konfiguration
 * 
 * Verwendung:
 * - Benutzer-Management-Operationen
 * - Gruppen-Mitgliedschafts-Änderungen
 * - Account-Status-Modifikationen
 * - Passwort-Reset-Funktionen
 * 
 * Sicherheitsaspekte:
 * - Client wird nach jeder Operation ordnungsgemäß zerstört
 * - Timeouts verhindern hängende Verbindungen
 * - Konfigurationsprüfung vor Client-Erstellung
 * 
 * @returns {Object} ldapjs Client-Instanz für Admin-Operationen
 * @throws {Error} Falls LDAP nicht konfiguriert ist
 */
const createAdminLdapClient = () => {
  // ===== VORBEDINGUNGEN PRÜFEN =====
  
  if (!process.env.LDAP_URL) {
    throw new Error('LDAP-Server nicht konfiguriert - LDAP_URL Umgebungsvariable fehlt');
  }

  // ===== ADMIN-LDAP-CLIENT ERSTELLEN =====
  
  return ldapjs.createClient({
    url: process.env.LDAP_URL,      // LDAP-Server-URL aus Umgebungsvariable
    timeout: 15000,                 // 15 Sekunden Timeout für Admin-Operationen
    connectTimeout: 10000           // 10 Sekunden Verbindungs-Timeout
  });
};

/**
 * Benutzer zu LDAP-Gruppe hinzufügen - Administrative Gruppenverwaltung
 * 
 * Diese Funktion ermöglicht es Administratoren, Benutzer zu Active Directory-Gruppen
 * hinzuzufügen. Dies ist eine kritische Admin-Funktion für Rechteverwaltung.
 * 
 * Funktionalitäten:
 * - Sichere LDAP-Admin-Authentifizierung
 * - Strukturierte Eingabe-Validierung
 * - Atomare Gruppen-Mitgliedschafts-Operation
 * - Umfassende Sicherheits-Audit-Protokollierung
 * - Robuste Fehlerbehandlung mit Cleanup
 * 
 * Sicherheitsaspekte:
 * - Verwendet Admin-LDAP-Anmeldedaten (LDAP_ADMIN_DN/PASSWORD)
 * - Vollständige Protokollierung für Compliance
 * - Client-Cleanup nach jeder Operation
 * 
 * Active Directory Integration:
 * - Modifiziert 'member'-Attribut der Zielgruppe
 * - Verwendet vollständige DN-Pfade für Eindeutigkeit
 * - Unterstützt Standard-HNEE-OU-Struktur
 * 
 * @param {Object} req - Express Request mit { username, groupDN }
 * @param {Object} res - Express Response mit Erfolg/Fehler-Status
 */
export const addUserToGroup = async (req, res) => {
  try {
    console.log('👥 Admin-Gruppenverwaltung: Benutzer zu Gruppe hinzufügen...');
    
    // ===== ADMIN-BENUTZER IDENTIFIZIEREN =====
    
    const adminUser = req.user?.username || 'unknown';
    
    // ===== EINGABE-VALIDIERUNG =====
    
    const { username, groupDN } = req.body;

    if (!username || !groupDN) {
      console.warn(`⚠️ Unvollständige Eingabe von Admin ${adminUser}: username=${username}, groupDN=${groupDN}`);
      return res.status(400).json({ 
        error: 'Username und Group DN sind beide erforderlich',
        required: ['username', 'groupDN'],
        received: { username: Boolean(username), groupDN: Boolean(groupDN) }
      });
    }

    console.log(`📝 Füge Benutzer ${username} zu Gruppe ${groupDN} hinzu (Admin: ${adminUser})`);

    // ===== LDAP-CLIENT ERSTELLEN =====
    
    const client = createAdminLdapClient();

    try {
      // ===== ADMIN-AUTHENTIFIZIERUNG =====
      
      // Promise-Wrapper für callback-basierte LDAP-Bind-Operation
      await new Promise((resolve, reject) => {
        client.bind(process.env.LDAP_ADMIN_DN, process.env.LDAP_ADMIN_PASSWORD, (err) => {
          if (err) {
            console.error('❌ Admin-LDAP-Authentifizierung fehlgeschlagen:', err.message);
            reject(new Error(`LDAP Admin-Anmeldung fehlgeschlagen: ${err.message}`));
          } else {
            console.log('✅ Admin-LDAP-Authentifizierung erfolgreich');
            resolve();
          }
        });
      });

      // ===== GRUPPEN-MITGLIEDSCHAFT HINZUFÜGEN =====
      
      // Konstruiere vollständigen Benutzer-DN basierend auf HNEE-OU-Struktur
      const userDN = `CN=${username},OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de`;
      
      // LDAP-Modifikations-Operation: Member zu Gruppe hinzufügen
      const modification = {
        operation: 'add',                    // Add-Operation für neues Gruppen-Mitglied
        modification: {
          member: userDN                     // Vollständiger DN des hinzuzufügenden Benutzers
        }
      };

      console.log(`🔧 Führe LDAP-Modifikation durch: Füge ${userDN} zu ${groupDN} hinzu`);

      // Promise-Wrapper für callback-basierte LDAP-Modify-Operation
      await new Promise((resolve, reject) => {
        client.modify(groupDN, modification, (err) => {
          if (err) {
            console.error('❌ LDAP-Gruppenmodifikation fehlgeschlagen:', err.message);
            reject(new Error(`Gruppenmitgliedschaft-Hinzufügung fehlgeschlagen: ${err.message}`));
          } else {
            console.log('✅ LDAP-Gruppenmodifikation erfolgreich');
            resolve();
          }
        });
      });

    } finally {
      // ===== LDAP-CLIENT CLEANUP =====
      
      // Client immer ordnungsgemäß zerstören (auch bei Fehlern)
      client.destroy();
      console.log('🧹 LDAP-Client ordnungsgemäß bereinigt');
    }

    // ===== SICHERHEITS-AUDIT-LOGGING =====
    
    logSecurityEvent(
      adminUser, 
      'ADD_USER_TO_GROUP', 
      `Benutzer ${username} erfolgreich zu LDAP-Gruppe ${groupDN} hinzugefügt`
    );

    // ===== ERFOLGSANTWORT =====
    
    console.log(`✅ Gruppenmitgliedschaft erfolgreich: ${username} → ${groupDN}`);

    res.json({
      success: true,
      message: `Benutzer ${username} erfolgreich zur Gruppe hinzugefügt`,
      operation: {
        user: username,
        group: groupDN,
        action: 'add',
        performedBy: adminUser
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // ===== UMFASSENDE FEHLERBEHANDLUNG =====
    
    console.error('❌ Fehler beim Hinzufügen zur Gruppe:', error);
    
    res.status(500).json({ 
      error: 'Fehler beim Hinzufügen zur Gruppe',
      details: error.message,
      troubleshooting: {
        checkLdapConfig: 'Prüfe LDAP-Admin-Anmeldedaten',
        checkUserExists: 'Prüfe ob Benutzer existiert',
        checkGroupExists: 'Prüfe ob Gruppe existiert',
        checkPermissions: 'Prüfe Admin-Berechtigungen'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Benutzer aus LDAP-Gruppe entfernen - Administrative Gruppenverwaltung
 * 
 * Diese Funktion ermöglicht das Entfernen von Benutzern aus Active Directory-Gruppen.
 * Kritisch für Rechteverwaltung bei Rollenänderungen oder Austritten.
 * 
 * Funktionalitäten:
 * - Sichere LDAP-Admin-Authentifizierung
 * - Atomare Gruppen-Mitgliedschafts-Entfernung
 * - Vollständige Audit-Protokollierung
 * - Robuste Fehlerbehandlung mit detailliertem Troubleshooting
 * 
 * Sicherheitsaspekte:
 * - Kritische Operation erfordert Admin-Berechtigung
 * - Vollständige Protokollierung für Compliance-Audits
 * - Sichere LDAP-Client-Behandlung
 * 
 * Active Directory Integration:
 * - Modifiziert 'member'-Attribut der Zielgruppe (DELETE-Operation)
 * - Verwendet vollständige DN-Pfade für Eindeutigkeit
 * - Berücksichtigt HNEE-OU-Struktur
 * 
 * @param {Object} req - Express Request mit { username, groupDN }
 * @param {Object} res - Express Response mit Erfolg/Fehler-Status
 */
export const removeUserFromGroup = async (req, res) => {
  try {
    console.log('👥 Admin-Gruppenverwaltung: Benutzer aus Gruppe entfernen...');
    
    // ===== ADMIN-BENUTZER IDENTIFIZIEREN =====
    
    const adminUser = req.user?.username || 'unknown';
    
    // ===== EINGABE-VALIDIERUNG =====
    
    const { username, groupDN } = req.body;

    if (!username || !groupDN) {
      console.warn(`⚠️ Unvollständige Eingabe von Admin ${adminUser}: username=${username}, groupDN=${groupDN}`);
      return res.status(400).json({ 
        error: 'Username und Group DN sind beide erforderlich für Gruppen-Entfernung',
        required: ['username', 'groupDN'],
        received: { username: Boolean(username), groupDN: Boolean(groupDN) }
      });
    }

    console.log(`📝 Entferne Benutzer ${username} aus Gruppe ${groupDN} (Admin: ${adminUser})`);

    // ===== LDAP-CLIENT ERSTELLEN =====
    
    const client = createAdminLdapClient();

    try {
      // ===== ADMIN-AUTHENTIFIZIERUNG =====
      
      await new Promise((resolve, reject) => {
        client.bind(process.env.LDAP_ADMIN_DN, process.env.LDAP_ADMIN_PASSWORD, (err) => {
          if (err) {
            console.error('❌ Admin-LDAP-Authentifizierung fehlgeschlagen:', err.message);
            reject(new Error(`LDAP Admin-Anmeldung fehlgeschlagen: ${err.message}`));
          } else {
            console.log('✅ Admin-LDAP-Authentifizierung erfolgreich');
            resolve();
          }
        });
      });

      // ===== GRUPPEN-MITGLIEDSCHAFT ENTFERNEN =====
      
      // Konstruiere vollständigen Benutzer-DN
      const userDN = `CN=${username},OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de`;
      
      // LDAP-Modifikations-Operation: Member aus Gruppe entfernen
      const modification = {
        operation: 'delete',                 // Delete-Operation für Gruppen-Mitglied
        modification: {
          member: userDN                     // Vollständiger DN des zu entfernenden Benutzers
        }
      };

      console.log(`🔧 Führe LDAP-Modifikation durch: Entferne ${userDN} aus ${groupDN}`);

      // Promise-Wrapper für LDAP-Modify-Operation
      await new Promise((resolve, reject) => {
        client.modify(groupDN, modification, (err) => {
          if (err) {
            console.error('❌ LDAP-Gruppenmodifikation fehlgeschlagen:', err.message);
            reject(new Error(`Gruppenmitgliedschaft-Entfernung fehlgeschlagen: ${err.message}`));
          } else {
            console.log('✅ LDAP-Gruppenmodifikation erfolgreich');
            resolve();
          }
        });
      });

    } finally {
      // ===== LDAP-CLIENT CLEANUP =====
      
      client.destroy();
      console.log('🧹 LDAP-Client ordnungsgemäß bereinigt');
    }

    // ===== SICHERHEITS-AUDIT-LOGGING =====
    
    logSecurityEvent(
      adminUser, 
      'REMOVE_USER_FROM_GROUP', 
      `Benutzer ${username} erfolgreich aus LDAP-Gruppe ${groupDN} entfernt`
    );

    // ===== ERFOLGSANTWORT =====
    
    console.log(`✅ Gruppen-Entfernung erfolgreich: ${username} ← ${groupDN}`);

    res.json({
      success: true,
      message: `Benutzer ${username} erfolgreich aus Gruppe entfernt`,
      operation: {
        user: username,
        group: groupDN,
        action: 'remove',
        performedBy: adminUser
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // ===== UMFASSENDE FEHLERBEHANDLUNG =====
    
    console.error('❌ Fehler beim Entfernen aus Gruppe:', error);
    
    res.status(500).json({ 
      error: 'Fehler beim Entfernen aus Gruppe',
      details: error.message,
      troubleshooting: {
        checkLdapConfig: 'Prüfe LDAP-Admin-Anmeldedaten',
        checkMembership: 'Prüfe ob Benutzer tatsächlich Mitglied der Gruppe ist',
        checkGroupExists: 'Prüfe ob Zielgruppe existiert',
        checkPermissions: 'Prüfe Admin-Berechtigungen für Gruppenmodifikation'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Benutzer-Account aktivieren/deaktivieren - Account-Status-Management
 * 
 * Diese kritische Admin-Funktion ermöglicht das Aktivieren oder Deaktivieren
 * von Benutzer-Accounts im Active Directory durch Modifikation des
 * userAccountControl-Attributs.
 * 
 * Funktionalitäten:
 * - Account-Aktivierung (userAccountControl = 512)
 * - Account-Deaktivierung (userAccountControl = 514) 
 * - Validierung der Action-Parameter
 * - Sichere LDAP-Admin-Operationen
 * - Umfassende Audit-Protokollierung
 * 
 * Active Directory userAccountControl-Werte:
 * - 512 (0x200): Normaler Account (aktiviert)
 * - 514 (0x202): Account deaktiviert (512 + 2)
 * - Diese Werte steuern die Anmeldefähigkeit des Benutzers
 * 
 * Sicherheitsaspekte:
 * - Kritische Funktion für Account-Sicherheit
 * - Vollständige Protokollierung aller Status-Änderungen
 * - Admin-Authentifizierung erforderlich
 * 
 * Anwendungsfälle:
 * - Temporäre Account-Sperrung bei Sicherheitsvorfällen
 * - Account-Reaktivierung nach Problemlösung
 * - Mitarbeiter-Austritte und -Eintritte
 * 
 * @param {Object} req - Express Request mit { username, action: 'enable'|'disable' }
 * @param {Object} res - Express Response mit Erfolg/Fehler-Status
 */
export const toggleUserAccount = async (req, res) => {
  try {
    console.log('🔐 Admin-Account-Management: Account-Status ändern...');
    
    // ===== ADMIN-BENUTZER IDENTIFIZIEREN =====
    
    const adminUser = req.user?.username || 'unknown';
    
    // ===== EINGABE-VALIDIERUNG =====
    
    const { username, action } = req.body; // action: 'enable' | 'disable'

    if (!username || !['enable', 'disable'].includes(action)) {
      console.warn(`⚠️ Ungültige Eingabe von Admin ${adminUser}: username=${username}, action=${action}`);
      return res.status(400).json({ 
        error: 'Username und gültige Action (enable/disable) sind erforderlich',
        validActions: ['enable', 'disable'],
        received: { username: Boolean(username), action }
      });
    }

    console.log(`📝 ${action === 'enable' ? 'Aktiviere' : 'Deaktiviere'} Account ${username} (Admin: ${adminUser})`);

    // ===== LDAP-CLIENT ERSTELLEN =====
    
    const client = createAdminLdapClient();

    try {
      // ===== ADMIN-AUTHENTIFIZIERUNG =====
      
      await new Promise((resolve, reject) => {
        client.bind(process.env.LDAP_ADMIN_DN, process.env.LDAP_ADMIN_PASSWORD, (err) => {
          if (err) {
            console.error('❌ Admin-LDAP-Authentifizierung fehlgeschlagen:', err.message);
            reject(new Error(`LDAP Admin-Anmeldung fehlgeschlagen: ${err.message}`));
          } else {
            console.log('✅ Admin-LDAP-Authentifizierung erfolgreich');
            resolve();
          }
        });
      });

      // ===== ACCOUNT-STATUS MODIFIZIEREN =====
      
      // Konstruiere vollständigen Benutzer-DN
      const userDN = `CN=${username},OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de`;
      
      // Active Directory userAccountControl-Werte:
      // 512 (0x200) = Normaler aktivierter Account
      // 514 (0x202) = Deaktivierter Account (512 + 2)
      const userAccountControlValue = action === 'enable' ? '512' : '514';
      
      // LDAP-Modifikations-Operation: userAccountControl ersetzen
      const modification = {
        operation: 'replace',                // Replace-Operation für Account-Status
        modification: {
          userAccountControl: userAccountControlValue  // Neuer Account-Status-Wert
        }
      };

      console.log(`🔧 Führe LDAP-Modifikation durch: Setze userAccountControl=${userAccountControlValue} für ${userDN}`);

      // Promise-Wrapper für LDAP-Modify-Operation
      await new Promise((resolve, reject) => {
        client.modify(userDN, modification, (err) => {
          if (err) {
            console.error('❌ LDAP-Account-Modifikation fehlgeschlagen:', err.message);
            reject(new Error(`Account-Status-Änderung fehlgeschlagen: ${err.message}`));
          } else {
            console.log('✅ LDAP-Account-Modifikation erfolgreich');
            resolve();
          }
        });
      });

    } finally {
      // ===== LDAP-CLIENT CLEANUP =====
      
      client.destroy();
      console.log('🧹 LDAP-Client ordnungsgemäß bereinigt');
    }

    // ===== SICHERHEITS-AUDIT-LOGGING =====
    
    logSecurityEvent(
      adminUser, 
      'TOGGLE_USER_ACCOUNT', 
      `Benutzer-Account ${username} ${action === 'enable' ? 'aktiviert' : 'deaktiviert'} (userAccountControl: ${action === 'enable' ? '512' : '514'})`
    );

    // ===== ERFOLGSANTWORT =====
    
    const statusText = action === 'enable' ? 'aktiviert' : 'deaktiviert';
    console.log(`✅ Account-Status-Änderung erfolgreich: ${username} ${statusText}`);

    res.json({
      success: true,
      message: `Benutzer ${username} erfolgreich ${statusText}`,
      operation: {
        user: username,
        action: action,
        newStatus: statusText,
        userAccountControl: action === 'enable' ? 512 : 514,
        performedBy: adminUser
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // ===== UMFASSENDE FEHLERBEHANDLUNG =====
    
    console.error('❌ Fehler beim Aktivieren/Deaktivieren des Accounts:', error);
    
    res.status(500).json({ 
      error: 'Fehler beim Aktivieren/Deaktivieren des Accounts',
      details: error.message,
      troubleshooting: {
        checkLdapConfig: 'Prüfe LDAP-Admin-Anmeldedaten',
        checkUserExists: 'Prüfe ob Benutzer-Account existiert',
        checkUserDN: 'Prüfe korrekte DN-Struktur',
        checkPermissions: 'Prüfe Admin-Berechtigungen für Account-Modifikation'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Passwort-Reset für Benutzer
 */
export const resetUserPassword = async (req, res) => {
  try {
    const adminUser = req.user?.username || 'unknown';
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({ 
        error: 'Username und neues Passwort erforderlich' 
      });
    }

    // Passwort-Stärke prüfen
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Passwort muss mindestens 8 Zeichen lang sein' 
      });
    }

    const client = createAdminLdapClient();

    // Admin-Bind
    await new Promise((resolve, reject) => {
      client.bind(process.env.LDAP_ADMIN_DN, process.env.LDAP_ADMIN_PASSWORD, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const userDN = `CN=${username},OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de`;
    
    // Passwort setzen
    const modification = {
      operation: 'replace',
      modification: {
        unicodePwd: Buffer.from(`"${newPassword}"`, 'utf16le').toString()
      }
    };

    await new Promise((resolve, reject) => {
      client.modify(userDN, modification, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    client.destroy();

    logSecurityEvent(adminUser, 'RESET_USER_PASSWORD', 
      `Passwort für Benutzer ${username} zurückgesetzt`);

    res.json({
      success: true,
      message: `Passwort für ${username} erfolgreich zurückgesetzt`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler beim Passwort-Reset:', error);
    res.status(500).json({ 
      error: 'Fehler beim Passwort-Reset',
      details: error.message
    });
  }
};

/**
 * System-Konfiguration abrufen
 */
export const getSystemConfig = async (req, res) => {
  try {
    const adminUser = req.user?.username || 'unknown';

    const config = {
      admin: ADMIN_CONFIG,
      ldap: {
        configured: Boolean(process.env.LDAP_URL),
        url: process.env.LDAP_URL ? process.env.LDAP_URL.replace(/\/\/.*@/, '//***@') : null,
        baseDN: process.env.LDAP_BASE_DN || null
      },
      opnsense: {
        configured: Boolean(process.env.OPNSENSE_API_KEY && process.env.OPNSENSE_API_SECRET),
        host: process.env.OPNSENSE_HOST || 'vpn.hnee.de'
      },
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };

    logSecurityEvent(adminUser, 'VIEW_SYSTEM_CONFIG', 'System-Konfiguration abgerufen');

    res.json(config);

  } catch (error) {
    console.error('Fehler beim Abrufen der System-Konfiguration:', error);
    res.status(500).json({ 
      error: 'Fehler beim Abrufen der System-Konfiguration' 
    });
  }
};

/**
 * System-Konfiguration aktualisieren
 */
export const updateSystemConfig = async (req, res) => {
  try {
    const adminUser = req.user?.username || 'unknown';
    const { maxUserLimit, allowUserCreation, allowUserDeletion, requireAdminApproval } = req.body;

    // Validierung
    if (maxUserLimit && (maxUserLimit < 100 || maxUserLimit > 10000)) {
      return res.status(400).json({ 
        error: 'maxUserLimit muss zwischen 100 und 10000 liegen' 
      });
    }

    // Konfiguration aktualisieren (in echter Implementierung würde dies in DB/Env gespeichert)
    if (maxUserLimit !== undefined) ADMIN_CONFIG.maxUserLimit = maxUserLimit;
    if (allowUserCreation !== undefined) ADMIN_CONFIG.allowUserCreation = allowUserCreation;
    if (allowUserDeletion !== undefined) ADMIN_CONFIG.allowUserDeletion = allowUserDeletion;
    if (requireAdminApproval !== undefined) ADMIN_CONFIG.requireAdminApproval = requireAdminApproval;

    logSecurityEvent(adminUser, 'UPDATE_SYSTEM_CONFIG', 
      `System-Konfiguration aktualisiert: ${JSON.stringify(req.body)}`);

    res.json({
      success: true,
      message: 'System-Konfiguration erfolgreich aktualisiert',
      config: ADMIN_CONFIG,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler beim Aktualisieren der System-Konfiguration:', error);
    res.status(500).json({ 
      error: 'Fehler beim Aktualisieren der System-Konfiguration' 
    });
  }
};

/**
 * Audit-Logs abrufen
 */
export const getAuditLogs = async (req, res) => {
  try {
    const adminUser = req.user?.username || 'unknown';
    const { limit = 100, offset = 0, startDate, endDate, action, user: filterUser } = req.query;

    // In echter Implementierung würde dies aus einer Log-DB kommen
    // Hier simulieren wir mit einer einfachen Antwort
    const logs = [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        user: adminUser,
        action: 'VIEW_AUDIT_LOGS',
        details: 'Audit-Logs abgerufen',
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown'
      }
    ];

    logSecurityEvent(adminUser, 'VIEW_AUDIT_LOGS', 
      `Audit-Logs abgerufen (Limit: ${limit}, Offset: ${offset})`);

    res.json({
      logs,
      pagination: {
        total: logs.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: false
      },
      filters: {
        startDate,
        endDate,
        action,
        user: filterUser
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler beim Abrufen der Audit-Logs:', error);
    res.status(500).json({ 
      error: 'Fehler beim Abrufen der Audit-Logs' 
    });
  }
};

/**
 * Benutzer-Anfragen verwalten (Genehmigungen)
 */
export const manageUserRequests = async (req, res) => {
  try {
    const adminUser = req.user?.username || 'unknown';
    const { requestId, action, reason } = req.body; // action: 'approve' | 'reject'

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ 
        error: 'Request ID und gültige Action (approve/reject) erforderlich' 
      });
    }

    // In echter Implementierung würde dies aus einer DB kommen
    const mockRequest = {
      id: requestId,
      type: 'vpn_access',
      user: 'muster.student',
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    logSecurityEvent(adminUser, 'MANAGE_USER_REQUEST', 
      `Benutzer-Anfrage ${requestId} ${action === 'approve' ? 'genehmigt' : 'abgelehnt'}: ${reason || 'Kein Grund angegeben'}`);

    res.json({
      success: true,
      message: `Anfrage ${requestId} erfolgreich ${action === 'approve' ? 'genehmigt' : 'abgelehnt'}`,
      request: {
        ...mockRequest,
        status: action === 'approve' ? 'approved' : 'rejected',
        processedBy: adminUser,
        processedAt: new Date().toISOString(),
        reason
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler beim Verwalten der Benutzer-Anfrage:', error);
    res.status(500).json({ 
      error: 'Fehler beim Verwalten der Benutzer-Anfrage' 
    });
  }
};

/**
 * LDAP-Batch-Operationen für Gruppenmanagement
 */
export const batchGroupOperations = async (req, res) => {
  try {
    const adminUser = req.user?.username || 'unknown';
    const { operations } = req.body; // Array von { username, groupDN, action: 'add'|'remove' }

    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ 
        error: 'Operations-Array ist erforderlich' 
      });
    }

    const client = createAdminLdapClient();
    const results = [];

    // Admin-Bind
    await new Promise((resolve, reject) => {
      client.bind(process.env.LDAP_ADMIN_DN, process.env.LDAP_ADMIN_PASSWORD, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Batch-Operationen ausführen
    for (const op of operations) {
      try {
        const { username, groupDN, action } = op;
        
        const modification = {
          operation: action === 'add' ? 'add' : 'delete',
          modification: {
            member: `CN=${username},OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de`
          }
        };

        await new Promise((resolve, reject) => {
          client.modify(groupDN, modification, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        results.push({
          username,
          groupDN,
          action,
          success: true
        });

      } catch (error) {
        results.push({
          username: op.username,
          groupDN: op.groupDN,
          action: op.action,
          success: false,
          error: error.message
        });
      }
    }

    client.destroy();

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    logSecurityEvent(adminUser, 'BATCH_GROUP_OPERATIONS', 
      `Batch-Gruppenoperationen: ${successCount} erfolgreich, ${errorCount} fehlgeschlagen`);

    res.json({
      success: errorCount === 0,
      message: `Batch-Operation abgeschlossen: ${successCount} erfolgreich, ${errorCount} fehlgeschlagen`,
      results,
      summary: {
        total: operations.length,
        successful: successCount,
        failed: errorCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler bei Batch-Gruppenoperationen:', error);
    res.status(500).json({ 
      error: 'Fehler bei Batch-Gruppenoperationen',
      details: error.message
    });
  }
};


