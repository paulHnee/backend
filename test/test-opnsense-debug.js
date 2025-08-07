#!/usr/bin/env node

/**
 * Debug-Script für OPNsense API-Probleme
 * 
 * Dieses Script testet verschiedene OPNsense API-Endpunkte und zeigt
 * die rohen Antworten, um Konfigurationsprobleme zu debuggen.
 */

// Lade dotenv-Konfiguration
import 'dotenv/config';
import { getOPNsenseAPI } from '../config/opnsense.js';

async function debugOPNsenseAPI() {
  console.log('🔍 OPNsense API Debug-Analyse startet...\n');
  
  try {
    const api = getOPNsenseAPI();
    
    console.log('📋 API-Konfiguration:');
    console.log(`   Host: ${api.host}`);
    console.log(`   Fallback Host: ${api.fallbackHost || 'Nicht konfiguriert'}`);
    console.log(`   API Key: ${api.apiKey ? '***' + api.apiKey.slice(-4) : 'Nicht konfiguriert'}`);
    console.log(`   API Secret: ${api.apiSecret ? '***' + api.apiSecret.slice(-4) : 'Nicht konfiguriert'}`);
    console.log('');
    
    // Test verschiedene Endpunkte basierend auf der offiziellen API-Dokumentation
    const endpoints = [
      { name: 'WireGuard Service Status', url: '/api/wireguard/service/status' },
      { name: 'WireGuard Service Show (detailliert)', url: '/api/wireguard/service/show' },
      { name: 'WireGuard Clients Search', url: '/api/wireguard/client/search_client' },
      { name: 'WireGuard Server Search', url: '/api/wireguard/server/search_server' },
      { name: 'WireGuard General Config', url: '/api/wireguard/general/get' },
      { name: 'WireGuard Client Get (alle)', url: '/api/wireguard/client/get' },
      { name: 'WireGuard Server Get (alle)', url: '/api/wireguard/server/get' },
      
      // Legacy/Fallback-Tests
      { name: 'Legacy WireGuard Status', url: '/service/status' },
      { name: 'Legacy WireGuard Clients', url: '/client/searchClient' },
      
      // System-APIs
      { name: 'Core System Status', url: '/api/core/system/status' },
      { name: 'API Root', url: '/api' }
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n🔗 Teste ${endpoint.name}: ${endpoint.url}`);
      console.log('   ' + '─'.repeat(50));
      
      try {
        // Verwende die rohe request-Methode für detaillierte Fehleranalyse
        const result = await api.request(endpoint.url, 'GET');
        console.log(`   ✅ Erfolgreich! Antwort-Typ: ${typeof result}`);
        
        if (result && typeof result === 'object') {
          const keys = Object.keys(result);
          console.log(`   📊 Objekt mit ${keys.length} Eigenschaften: [${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}]`);
          
          // Zeige wichtige Felder
          if (result.rows) console.log(`   🔢 Rows: ${result.rows.length} Einträge`);
          if (result.status) console.log(`   📍 Status: ${result.status}`);
          if (result.running !== undefined) console.log(`   🏃 Running: ${result.running}`);
          if (result.isRunning !== undefined) console.log(`   🏃 IsRunning: ${result.isRunning}`);
        } else {
          console.log(`   📄 Einfache Antwort: ${JSON.stringify(result).substring(0, 100)}...`);
        }
        
      } catch (error) {
        console.log(`   ❌ Fehler: ${error.message}`);
        
        // Detaillierte Fehleranalyse
        if (error.message.includes('JSON Parse Error')) {
          console.log('   🔍 Dies ist ein JSON-Parse-Fehler - Server gibt wahrscheinlich HTML statt JSON zurück');
        } else if (error.message.includes('400')) {
          console.log('   🔍 HTTP 400 - Fehlerhafter Request, möglicherweise falscher Endpunkt');
        } else if (error.message.includes('401')) {
          console.log('   🔍 HTTP 401 - Authentifizierung fehlgeschlagen');
        } else if (error.message.includes('404')) {
          console.log('   🔍 HTTP 404 - Endpunkt nicht gefunden');
        } else if (error.message.includes('ECONNREFUSED')) {
          console.log('   🔍 Verbindung verweigert - Server nicht erreichbar');
        }
      }
    }
    
    console.log('\n🎯 Debug-Analyse abgeschlossen');
    console.log('\n💡 Empfehlungen:');
    console.log('   - Bei JSON Parse Errors: Prüfe ob WireGuard-Plugin installiert ist');
    console.log('   - Bei 401 Errors: Prüfe API-Key und Secret in Umgebungsvariablen');
    console.log('   - Bei 404 Errors: Verwende korrekte API-Endpunkte für deine OPNsense-Version');
    console.log('   - Bei Connection Errors: Prüfe Netzwerkverbindung und HTTPS-Konfiguration');
    
  } catch (error) {
    console.error('❌ Kritischer Fehler beim Debug:', error.message);
  }
}

// Script ausführen
debugOPNsenseAPI().catch(console.error);
