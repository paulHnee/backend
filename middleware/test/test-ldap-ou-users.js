#!/usr/bin/env node

/**
 * LDAP OU Users Test Script
 * 
 * Testet das Abrufen von Benutzern aus den spezifischen OUs:
 * - Angestellte
 * - Studenten  
 * - Gastdozenten
 * 
 * @author Paul Buchwald - ITSZ Team
 */

import 'dotenv/config';
import ldapjs from 'ldapjs';

console.log('🔍 LDAP OU Users Test gestartet...\n');

// LDAP-Konfiguration anzeigen
console.log('📋 LDAP-Konfiguration:');
console.log(`   LDAP_URL: ${process.env.LDAP_URL}`);
console.log(`   LDAP_SEARCH_BASE: ${process.env.LDAP_SEARCH_BASE}`);
console.log(`   LDAP_BIND_DN: ${process.env.LDAP_BIND_DN}\n`);

/**
 * Benutzer aus einer spezifischen OU abrufen
 */
async function getUsersFromOU(ouDN, ouName) {
  console.log(`\n👥 Abrufen der Benutzer aus OU: ${ouName}`);
  console.log(`   DN: ${ouDN}`);
  
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
        console.error(`   ❌ LDAP-Bind fehlgeschlagen: ${err.message}`);
        client.destroy();
        return reject(err);
      }

      // Suche nach Benutzern in der OU
      const searchOptions = {
        scope: 'sub', // Unterverzeichnisse einschließen
        filter: '(&(objectClass=user)(!(objectClass=computer)))', // Nur Benutzer, keine Computer
        attributes: [
          'sAMAccountName', 
          'cn', 
          'mail', 
          'displayName', 
          'userAccountControl',
          'objectClass',
          'distinguishedName'
        ],
        sizeLimit: 5000 // Erhöhtes Limit für große OUs
      };

      console.log(`   🔍 Suche mit Filter: ${searchOptions.filter}`);

      client.search(ouDN, searchOptions, (err, searchRes) => {
        if (err) {
          console.error(`   ❌ Suche fehlgeschlagen: ${err.message}`);
          client.destroy();
          return reject(err);
        }

        let users = [];
        let count = 0;

        searchRes.on('searchEntry', (entry) => {
          try {
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
            const cn = Array.isArray(attributes.cn) ? 
                      attributes.cn[0] : attributes.cn;
            const mail = Array.isArray(attributes.mail) ? 
                        attributes.mail[0] : attributes.mail;
            const displayName = Array.isArray(attributes.displayName) ? 
                               attributes.displayName[0] : attributes.displayName;
            const userAccountControl = Array.isArray(attributes.userAccountControl) ? 
                                      parseInt(attributes.userAccountControl[0]) : 
                                      parseInt(attributes.userAccountControl) || 0;

            // Prüfen ob Account aktiviert ist (Bit 2 = deaktiviert)
            const isEnabled = !(userAccountControl & 2);

            if (sAMAccountName && sAMAccountName.trim()) {
              users.push({
                username: sAMAccountName.trim(),
                cn: cn || '',
                mail: mail || '',
                displayName: displayName || '',
                enabled: isEnabled,
                dn: entry.dn ? entry.dn.toString() : 'unknown'
              });

              count++;
              
              // Zeige erste 5 Benutzer als Beispiel
              if (count <= 5) {
                console.log(`   👤 ${count}. ${sAMAccountName} (${displayName || cn || 'Kein Name'}) - ${isEnabled ? 'Aktiviert' : 'Deaktiviert'}`);
              }
            }
          } catch (parseError) {
            console.warn(`   ⚠️ Fehler beim Parsen eines Benutzers: ${parseError.message}`);
          }
        });

        searchRes.on('error', (err) => {
          console.error(`   ❌ Search-Error: ${err.message}`);
          client.destroy();
          reject(err);
        });

        searchRes.on('end', () => {
          console.log(`   ✅ ${users.length} Benutzer in OU ${ouName} gefunden`);
          
          // Statistiken
          const enabledUsers = users.filter(u => u.enabled);
          const disabledUsers = users.filter(u => !u.enabled);
          
          console.log(`   📊 Aktivierte Benutzer: ${enabledUsers.length}`);
          console.log(`   📊 Deaktivierte Benutzer: ${disabledUsers.length}`);
          
          if (users.length > 5) {
            console.log(`   📝 ... und ${users.length - 5} weitere Benutzer`);
          }

          client.destroy();
          resolve({
            ouName,
            ouDN,
            totalUsers: users.length,
            enabledUsers: enabledUsers.length,
            disabledUsers: disabledUsers.length,
            users: users
          });
        });
      });
    });
  });
}

/**
 * Test alle relevanten OUs
 */
async function testAllOUs() {
  const baseDN = process.env.LDAP_SEARCH_BASE;
  
  const ous = [
    {
      name: 'Studenten',
      dn: `OU=Studenten,${baseDN}`
    },
    {
      name: 'Angestellte', 
      dn: `OU=Angestellte,${baseDN}`
    },
    {
      name: 'Gastdozenten',
      dn: `OU=Gastdozenten,${baseDN}`
    },
    {
      name: 'ITSZ',
      dn: `OU=ITSZ,${baseDN}`
    }
  ];

  const results = [];

  for (const ou of ous) {
    try {
      const result = await getUsersFromOU(ou.dn, ou.name);
      results.push(result);
    } catch (error) {
      console.error(`❌ Fehler bei OU ${ou.name}: ${error.message}`);
      results.push({
        ouName: ou.name,
        ouDN: ou.dn,
        totalUsers: 0,
        enabledUsers: 0,
        disabledUsers: 0,
        users: [],
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Zeige Zusammenfassung
 */
function showSummary(results) {
  console.log('\n📊 ZUSAMMENFASSUNG DER OU-BENUTZER:');
  console.log('═'.repeat(60));
  
  let totalAll = 0;
  let totalEnabled = 0;
  
  results.forEach(result => {
    if (result.error) {
      console.log(`❌ ${result.ouName.padEnd(15)} FEHLER: ${result.error}`);
    } else {
      console.log(`✅ ${result.ouName.padEnd(15)} ${result.totalUsers.toString().padStart(4)} Benutzer (${result.enabledUsers} aktiviert, ${result.disabledUsers} deaktiviert)`);
      totalAll += result.totalUsers;
      totalEnabled += result.enabledUsers;
    }
  });
  
  console.log('─'.repeat(60));
  console.log(`🔢 GESAMT:${' '.repeat(10)} ${totalAll.toString().padStart(4)} Benutzer (${totalEnabled} aktiviert)`);
  console.log('═'.repeat(60));
}

/**
 * Haupttest-Funktion
 */
async function runUserTest() {
  try {
    console.log('🚀 Starte OU-Benutzer-Analyse...\n');
    
    const results = await testAllOUs();
    showSummary(results);
    
    console.log('\n🎉 OU-Benutzer-Test abgeschlossen!');
    
    return results;
    
  } catch (error) {
    console.error('\n❌ Test fehlgeschlagen:', error.message);
    process.exit(1);
  }
}

// Test ausführen
runUserTest();
