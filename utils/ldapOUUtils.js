/**
 * Verbesserte LDAP-Benutzerstatistiken mit direkter OU-Abfrage
 * 
 * Diese Funktion ruft Benutzerstatistiken direkt aus den LDAP-OUs ab,
 * anstatt auf Gruppensuche zu verlassen.
 * 
 * VERSION: 2.1 - _MS365 and Pooltest exclusion active
 * 
 * @author Paul Buchwald - ITSZ Team
 */

import ldapjs from 'ldapjs';

/**
 * Benutzer aus einer spezifischen OU abrufen
 */
export const getUsersFromOU = async (ouDN, ouName) => {
  return new Promise((resolve, reject) => {
    const client = ldapjs.createClient({
      url: process.env.LDAP_URL,
      timeout: 30000,
      connectTimeout: 10000,
      tlsOptions: {
        rejectUnauthorized: false
      }
    });

    client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_CREDENTIALS, (err) => {
      if (err) {
        client.destroy();
        return reject(err);
      }

      // Suche nach Benutzern in der OU
      const searchOptions = {
        scope: 'sub', // Unterverzeichnisse einschließen
        filter: '(&(objectClass=user)(!(objectClass=computer)))', // Nur Benutzer, keine Computer
        attributes: [
          'sAMAccountName', 
          'userAccountControl'
        ],
        sizeLimit: 5000 // Erhöhtes Limit für große OUs
      };

      client.search(ouDN, searchOptions, (err, searchRes) => {
        if (err) {
          client.destroy();
          return reject(err);
        }

        let users = [];
        let excludedCount = 0;

        searchRes.on('searchEntry', (entry) => {
          try {
            // Exclude users from _MS365 and Pooltest OUs by checking DN
            const entryDN = entry.dn ? entry.dn.toString() : entry.objectName;
            
            // Debug logging for _MS365 detection
            if (entryDN && (entryDN.includes('OU=_MS365') || entryDN.includes('OU=Pooltest'))) {
              excludedCount++;
              if (excludedCount <= 5) { // Only log first 5 exclusions to avoid spam
                console.log(`🚫 Excluding user from: ${entryDN}`);
              }
              return; // Skip users in _MS365 and Pooltest organizational units
            }

            // Additional debug for first few entries to see DN structure
            if (users.length < 3) {
              console.log(`🔍 Sample DN: ${entryDN}`);
            }

            // LDAP-Attribute extrahieren
            let attributes = {};
            if (entry.attributes && Array.isArray(entry.attributes)) {
              entry.attributes.forEach(attr => {
                attributes[attr.type] = attr.values || attr._vals || [attr.value];
              });
            } else if (entry.object) {
              attributes = entry.object;
            }

            const sAMAccountName = Array.isArray(attributes.sAMAccountName) ? 
                                  attributes.sAMAccountName[0] : attributes.sAMAccountName;
            const userAccountControl = Array.isArray(attributes.userAccountControl) ? 
                                      parseInt(attributes.userAccountControl[0]) : 
                                      parseInt(attributes.userAccountControl) || 0;

            // Prüfen ob Account aktiviert ist (Bit 2 = deaktiviert)
            const isEnabled = !(userAccountControl & 2);

            if (sAMAccountName && sAMAccountName.trim()) {
              users.push({
                username: sAMAccountName.trim(),
                enabled: isEnabled
              });
            }
          } catch (parseError) {
            console.warn(`⚠️ Fehler beim Parsen eines Benutzers in ${ouName}: ${parseError.message}`);
          }
        });

        searchRes.on('error', (err) => {
          client.destroy();
          reject(err);
        });

        searchRes.on('end', () => {
          const enabledUsers = users.filter(u => u.enabled);
          console.log(`${enabledUsers.length} Benutzer in OU ${ouName} gefunden (ohne _MS365 und Pooltest OUs)`);
          console.log(`🚫 ${excludedCount} Benutzer aus _MS365/Pooltest OUs ausgeschlossen`);
          console.log(`📍 ldapOUUtils.js VERSION 2.1 - _MS365 filtering ACTIVE`);
          
          client.destroy();
          resolve(enabledUsers); // Nur aktivierte Benutzer zurückgeben
        });
      });
    });
  });
};

/**
 * Verbesserte Benutzerstatistiken mit direkter OU-Abfrage
 */
export const getDirectOUUserStatistics = async () => {
  try {
    console.log('📊 Rufe LDAP-Benutzerstatistiken aus OUs ab...');
    
    const baseDN = process.env.LDAP_SEARCH_BASE;
    
    // Parallele OU-Abfragen für bessere Performance
    const [studentenUsers, angestellteUsers, gastdozentenUsers, itszUsers] = await Promise.all([
      getUsersFromOU(`OU=Studenten,${baseDN}`, 'Studenten').catch(() => []),
      getUsersFromOU(`OU=Angestellte,${baseDN}`, 'Angestellte').catch(() => []),
      getUsersFromOU(`OU=Gastdozenten,${baseDN}`, 'Gastdozenten').catch(() => []),
      getUsersFromOU(`OU=ITSZ,${baseDN}`, 'ITSZ').catch(() => [])
    ]);
    
    const totalStudenten = studentenUsers.length;
    const totalAngestellte = angestellteUsers.length;
    const totalGastdozenten = gastdozentenUsers.length;
    const totalITSZ = itszUsers.length;
    
    // Gesamtzahl aller Benutzer berechnen
    const totalUsers = totalStudenten + totalAngestellte + totalGastdozenten + totalITSZ;
    
    console.log(`📂 OU-basierte Statistiken: ${totalUsers} Gesamtbenutzer`);
    
    // Vollständiges Statistik-Objekt zurückgeben
    return {
      // Gesamtzahlen
      totalRegistered: totalUsers,
      activeToday: 0, // TODO: Aus echten Login-Logs implementieren
      newUsersThisMonth: null, // Keine Schätzungen mehr
      
      // Gruppierte Benutzerstatistiken
      groups: {
        studenten: totalStudenten,
        angestellte: totalAngestellte,
        gastdozenten: totalGastdozenten,
        mitarbeiter: totalAngestellte, // Legacy-Kompatibilität
        dozenten: null, // Keine Schätzung
        itsz: totalITSZ
      },
      
      // Metadaten
      lastUpdated: new Date().toISOString(),
      dataSource: 'ldap-ou-direct',
      details: {
        searchMethod: 'direct-ou-query',
        totalOUsQueried: 4,
        dataQuality: 'high'
      }
    };
    
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der OU-Benutzerstatistiken:', error.message);
    throw error;
  }
};
