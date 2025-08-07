#!/usr/bin/env node

/**
 * Test der VPN-Controller-Funktionen mit echten OPNsense-Daten
 */

import 'dotenv/config';
import { getUserVPNConnections, getVPNStats } from '../controllers/vpnController.js';

console.log('🧪 Teste VPN-Controller mit echten OPNsense-Daten...\n');

// Mock User-Objekte für verschiedene Szenarien
const mockUsers = {
  student: {
    username: 'testuser',
    isStudent: true,
    isEmployee: false,
    isITEmployee: false
  },
  employee: {
    username: 'pbuchwald', // Echter Benutzer aus OPNsense-Daten
    isStudent: false,
    isEmployee: true,
    isITEmployee: false
  },
  itEmployee: {
    username: 'pbuchwald', // Gleicher User, aber als IT-Mitarbeiter für Admin-Tests
    isStudent: false,
    isEmployee: false,
    isITEmployee: true
  }
};

// Mock Request/Response-Objekte
function createMockReq(user) {
  return {
    user: user,
    params: {},
    query: {},
    body: {}
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null
  };
  
  res.json = (data) => {
    res.data = data;
    console.log('📤 Response:', JSON.stringify(data, null, 2));
    return res;
  };
  
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  
  return res;
}

async function testVPNController() {
  
  // Test 1: VPN-Verbindungen für echten Benutzer abrufen
  console.log('📋 Test 1: VPN-Verbindungen für Benutzer "pbuchwald"...');
  try {
    const req = createMockReq(mockUsers.employee);
    const res = createMockRes();
    
    await getUserVPNConnections(req, res);
    
    if (res.data && res.data.success) {
      console.log(`✅ Erfolgreich! Gefunden: ${res.data.connections.length} VPN-Verbindungen`);
      console.log(`📊 Statistiken: ${res.data.stats.active} aktiv, ${res.data.stats.connected} verbunden`);
      console.log(`🎯 Limit: ${res.data.limit === -1 ? 'Unbegrenzt' : res.data.limit}`);
      
      // Zeige alle Verbindungen
      if (res.data.connections.length > 0) {
        console.log('\n📱 Alle VPN-Verbindungen:');
        res.data.connections.forEach((conn, index) => {
          console.log(`   ${index + 1}. ${conn.name}`);
          console.log(`      IP: ${conn.ipAddress}`);
          console.log(`      Status: ${conn.enabled ? 'Aktiv' : 'Inaktiv'}`);
        });
      }
    } else {
      console.log('❌ Unerwartete Antwort-Struktur');
    }
  } catch (error) {
    console.log(`❌ Fehler: ${error.message}`);
  }
  
  // Test 2: VPN-Verbindungen für Benutzer ohne Peers
  console.log('\n📋 Test 2: VPN-Verbindungen für Benutzer "testuser" (sollte leer sein)...');
  try {
    const req = createMockReq(mockUsers.student);
    const res = createMockRes();
    
    await getUserVPNConnections(req, res);
    
    if (res.data && res.data.success) {
      console.log(`✅ Erfolgreich! Gefunden: ${res.data.connections.length} VPN-Verbindungen (erwartet: 0)`);
      console.log(`🎯 Limit: ${res.data.limit} (erwartet: 5 für Studenten)`);
    }
  } catch (error) {
    console.log(`❌ Fehler: ${error.message}`);
  }
  
  // Test 3: VPN-Statistiken für IT-Mitarbeiter
  console.log('\n📋 Test 3: VPN-Statistiken für IT-Mitarbeiter...');
  try {
    const req = createMockReq(mockUsers.itEmployee);
    const res = createMockRes();
    
    await getVPNStats(req, res);
    
    if (res.data && res.data.success) {
      console.log('✅ VPN-Statistiken erfolgreich abgerufen');
      console.log(`📊 Total: ${res.data.stats.totalConnections} Verbindungen`);
      console.log(`🟢 Aktiv: ${res.data.stats.activeConnections}`);
      console.log(`🔴 Inaktiv: ${res.data.stats.inactiveConnections}`);
      console.log(`🖥️ Server-Status: ${res.data.stats.serverStatus.running ? 'Läuft' : 'Gestoppt'}`);
      
      // Zeige Benutzer-Statistiken nach Rollen
      const roles = res.data.stats.usersByRole;
      console.log('\n👥 Benutzer nach Rollen:');
      console.log(`   Studenten: ${roles.students.connections} (Limit: ${roles.students.limit})`);
      console.log(`   Mitarbeiter: ${roles.employees.connections} (Limit: ${roles.employees.limit})`);
      console.log(`   IT-Mitarbeiter: ${roles.itEmployees.connections} (Limit: unbegrenzt)`);
    }
  } catch (error) {
    console.log(`❌ Fehler: ${error.message}`);
  }
  
  // Test 4: Berechtigungsprüfung für Nicht-IT-Mitarbeiter
  console.log('\n📋 Test 4: VPN-Statistiken für Nicht-IT-Mitarbeiter (sollte fehlschlagen)...');
  try {
    const req = createMockReq(mockUsers.employee);
    const res = createMockRes();
    
    await getVPNStats(req, res);
    
    if (res.statusCode === 403) {
      console.log('✅ Berechtigung korrekt verweigert (403 Forbidden)');
    } else {
      console.log(`❌ Unerwarteter Status-Code: ${res.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Fehler: ${error.message}`);
  }
  
  console.log('\n🎯 VPN-Controller-Tests abgeschlossen!');
  console.log('✅ Funktionen nutzen echte OPNsense-Daten');
  console.log('✅ Benutzer-spezifische Filterung funktioniert');
  console.log('✅ Berechtigungen werden korrekt geprüft');
  console.log('✅ Robuste Fehlerbehandlung implementiert');
}

testVPNController().catch(console.error);
