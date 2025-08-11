#!/usr/bin/env node
/**
 * Test Script für Monitoring-Endpunkte mit Authentifizierung
 * 
 * Dieser Script testet die Monitoring-Endpunkte mit korrekter Authentifizierung,
 * um sicherzustellen, dass sie funktionieren, wenn der Benutzer angemeldet ist.
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

// Test-Credentials (diese sollten in einer echten Umgebung aus .env kommen)
const TEST_USER = {
  username: process.env.TEST_USERNAME || 'testuser',
  password: process.env.TEST_PASSWORD || 'testpass'
};

async function testMonitoringAuth() {
  console.log('🧪 Teste Monitoring-Endpunkte mit Authentifizierung...\n');
  
  // Erstelle eine Axios-Instanz mit Cookie-Support
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    withCredentials: true, // Wichtig für Session-Cookies
    validateStatus: (status) => status < 500, // Akzeptiere alle Antworten < 500
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'HNEE-Monitoring-Test/1.0'
    }
  });

  try {
    // 1. Teste Health-Endpunkt (sollte ohne Auth funktionieren)
    console.log('1️⃣ Teste öffentlichen Health-Endpunkt...');
    const healthResponse = await client.get('/api/monitoring/health');
    console.log(`   ✅ Health Status: ${healthResponse.status} - ${healthResponse.data?.status || 'OK'}`);
    
    // 2. Teste geschützten Stats-Endpunkt (sollte 401 zurückgeben)
    console.log('\n2️⃣ Teste geschützten Stats-Endpunkt ohne Authentifizierung...');
    const statsResponse = await client.get('/api/monitoring/stats');
    console.log(`   📊 Stats Status: ${statsResponse.status} - ${statsResponse.data?.error || statsResponse.data?.message || 'Unexpected response'}`);
    
    if (statsResponse.status === 401) {
      console.log('   ✅ Korrekt: Endpunkt ist geschützt (401 Unauthorized)');
    } else {
      console.log('   ⚠️  Unerwarteter Status - Endpunkt sollte 401 zurückgeben');
    }
    
    // 3. Versuche Anmeldung (falls Credentials verfügbar)
    if (TEST_USER.username && TEST_USER.password) {
      console.log('\n3️⃣ Versuche Anmeldung...');
      try {
        const loginResponse = await client.post('/api/auth/login', {
          username: TEST_USER.username,
          password: TEST_USER.password
        });
        
        if (loginResponse.status === 200) {
          console.log('   ✅ Anmeldung erfolgreich');
          
          // 4. Teste Stats-Endpunkt mit Authentifizierung
          console.log('\n4️⃣ Teste Stats-Endpunkt mit Authentifizierung...');
          const authStatsResponse = await client.get('/api/monitoring/stats');
          console.log(`   📊 Auth Stats Status: ${authStatsResponse.status}`);
          
          if (authStatsResponse.status === 200) {
            console.log('   ✅ Monitoring-Endpunkt funktioniert mit Authentifizierung');
            console.log(`   📈 Daten erhalten: ${Object.keys(authStatsResponse.data || {}).join(', ')}`);
          } else {
            console.log(`   ❌ Fehler: ${authStatsResponse.data?.error || 'Unbekannter Fehler'}`);
          }
          
        } else {
          console.log(`   ❌ Anmeldung fehlgeschlagen: ${loginResponse.status}`);
        }
      } catch (loginError) {
        console.log(`   ❌ Anmeldung fehlgeschlagen: ${loginError.message}`);
      }
    } else {
      console.log('\n3️⃣ Überspringe Anmeldung (keine Test-Credentials verfügbar)');
      console.log('   💡 Setze TEST_USERNAME und TEST_PASSWORD Umgebungsvariablen für vollständigen Test');
    }
    
  } catch (error) {
    console.error('❌ Test fehlgeschlagen:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Stelle sicher, dass der Server läuft: npm start');
    }
  }
  
  console.log('\n🏁 Test abgeschlossen');
}

// Script ausführen
testMonitoringAuth().catch(console.error);
