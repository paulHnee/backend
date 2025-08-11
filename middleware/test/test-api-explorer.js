#!/usr/bin/env node

/**
 * Erkunde verfügbare OPNsense API-Endpunkte über Menu-System
 */

import 'dotenv/config';
import { getOPNsenseAPI } from '../config/opnsense.js';

async function exploreAvailableAPIs() {
  console.log('🔍 Erkunde verfügbare OPNsense API-Endpunkte...\n');
  
  try {
    const api = getOPNsenseAPI();
    
    // Lade Menu-Struktur
    console.log('📋 Lade OPNsense Menu-Struktur...');
    const menuData = await api.request('/api/core/menu/search', 'POST', {});
    
    console.log(`✅ Menu-Daten erfolgreich geladen!\n`);
    
    // Durchsuche Menu nach API-Endpunkten
    const apiEndpoints = [];
    
    function searchForAPIs(obj, path = '') {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          if (value.Url && value.Url.includes('/api/')) {
            apiEndpoints.push({
              path: `${path}${key}`,
              url: value.Url,
              title: value.title || key,
              cssClass: value.cssClass || ''
            });
          }
          searchForAPIs(value, `${path}${key}/`);
        }
      }
    }
    
    searchForAPIs(menuData);
    
    console.log(`🔗 Gefundene API-Endpunkte: ${apiEndpoints.length}\n`);
    
    // Kategorisiere Endpunkte
    const categories = {
      system: [],
      network: [],
      vpn: [],
      firewall: [],
      services: [],
      other: []
    };
    
    apiEndpoints.forEach(endpoint => {
      const url = endpoint.url.toLowerCase();
      const title = endpoint.title.toLowerCase();
      
      if (url.includes('system') || title.includes('system')) {
        categories.system.push(endpoint);
      } else if (url.includes('interface') || url.includes('network') || title.includes('interface')) {
        categories.network.push(endpoint);
      } else if (url.includes('vpn') || url.includes('wireguard') || url.includes('openvpn') || title.includes('vpn')) {
        categories.vpn.push(endpoint);
      } else if (url.includes('firewall') || title.includes('firewall')) {
        categories.firewall.push(endpoint);
      } else if (url.includes('service') || title.includes('service')) {
        categories.services.push(endpoint);
      } else {
        categories.other.push(endpoint);
      }
    });
    
    // Zeige kategorisierte Endpunkte
    for (const [category, endpoints] of Object.entries(categories)) {
      if (endpoints.length > 0) {
        console.log(`📁 ${category.toUpperCase()} (${endpoints.length} Endpunkte):`);
        console.log('   ' + '─'.repeat(50));
        
        endpoints.slice(0, 5).forEach(endpoint => {
          console.log(`   📍 ${endpoint.title}`);
          console.log(`      URL: ${endpoint.url}`);
          console.log(`      Pfad: ${endpoint.path}`);
          console.log('');
        });
        
        if (endpoints.length > 5) {
          console.log(`   ... und ${endpoints.length - 5} weitere\n`);
        }
      }
    }
    
    // Teste die wichtigsten verfügbaren Endpunkte
    console.log('🧪 Teste verfügbare Endpunkte...\n');
    
    const testEndpoints = [
      ...categories.system.slice(0, 2),
      ...categories.network.slice(0, 2),
      ...categories.vpn.slice(0, 2),
      ...categories.services.slice(0, 2)
    ].map(e => e.url);
    
    for (const endpoint of testEndpoints) {
      try {
        console.log(`🔗 Teste: ${endpoint}`);
        
        if (endpoint.includes('search') || endpoint.includes('get')) {
          // GET-Endpunkt
          const result = await api.request(endpoint);
          console.log(`   ✅ GET erfolgreich! (${typeof result})`);
          
          if (result && typeof result === 'object') {
            const keys = Object.keys(result);
            console.log(`      📊 ${keys.length} Eigenschaften: [${keys.slice(0, 3).join(', ')}...]`);
          }
        } else {
          // Möglicherweise POST-Endpunkt
          console.log(`   ⚠️ Übersprungen (vermutlich POST-Endpunkt)`);
        }
        
      } catch (error) {
        if (error.message.includes('403')) {
          console.log(`   ❌ 403 Forbidden - Keine Berechtigung`);
        } else if (error.message.includes('404')) {
          console.log(`   ❌ 404 Not Found - Endpunkt nicht verfügbar`);
        } else {
          console.log(`   ❌ Fehler: ${error.message.substring(0, 50)}...`);
        }
      }
      
      console.log('');
    }
    
    console.log('🎯 Empfehlungen für das Portal:');
    console.log('   ' + '─'.repeat(50));
    console.log('   ✅ Menu-API funktioniert - verwende diese für dynamische Navigation');
    console.log('   📊 Konzentriere dich auf verfügbare System-Metriken');
    console.log('   🔄 Implementiere Fallback-Strategien für eingeschränkte APIs');
    console.log('   🚀 Das Portal kann mit verfügbaren Daten betrieben werden!');
    
  } catch (error) {
    console.error('❌ Fehler beim Erkunden der APIs:', error.message);
  }
}

exploreAvailableAPIs().catch(console.error);
