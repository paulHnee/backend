#!/usr/bin/env node

/**
 * Test für Angestellten-Zählung im Monitoring-Controller
 * 
 * Dieses Skript testet, ob die "WissenschaftlicheMitarbeiter" Gruppe 
 * korrekt zu den Angestellten gezählt wird.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setze Umgebungsvariablen für den Test (Mock-Werte)
process.env.LDAP_URL = 'ldaps://dc1.fh-eberswalde.de:636';
process.env.LDAP_BIND_DN = 'CN=service-account,OU=Service,DC=fh-eberswalde,DC=de';
process.env.LDAP_BIND_CREDENTIALS = 'mock-password';
process.env.LDAP_SEARCH_BASE = 'OU=FH-Eberswalde,DC=fh-eberswalde,DC=de';

async function testAngestellteMonitoring() {
  try {
    console.log('🧪 Teste Angestellten-Monitoring...\n');
    
    // Importiere die monitoring functions
    const monitoring = await import('../controllers/monitoringController.js');
    
    // Mock-Request für Admin-User
    const mockReq = {
      user: {
        username: 'test-admin',
        roles: ['ITSZadmins', 'admin'],
        isAdmin: true
      },
      headers: { 'user-agent': 'test-script' }
    };
    
    let resultData = null;
    
    // Mock-Response Object
    const mockRes = {
      json: (data) => {
        resultData = data;
        console.log('✅ Portal-Statistiken erfolgreich abgerufen\n');
      },
      status: (code) => ({
        json: (data) => {
          console.error(`❌ Fehler ${code}:`, data);
          resultData = { error: data, statusCode: code };
        }
      })
    };
    
    // Führe den Test aus
    await monitoring.getPortalStats(mockReq, mockRes);
    
    if (resultData && !resultData.error) {
      console.log('📊 ERGEBNISSE:');
      console.log('================');
      console.log(`Total Registriert: ${resultData.users?.totalRegistered || 0}`);
      console.log(`Studenten: ${resultData.users?.groups?.studenten || 0}`);
      console.log(`Angestellte: ${resultData.users?.groups?.angestellte || 0}`);
      console.log(`Gastdozenten: ${resultData.users?.groups?.gastdozenten || 0}`);
      console.log(`ITSZ: ${resultData.users?.groups?.itsz || 0}`);
      console.log(`Datenquelle: ${resultData.users?.dataSource || 'unbekannt'}`);
      
      // Analyse der Ergebnisse
      const angestellte = resultData.users?.groups?.angestellte || 0;
      const totalRegistered = resultData.users?.totalRegistered || 0;
      
      console.log('\n🔍 ANALYSE:');
      console.log('=============');
      
      if (angestellte === 191) {
        console.log('✅ WissenschaftlicheMitarbeiter (191) wurden korrekt als Angestellte gezählt!');
      } else if (angestellte > 0) {
        console.log(`⚠️ Angestellte: ${angestellte} (erwartet waren ~191 von WissenschaftlicheMitarbeiter)`);
      } else {
        console.log('❌ Keine Angestellten gefunden - möglicherweise LDAP-Verbindungsproblem');
      }
      
      if (totalRegistered > 2000) {
        console.log(`✅ Plausible Gesamtzahl: ${totalRegistered} (sollte >2000 sein für Hochschule)`);
      } else {
        console.log(`⚠️ Geringe Gesamtzahl: ${totalRegistered} (erwartet >2000 für Hochschule)`);
      }
      
    } else {
      console.error('❌ Test fehlgeschlagen:', resultData?.error || 'Unbekannter Fehler');
    }
    
  } catch (error) {
    console.error('❌ Test-Fehler:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test ausführen
testAngestellteMonitoring().then(() => {
  console.log('\n🏁 Test abgeschlossen');
  process.exit(0);
}).catch(err => {
  console.error('💥 Test fehlgeschlagen:', err);
  process.exit(1);
});
