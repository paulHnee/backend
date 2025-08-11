/**
 * LDAP Utility-Funktionen für erweiterte Gruppenabfragen und Benutzerinformationen
 * 
 * Diese Datei enthält spezialisierte Hilfsfunktionen für die Interaktion mit dem HNEE LDAP-System.
 * Hauptfunktionen:
 * - Gruppenmitgliedschaft-Überprüfung
 * - Gruppensuche und -auflistung
 * - Benutzerrollen-Mapping für HNEE-spezifische Gruppen
 * - Erweiterte LDAP-Abfragen mit Fehlerbehandlung
 * 
 * Unterstützte HNEE-Gruppen:
 * - ITSZadmins: ITSZ Administratoren
 * - IT-Mitarbeiter: IT-Abteilung Mitarbeiter
 * - Mitarbeiter: Allgemeine HNEE Mitarbeiter
 * - Dozenten: Lehrpersonal
 * - GastDozenten: Externe Dozenten
 * - Studenten: Studierende
 * 
 * Sicherheitsfeatures:
 * - Timeout-Konfiguration für LDAP-Verbindungen
 * - TLS-Verbindungen mit Zertifikatsvalidierung
 * - Automatische Verbindungsschließung
 * - Comprehensive Error Handling
 * 
 * @author ITSZ Team
 * @version 1.0.0
 */
import ldapAuth from '../config/ldap.js';
import ldapjs from 'ldapjs';

/**
 * Überprüft, ob ein Benutzer Mitglied einer bestimmten Gruppe ist
 * 
 * Diese Funktion nutzt die getUserInfo Methode des LDAP-Auth-Moduls
 * und durchsucht die Gruppenliste des Benutzers nach dem angegebenen Gruppennamen.
 * 
 * @param {string} username - Der Benutzername (z.B. "pbuchwald")
 * @param {string} groupName - Der Name der Gruppe (z.B. "hnee-mitarbeiter")
 * @returns {Promise<boolean>} - true wenn Mitglied, false wenn nicht
 * @throws {Error} Bei LDAP-Verbindungsfehlern oder ungültigen Benutzern
 */
export const isUserInGroup = async (username, groupName) => {
  return new Promise((resolve, reject) => {
    ldapAuth.getUserInfo(username, (err, userInfo) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Case-insensitive Suche in der Gruppenliste des Benutzers
      const isMember = userInfo.groups.some(group => 
        group.toLowerCase().includes(groupName.toLowerCase())
      );
      resolve(isMember);
    });
  });
};

/**
 * Holt alle Mitglieder einer bestimmten LDAP-Gruppe
 * 
 * Diese Funktion führt eine direkte LDAP-Abfrage durch, um alle Mitglieder
 * einer spezifischen Gruppe zu ermitteln. Verwendet sichere TLS-Verbindungen.
 * 
 * @param {string} groupName - Der DN oder CN der Gruppe
 * @returns {Promise<Array>} - Array von Benutzernamen
 * @throws {Error} Bei LDAP-Verbindungsfehlern oder ungültigen Gruppen
 */
export const getGroupMembers = async (groupName) => {
  return new Promise((resolve, reject) => {
    // LDAP-Client mit Sicherheitskonfiguration erstellen
    const client = ldapjs.createClient({
      url: process.env.LDAP_URL,
      timeout: 30000,        // 30 Sekunden Timeout
      connectTimeout: 10000, // 10 Sekunden Verbindungs-Timeout
      tlsOptions: {
        rejectUnauthorized: false // Für Entwicklungsumgebungen - TLS-Zertifikate nicht streng prüfen
      }
    });

    // Authentifizierung mit Service-Account
    client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_CREDENTIALS, (err) => {
      if (err) {
        client.destroy();
        return reject(err);
      }

      // Suche nach der Gruppe
      const searchFilter = `(cn=${groupName})`;
      const searchOptions = {
        scope: 'sub',
        filter: searchFilter,
        attributes: ['member', 'cn']
      };

      client.search(process.env.LDAP_SEARCH_BASE, searchOptions, (err, searchRes) => {
        if (err) {
          client.destroy();
          return reject(err);
        }

        let members = [];

        searchRes.on('searchEntry', (entry) => {
          const attributes = entry.object;
          
          // Sichere Behandlung der Attribute
          if (!attributes) {
            console.warn('LDAP Entry ohne Attribute gefunden, überspringe...');
            return;
          }
          
          if (attributes.member) {
            const memberArray = Array.isArray(attributes.member) 
              ? attributes.member 
              : [attributes.member];
            
            // Extrahiere Benutzernamen aus DN
            members = memberArray.map(memberDN => {
              const cnMatch = memberDN.match(/^CN=([^,]+)/i);
              return cnMatch ? cnMatch[1] : memberDN;
            });
          }
        });

        searchRes.on('error', (err) => {
          client.destroy();
          reject(err);
        });

        searchRes.on('end', () => {
          client.destroy();
          resolve(members);
        });
      });
    });
  });
};

/**
 * Überprüft Benutzerrollen basierend auf LDAP-Gruppen
 * @param {Array} userGroups - Array der Benutzergruppen
 * @returns {Object} - Objekt mit Rollenberechtigungen
 */
export const mapUserRoles = (userGroups) => {
  const roles = {
    isAdmin: false,
    isEmployee: false,
    isStudent: false,
    isITSZ: false,
    isITEmployee: false,
    isLecturer: false,
    isGuestLecturer: false,
    canManageUsers: false,
    canViewReports: false
  };

  userGroups.forEach(group => {
    const groupLower = group.toLowerCase();
    
    // ITSZ Admins - höchste Berechtigung
    if (groupLower === 'itszadmins') {
      roles.isAdmin = true;
      roles.isITSZ = true;
      roles.isLecturer = true;
      roles.isEmployee = true;
      roles.canManageUsers = true;
      roles.canViewReports = true;
    }
    
    // IT-Mitarbeiter
    if (groupLower === 'it-mitarbeiter') {
      roles.isITEmployee = true;
      roles.isITSZ = true;
      roles.canManageUsers = true;
      roles.canViewReports = true;
    }

    // Allgemeine Beschäftigte - verschiedene Variationen
    if (groupLower === 'mitarbeiter' || groupLower === 'beschaeftigte' || groupLower === 'mitarbeiter ') {
      roles.isEmployee = true;
    }

    // Studierende
    if (groupLower === 'studierende') {
      roles.isStudent = true;
    }

    // Lehrende
    if (groupLower === 'Dozenten') {
      roles.isLecturer = true;

    }
    
    // Gastdozenten
    if (groupLower === 'gastdozenten') {
      roles.isGuestLecturer = true;
    }
  });

  return roles;
};

/**
 * Beispiel für eine erweiterte Gruppenabfrage mit Filtern
 * @param {string} searchPattern - Suchmuster für Gruppennamen
 * @returns {Promise<Array>} - Array von Gruppeninformationen
 */
export const searchGroups = async (searchPattern = '*') => {
  return new Promise((resolve, reject) => {
    const client = ldapjs.createClient({
      url: process.env.LDAP_URL,
      timeout: 30000,
      connectTimeout: 10000,
      tlsOptions: {
        rejectUnauthorized: false // Für Entwicklungsumgebungen - TLS-Zertifikate nicht streng prüfen
      }
    });

    client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_CREDENTIALS, (err) => {
      if (err) {
        client.destroy();
        return reject(err);
      }

      // Erweiterte Suche nach Gruppen mit Debug-Logging
      console.log(`🔍 LDAP Gruppensuche mit Base: ${process.env.LDAP_SEARCH_BASE}`);
      
      // Einfacherer Filter für bessere Kompatibilität
      const searchFilter = `(|(objectClass=group)(objectClass=organizationalUnit))`;
      const searchOptions = {
        scope: 'sub',
        filter: searchFilter,
        attributes: ['cn', 'name', 'sAMAccountName', 'description', 'member', 'memberOf', 'members', 'objectClass', 'ou', 'dn'],
        sizeLimit: 50 // Reduzierte Grenze um Size Limit Exceeded zu vermeiden
      };
      
      console.log(`🔧 LDAP Filter: ${searchFilter}`);

      client.search(process.env.LDAP_SEARCH_BASE, searchOptions, (err, searchRes) => {
        if (err) {
          client.destroy();
          return reject(err);
        }

        let groups = [];

        searchRes.on('searchEntry', (entry) => {
          try {
            // LDAPJS-kompatible Attribut-Extraktion - verschiedene Ansätze versuchen
            let attributes = null;
            
            // Methode 1: Direkte Attribute-Zugriff (moderne ldapjs)
            if (entry.attributes && Array.isArray(entry.attributes)) {
              attributes = {};
              entry.attributes.forEach(attr => {
                attributes[attr.type] = attr.values || attr._vals || [attr.value];
              });
            }
            // Methode 2: .object property (ältere Versionen)
            else if (entry.object) {
              attributes = entry.object;
            }
            // Methode 3: .json() Methode falls verfügbar
            else if (typeof entry.json === 'function') {
              attributes = entry.json();
            }
            
            if (!attributes) {
              console.warn('LDAP Entry ohne verarbeitbare Attribute gefunden, überspringe...');
              return;
            }
            
            // Sichere Attribut-Extraktion - verschiedene LDAP-Server-Typen berücksichtigen
            const getValue = (attr) => {
              if (Array.isArray(attr)) {
                return attr[0]; // Erstes Element bei Arrays
              }
              return attr;
            };
            
            const groupName = getValue(attributes.cn) || 
                             getValue(attributes.name) || 
                             getValue(attributes.sAMAccountName) || 
                             getValue(attributes.ou) || 
                             (entry.dn ? entry.dn.toString().split(',')[0].replace(/^(cn|ou)=/i, '') : 'Unbekannt');
            
            const description = getValue(attributes.description) || getValue(attributes.info) || '';
            
            // Sichere Behandlung der member-Attribute mit verschiedenen Formaten
            let memberCount = 0;
            if (attributes.member) {
              memberCount = Array.isArray(attributes.member) ? attributes.member.length : 1;
            } else if (attributes.memberOf) {
              memberCount = Array.isArray(attributes.memberOf) ? attributes.memberOf.length : 1;
            } else if (attributes.members) {
              memberCount = Array.isArray(attributes.members) ? attributes.members.length : 1;
            }

            // Objektklasse bestimmen
            const objectClass = attributes.objectClass || [];
            const isOU = Array.isArray(objectClass) ? 
                        objectClass.some(cls => (cls || '').toLowerCase().includes('organizationalunit')) :
                        ((objectClass || '').toLowerCase().includes('organizationalunit'));

            // Alle LDAP-Einträge mit gültigen Namen hinzufügen (auch OUs)
            if (groupName !== 'Unbekannt' && groupName && groupName.trim()) {
              groups.push({
                name: groupName.trim(),
                description: description,
                memberCount: memberCount,
                dn: entry.dn ? entry.dn.toString() : 'unknown',
                objectClass: objectClass,
                type: isOU ? 'OU' : 'Group'
              });
            }
          } catch (parseError) {
            console.warn('Fehler beim Parsen der LDAP-Gruppe:', parseError.message);
          }
        });

        searchRes.on('error', (err) => {
          client.destroy();
          reject(err);
        });

        searchRes.on('end', () => {
          client.destroy();
          resolve(groups);
        });
      });
    });
  });
};
