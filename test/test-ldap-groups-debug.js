#!/usr/bin/env node

/**
 * LDAP Groups Debug Test Script
 * 
 * Testet die LDAP-Gruppensuche mit erweiterten Debug-Informationen
 * um herauszufinden, warum keine Gruppen gefunden werden.
 * 
 * @author Paul Buchwald - ITSZ Team
 */

import 'dotenv/config';
import { searchGroups } from '../utils/ldapUtils.js';
import ldapjs from 'ldapjs';

console.log('🔍 LDAP Groups Debug Test gestartet...\n');

// Umgebungsvariablen prüfen
console.log('📋 LDAP-Konfiguration:');
console.log(`   LDAP_URL: ${process.env.LDAP_URL}`);
console.log(`   LDAP_SEARCH_BASE: ${process.env.LDAP_SEARCH_BASE}`);
console.log(`   LDAP_BIND_DN: ${process.env.LDAP_BIND_DN}`);
console.log(`   LDAP_BIND_CREDENTIALS: ${process.env.LDAP_BIND_CREDENTIALS ? '***CONFIGURED***' : 'NOT SET'}\n`);

/**
 * Test 1: Basis-LDAP-Verbindung
 */
async function testBasicConnection() {
  console.log('🔗 Test 1: Basis-LDAP-Verbindung...');
  
  return new Promise((resolve, reject) => {
    const client = ldapjs.createClient({
      url: process.env.LDAP_URL,
      timeout: 30000,
      connectTimeout: 10000
    });

    client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_CREDENTIALS, (err) => {
      if (err) {
        console.error('❌ LDAP-Verbindung fehlgeschlagen:', err.message);
        client.destroy();
        return reject(err);
      }
      
      console.log('✅ LDAP-Verbindung erfolgreich');
      client.destroy();
      resolve();
    });
  });
}

/**
 * Test 2: Verzeichnisstruktur erkunden
 */
async function exploreDirectory() {
  console.log('\n🗂️ Test 2: Verzeichnisstruktur erkunden...');
  
  return new Promise((resolve, reject) => {
    const client = ldapjs.createClient({
      url: process.env.LDAP_URL,
      timeout: 30000,
      connectTimeout: 10000
    });

    client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_CREDENTIALS, (err) => {
      if (err) {
        client.destroy();
        return reject(err);
      }

      // Allgemeine Suche in der Basis-DN
      const searchOptions = {
        scope: 'one', // Nur erste Ebene
        filter: '(objectClass=*)',
        attributes: ['cn', 'name', 'ou', 'objectClass', 'dn']
      };

      client.search(process.env.LDAP_SEARCH_BASE, searchOptions, (err, searchRes) => {
        if (err) {
          client.destroy();
          return reject(err);
        }

        let entries = [];

        searchRes.on('searchEntry', (entry) => {
          const attrs = entry.object || entry.attributes;
          entries.push({
            dn: entry.dn,
            objectClass: attrs.objectClass,
            name: attrs.cn || attrs.name || attrs.ou
          });
          console.log(`   📁 ${entry.dn} (${attrs.objectClass})`);
        });

        searchRes.on('error', (err) => {
          client.destroy();
          reject(err);
        });

        searchRes.on('end', () => {
          console.log(`✅ ${entries.length} Einträge in Root-Verzeichnis gefunden`);
          client.destroy();
          resolve(entries);
        });
      });
    });
  });
}

/**
 * Test 3: Verschiedene Filter testen
 */
async function testDifferentFilters() {
  console.log('\n🔍 Test 3: Verschiedene LDAP-Filter testen...');
  
  const filters = [
    '(objectClass=group)',
    '(objectClass=groupOfNames)',
    '(objectClass=posixGroup)',
    '(objectClass=organizationalUnit)',
    '(cn=*)',
    '(name=*)',
    '(ou=*)'
  ];
  
  for (const filter of filters) {
    console.log(`\n🔧 Filter: ${filter}`);
    await testSpecificFilter(filter);
  }
}

async function testSpecificFilter(filter) {
  return new Promise((resolve, reject) => {
    const client = ldapjs.createClient({
      url: process.env.LDAP_URL,
      timeout: 30000,
      connectTimeout: 10000
    });

    client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_CREDENTIALS, (err) => {
      if (err) {
        client.destroy();
        return reject(err);
      }

      const searchOptions = {
        scope: 'sub',
        filter: filter,
        attributes: ['cn', 'name', 'ou', 'objectClass'],
        sizeLimit: 10 // Nur erste 10 für Übersicht
      };

      client.search(process.env.LDAP_SEARCH_BASE, searchOptions, (err, searchRes) => {
        if (err) {
          console.log(`   ❌ Fehler: ${err.message}`);
          client.destroy();
          return resolve();
        }

        let count = 0;
        searchRes.on('searchEntry', (entry) => {
          count++;
          const attrs = entry.object || entry.attributes;
          console.log(`   📋 ${attrs.cn || attrs.name || attrs.ou || 'Unbekannt'} (${attrs.objectClass})`);
        });

        searchRes.on('error', (err) => {
          console.log(`   ❌ Search-Fehler: ${err.message}`);
          client.destroy();
          resolve();
        });

        searchRes.on('end', () => {
          console.log(`   ✅ ${count} Einträge gefunden`);
          client.destroy();
          resolve();
        });
      });
    });
  });
}

/**
 * Test 4: searchGroups-Funktion testen
 */
async function testSearchGroups() {
  console.log('\n📋 Test 4: searchGroups-Funktion testen...');
  
  try {
    const groups = await searchGroups('*');
    console.log(`✅ searchGroups erfolgreich: ${groups.length} Gruppen gefunden`);
    
    if (groups.length > 0) {
      console.log('\n📋 Gefundene Gruppen:');
      groups.slice(0, 10).forEach((group, index) => {
        console.log(`   ${index + 1}. ${group.name} (${group.memberCount} Mitglieder) - ${group.type || 'Group'}`);
      });
      
      if (groups.length > 10) {
        console.log(`   ... und ${groups.length - 10} weitere Gruppen`);
      }
    }
    
    return groups;
  } catch (error) {
    console.error('❌ searchGroups fehlgeschlagen:', error.message);
    throw error;
  }
}

/**
 * Haupttest-Funktion
 */
async function runAllTests() {
  try {
    await testBasicConnection();
    await exploreDirectory();
    await testDifferentFilters();
    await testSearchGroups();
    
    console.log('\n🎉 Alle Tests abgeschlossen!');
    
  } catch (error) {
    console.error('\n❌ Test fehlgeschlagen:', error.message);
    process.exit(1);
  }
}

// Tests ausführen
runAllTests();
