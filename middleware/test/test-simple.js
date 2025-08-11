#!/usr/bin/env node

/**
 * Einfacher Test nur für den funktionierenden Menu-Endpunkt
 */

import 'dotenv/config';
import { getOPNsenseAPI } from '../config/opnsense.js';

async function testWorkingEndpoint() {
  console.log('🔍 Teste funktionierenden Menu-Endpunkt...\n');
  
  try {
    const api = getOPNsenseAPI();
    
    console.log('📋 Teste /api/core/menu/search...');
    const result = await api.request('/api/core/menu/search');
    
    console.log('\n✅ Menu-API erfolgreich!');
    console.log(`📊 Antwort-Typ: ${typeof result}`);
    
    if (result && typeof result === 'object') {
      const keys = Object.keys(result);
      console.log(`📊 ${keys.length} Eigenschaften gefunden`);
      console.log(`🗂️ Top-Level-Keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
      
      // Zeige Struktur
      keys.slice(0, 3).forEach(key => {
        const value = result[key];
        if (typeof value === 'object' && value !== null) {
          const subKeys = Object.keys(value);
          console.log(`   ${key}: Objekt mit ${subKeys.length} Eigenschaften`);
        } else {
          console.log(`   ${key}: ${typeof value}`);
        }
      });
    }
    
    console.log('\n🎯 Node.js API-Client funktioniert mit OPNsense!');
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  }
}

testWorkingEndpoint().catch(console.error);
