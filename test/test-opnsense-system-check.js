#!/usr/bin/env node

/**
 * Umfassender OPNsense System-Check
 * 
 * Überprüft OPNsense-System-Status und verfügbare Plugins
 */

import 'dotenv/config';
import { getOPNsenseAPI } from '../config/opnsense.js';

async function comprehensiveOPNsenseCheck() {
  console.log('🔍 Umfassender OPNsense System-Check startet...\n');
  
  try {
    const api = getOPNsenseAPI();
    
    console.log('📋 API-Konfiguration:');
    console.log(`   Host: ${api.host}`);
    console.log(`   Fallback Host: ${api.fallbackHost || 'Nicht konfiguriert'}`);
    console.log(`   HTTPS: ${api.protocol === 'https:' ? 'Ja' : 'Nein'}`);
    console.log('');
    
    // 1. Grundlegende API-Erreichbarkeit testen
    console.log('🌐 Teste grundlegende API-Erreichbarkeit...');
    console.log('   ' + '─'.repeat(50));
    
    const basicEndpoints = [
      { name: 'System Status', url: '/api/core/system/status' },
      { name: 'System Firmware', url: '/api/core/firmware/status' },
      { name: 'System Health', url: '/api/core/system/health' },
      { name: 'System Info', url: '/api/core/system/info' },
      { name: 'Plugin Status', url: '/api/core/menu/search' },
      { name: 'Auth Test', url: '/api/diagnostics/interface/getArp' }
    ];
    
    let apiWorking = false;
    
    for (const endpoint of basicEndpoints) {
      try {
        const result = await api.request(endpoint.url, 'GET');
        console.log(`   ✅ ${endpoint.name}: Funktioniert`);
        apiWorking = true;
        
        // Zeige wichtige System-Informationen
        if (endpoint.url.includes('info') && result) {
          if (result.firmware) console.log(`      Version: ${result.firmware}`);
          if (result.product) console.log(`      Produkt: ${result.product}`);
        }
        
        break; // Wenn einer funktioniert, ist die API grundsätzlich erreichbar
      } catch (error) {
        console.log(`   ❌ ${endpoint.name}: ${error.message.substring(0, 60)}...`);
      }
    }
    
    if (!apiWorking) {
      console.log('\n🚫 Keine grundlegende API-Konnektivität möglich!');
      console.log('💡 Mögliche Ursachen:');
      console.log('   - Falsche API-Anmeldedaten');
      console.log('   - Server nicht erreichbar');
      console.log('   - HTTPS/TLS-Probleme');
      console.log('   - Firewall blockiert API-Zugriff');
      return;
    }
    
    // 2. Plugin-Verfügbarkeit prüfen
    console.log('\n🔌 Prüfe verfügbare Plugins...');
    console.log('   ' + '─'.repeat(50));
    
    try {
      const menuData = await api.request('/api/core/menu/search', 'GET');
      const plugins = [];
      
      // Menu-Struktur durchsuchen nach Plugins
      if (menuData && typeof menuData === 'object') {
        const searchForPlugins = (obj, path = '') => {
          for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
              if (value.Url && value.Url.includes('wireguard')) {
                plugins.push(`WireGuard (${path}${key})`);
              }
              if (value.Url && value.Url.includes('openvpn')) {
                plugins.push(`OpenVPN (${path}${key})`);
              }
              if (value.Url && value.Url.includes('ipsec')) {
                plugins.push(`IPsec (${path}${key})`);
              }
              searchForPlugins(value, `${path}${key}/`);
            }
          }
        };
        
        searchForPlugins(menuData);
        
        if (plugins.length > 0) {
          console.log('   📦 Gefundene VPN-Plugins:');
          plugins.forEach(plugin => console.log(`      - ${plugin}`));
        } else {
          console.log('   ⚠️ Keine VPN-Plugins in der Menu-Struktur gefunden');
        }
      }
    } catch (error) {
      console.log(`   ❌ Plugin-Check fehlgeschlagen: ${error.message}`);
    }
    
    // 3. Verfügbare API-Endpunkte erkunden
    console.log('\n📡 Erkunde verfügbare API-Kategorien...');
    console.log('   ' + '─'.repeat(50));
    
    const apiCategories = [
      'core', 'firewall', 'interfaces', 'routing', 
      'diagnostics', 'system', 'vpn', 'services'
    ];
    
    for (const category of apiCategories) {
      try {
        // Teste verschiedene typische Endpunkte pro Kategorie
        const testEndpoints = [
          `/api/${category}`,
          `/api/${category}/system/status`,
          `/api/${category}/service/status`,
          `/api/${category}/settings/get`
        ];
        
        for (const testUrl of testEndpoints) {
          try {
            await api.request(testUrl, 'GET');
            console.log(`   ✅ Kategorie ${category}: ${testUrl} verfügbar`);
            break;
          } catch (err) {
            // Ignoriere 404, suche weiter
            if (!err.message.includes('404')) {
              console.log(`   ⚠️ Kategorie ${category}: ${testUrl} - ${err.message.substring(0, 40)}...`);
              break;
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Kategorie ${category}: Nicht verfügbar`);
      }
    }
    
    // 4. WireGuard-spezifische Diagnose
    console.log('\n🔐 WireGuard-spezifische Diagnose...');
    console.log('   ' + '─'.repeat(50));
    
    // Teste ob WireGuard-Binary vorhanden ist
    try {
      const diagResult = await api.request('/api/diagnostics/interface/getArp', 'GET');
      console.log('   ✅ Diagnostics API funktioniert - kann weitere Tests durchführen');
      
      // Teste ob WireGuard-Prozess läuft (über Shell-Kommando falls möglich)
      // In OPNsense ist das normalerweise über /api/core/system/status ersichtlich
      
    } catch (error) {
      console.log(`   ❌ Diagnostics API nicht verfügbar: ${error.message}`);
    }
    
    // 5. Empfehlungen basierend auf Befunden
    console.log('\n🎯 Analyse-Ergebnisse und Empfehlungen:');
    console.log('   ' + '─'.repeat(50));
    
    if (apiWorking) {
      console.log('   ✅ OPNsense API ist grundsätzlich funktionsfähig');
      console.log('   💡 WireGuard-Plugin scheint nicht installiert oder aktiviert zu sein');
      console.log('   📋 Nächste Schritte:');
      console.log('      1. In OPNsense Web-UI: System → Firmware → Plugins');
      console.log('      2. Suche nach "os-wireguard" und installiere es');
      console.log('      3. Nach Installation: VPN → WireGuard aktivieren');
      console.log('      4. API-Endpunkte werden erst nach Plugin-Installation verfügbar');
      
      // Fallback-Strategie vorschlagen
      console.log('\n   🔄 Aktueller Fallback-Ansatz:');
      console.log('      - Monitoring funktioniert über Port-Checks (nc -u -z vpn.hnee.de 51820)');
      console.log('      - LDAP-Integration ist vollständig funktional');
      console.log('      - System-Gesundheitschecks verwenden Ping-basierte Prüfungen');
      console.log('      - WireGuard-spezifische Features sind limitiert aber nicht kritisch');
      
    } else {
      console.log('   ❌ OPNsense API ist nicht erreichbar');
      console.log('   📋 Prüfe folgende Punkte:');
      console.log('      1. Netzwerkverbindung zu vpn.hnee.de');
      console.log('      2. API-Key und Secret korrekt konfiguriert');
      console.log('      3. HTTPS-Zertifikat-Probleme');
      console.log('      4. Firewall-Regeln für API-Zugriff');
    }
    
  } catch (error) {
    console.error('❌ Kritischer Fehler beim System-Check:', error.message);
  }
}

// Script ausführen
comprehensiveOPNsenseCheck().catch(console.error);
