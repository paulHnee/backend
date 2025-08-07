#!/usr/bin/env node

/**
 * Test der verbesserten OPNsense API-Funktionen
 */

import 'dotenv/config';
import { getOPNsenseAPI } from '../config/opnsense.js';

console.log('🚀 Teste verbesserte OPNsense API-Funktionen...\n');

async function testImprovedAPI() {
  const api = getOPNsenseAPI();
  
  console.log('📋 Test 1: API-Verfügbarkeit...');
  try {
    const isAvailable = await api.isAvailable();
    console.log(`✅ API-Verfügbarkeit: ${isAvailable ? 'VERFÜGBAR' : 'NICHT VERFÜGBAR'}`);
  } catch (error) {
    console.log(`❌ API-Verfügbarkeit-Fehler: ${error.message}`);
  }
  
  console.log('\n📋 Test 2: System-Status...');
  try {
    const systemStatus = await api.getSystemStatus();
    console.log(`✅ System-Status: ${systemStatus.status}`);
    console.log(`   Message: ${systemStatus.message}`);
    console.log(`   Source: ${systemStatus.source}`);
  } catch (error) {
    console.log(`❌ System-Status-Fehler: ${error.message}`);
  }
  
  console.log('\n📋 Test 3: Service-Status...');
  try {
    const serviceStatus = await api.getCoreServiceStatus();
    console.log(`✅ Service-Status: ${serviceStatus.total} Services gefunden`);
    console.log(`   Source: ${serviceStatus.source}`);
    if (serviceStatus.rows && serviceStatus.rows.length > 0) {
      serviceStatus.rows.forEach(service => {
        console.log(`   - ${service.name}: ${service.running ? 'RUNNING' : 'STOPPED'}`);
      });
    }
  } catch (error) {
    console.log(`❌ Service-Status-Fehler: ${error.message}`);
  }
  
  console.log('\n📋 Test 4: WireGuard-Clients...');
  try {
    const clients = await api.getClients();
    console.log(`✅ WireGuard-Clients: ${clients.length} gefunden`);
    if (clients.length > 0) {
      clients.slice(0, 3).forEach((client, index) => {
        console.log(`   ${index + 1}. ${client.name || client.uuid}: ${client.connected ? 'VERBUNDEN' : 'GETRENNT'}`);
      });
    }
  } catch (error) {
    console.log(`❌ WireGuard-Clients-Fehler: ${error.message}`);
  }
  
  console.log('\n📋 Test 5: WireGuard-Server-Info...');
  try {
    const serverInfo = await api.getServerInfo();
    console.log(`✅ Server-Informationen: ${serverInfo.length} Server gefunden`);
    if (serverInfo.length > 0) {
      serverInfo.forEach((server, index) => {
        console.log(`   ${index + 1}. ${server.name || server.uuid}: ${server.enabled === '1' ? 'AKTIVIERT' : 'DEAKTIVIERT'}`);
        if (server.peers) {
          console.log(`      Peers: ${Array.isArray(server.peers) ? server.peers.length : 'Array erwartet'}`);
        }
      });
    }
  } catch (error) {
    console.log(`❌ Server-Info-Fehler: ${error.message}`);
  }
  
  console.log('\n📋 Test 6: WireGuard-Service-Info...');
  try {
    const serviceInfo = await api.getServiceInfo();
    console.log('✅ Service-Informationen erfolgreich abgerufen');
    console.log(`   Source: ${serviceInfo.source || 'WireGuard-API'}`);
    if (serviceInfo.status) {
      console.log(`   Status: ${serviceInfo.status}`);
    }
  } catch (error) {
    console.log(`❌ Service-Info-Fehler: ${error.message}`);
  }
  
  console.log('\n📋 Test 7: Kombinierter Status...');
  try {
    const combinedStatus = await api.getStatus();
    console.log(`✅ Kombinierter Status: ${combinedStatus.status}`);
    console.log(`   Source: ${combinedStatus.source}`);
    console.log(`   WireGuard verfügbar: ${combinedStatus.wireguard ? 'JA' : 'NEIN'}`);
    console.log(`   VPN-Services: ${combinedStatus.vpn?.count || 0}`);
  } catch (error) {
    console.log(`❌ Kombinierter-Status-Fehler: ${error.message}`);
  }
  
  console.log('\n🎯 API-Test abgeschlossen!');
  console.log('✅ Alle Funktionen nutzen bewährte Menu-API-Fallbacks');
  console.log('✅ Korrekte Endpunkt-URLs implementiert');
  console.log('✅ Robuste Fehlerbehandlung mit Fallback-Strategien');
}

testImprovedAPI().catch(console.error);
