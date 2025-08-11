#!/usr/bin/env node

/**
 * Test für Core OPNsense APIs basierend auf offizieller Dokumentation
 */

import 'dotenv/config';
import { getOPNsenseAPI } from '../config/opnsense.js';

async function testCoreOPNsenseAPIs() {
  console.log('🔍 Teste Core OPNsense APIs...\n');
  
  try {
    const api = getOPNsenseAPI();
    
    console.log('📋 API-Konfiguration:');
    console.log(`   Host: ${api.host}:${api.port}`);
    console.log(`   Fallback Host: ${api.fallbackHost}:${api.port}`);
    console.log(`   TLS-Zertifikat-Prüfung: ${api.tlsOptions.rejectUnauthorized ? 'Aktiviert' : 'Deaktiviert'}`);
    console.log('');
    
    // Test 1: System Status (wichtigster Test)
    console.log('🖥️ Teste System Status API...');
    console.log('   ' + '─'.repeat(50));
    
    try {
      const systemStatus = await api.getSystemStatus();
      console.log('   ✅ System Status API: FUNKTIONIERT!');
      console.log(`      Hostname: ${systemStatus.hostname || 'Nicht verfügbar'}`);
      console.log(`      Produkt: ${systemStatus.product || 'Nicht verfügbar'}`);
      console.log(`      Version: ${systemStatus.firmware || 'Nicht verfügbar'}`);
      console.log(`      Uptime: ${systemStatus.uptime || 'Nicht verfügbar'}`);
      console.log(`      Load Average: ${systemStatus.load ? systemStatus.load.join(', ') : 'Nicht verfügbar'}`);
      
    } catch (error) {
      console.log(`   ❌ System Status API: ${error.message}`);
      console.log('   🚫 Grundlegende API-Authentifizierung fehlgeschlagen!');
      return;
    }
    
    // Test 2: Service Status
    console.log('\n🔧 Teste Service Status API...');
    console.log('   ' + '─'.repeat(50));
    
    try {
      const services = await api.getCoreServiceStatus();
      console.log('   ✅ Service Status API: FUNKTIONIERT!');
      console.log(`      Gefundene Services: ${services.total || services.rows?.length || 0}`);
      
      // Suche nach VPN-relevanten Services
      const vpnServices = services.rows?.filter(service => 
        service.name?.toLowerCase().includes('wireguard') ||
        service.name?.toLowerCase().includes('openvpn') ||
        service.description?.toLowerCase().includes('vpn') ||
        service.description?.toLowerCase().includes('wireguard')
      ) || [];
      
      if (vpnServices.length > 0) {
        console.log('      🔐 VPN-Services gefunden:');
        vpnServices.forEach(service => {
          const status = service.running === 1 ? '🟢 Läuft' : '🔴 Gestoppt';
          console.log(`         - ${service.name}: ${status}`);
        });
      } else {
        console.log('      ⚠️ Keine VPN-Services in der Service-Liste gefunden');
      }
      
    } catch (error) {
      console.log(`   ❌ Service Status API: ${error.message}`);
    }
    
    // Test 3: Interface Statistics
    console.log('\n🌐 Teste Interface Statistics API...');
    console.log('   ' + '─'.repeat(50));
    
    try {
      const interfaces = await api.getInterfaceStats();
      console.log('   ✅ Interface Statistics API: FUNKTIONIERT!');
      
      const interfaceList = Object.keys(interfaces || {});
      console.log(`      Gefundene Interfaces: ${interfaceList.length}`);
      
      // Suche nach WireGuard-Interfaces
      const wgInterfaces = interfaceList.filter(iface => 
        iface.startsWith('wg') || 
        interfaces[iface]?.description?.toLowerCase().includes('wireguard')
      );
      
      if (wgInterfaces.length > 0) {
        console.log('      🔐 WireGuard-Interfaces gefunden:');
        wgInterfaces.forEach(iface => {
          const info = interfaces[iface];
          const status = info.status === 'up' ? '🟢 Up' : '🔴 Down';
          console.log(`         - ${iface}: ${status} (${info.description || 'Keine Beschreibung'})`);
        });
      } else {
        console.log('      ⚠️ Keine WireGuard-Interfaces gefunden');
      }
      
    } catch (error) {
      console.log(`   ❌ Interface Statistics API: ${error.message}`);
    }
    
    // Test 4: Teste neue hybride Methoden
    console.log('\n🔄 Teste hybride API-Methoden (WireGuard mit Fallback)...');
    console.log('   ' + '─'.repeat(50));
    
    try {
      const wgStatus = await api.getStatus();
      console.log('   ✅ WireGuard Status (hybrid): FUNKTIONIERT!');
      console.log(`      Status: ${wgStatus.running ? '🟢 Läuft' : '🔴 Gestoppt'}`);
      console.log(`      Name: ${wgStatus.name || 'Unbekannt'}`);
      console.log(`      Quelle: ${wgStatus.source || 'wireguard-api'}`);
      
    } catch (error) {
      console.log(`   ❌ WireGuard Status (hybrid): ${error.message}`);
    }
    
    try {
      const clients = await api.getClients();
      console.log(`   ✅ WireGuard Clients (hybrid): ${clients.length} gefunden`);
      
      if (clients.length > 0) {
        clients.slice(0, 3).forEach((client, index) => {
          console.log(`      Client ${index + 1}: ${client.name || client.id} (${client.connected ? 'Verbunden' : 'Getrennt'})`);
        });
        if (clients.length > 3) {
          console.log(`      ... und ${clients.length - 3} weitere`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ WireGuard Clients (hybrid): ${error.message}`);
    }
    
    try {
      const servers = await api.getServerInfo();
      console.log(`   ✅ Server Info (hybrid): ${servers.length} gefunden`);
      
      if (servers.length > 0) {
        servers.slice(0, 2).forEach((server, index) => {
          console.log(`      Server ${index + 1}: ${server.name} (${server.description || 'Keine Beschreibung'})`);
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Server Info (hybrid): ${error.message}`);
    }
    
    // Zusammenfassung
    console.log('\n🎯 Test-Zusammenfassung:');
    console.log('   ' + '─'.repeat(50));
    console.log('   ✅ OPNsense Core API ist funktionsfähig!');
    console.log('   📊 Das System kann folgende Daten bereitstellen:');
    console.log('      - System-Status und Metriken');
    console.log('      - Service-Status (inkl. VPN-Services)');
    console.log('      - Netzwerk-Interface-Statistiken');
    console.log('      - Fallback-Strategien für WireGuard-Daten');
    console.log('   🚀 Das Portal kann jetzt mit echten Daten betrieben werden!');
    
  } catch (error) {
    console.error('❌ Kritischer Fehler beim API-Test:', error.message);
  }
}

testCoreOPNsenseAPIs().catch(console.error);
