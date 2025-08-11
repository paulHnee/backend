#!/usr/bin/env node

/**
 * Einfacher Credentials-Test für OPNsense API
 */

import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testCredentials() {
  console.log('🔐 Teste OPNsense API-Credentials...\n');
  
  const host = process.env.OPNSENSE_HOST || 'vpn.hnee.de';
  const key = process.env.OPNSENSE_API_KEY;
  const secret = process.env.OPNSENSE_API_SECRET;
  
  if (!key || !secret) {
    console.log('❌ API-Credentials nicht gefunden!');
    return;
  }
  
  console.log(`Host: ${host}`);
  console.log(`API Key: ***${key.slice(-8)}`);
  console.log(`API Secret: ***${secret.slice(-8)}`);
  console.log('');
  
  // Teste verschiedene einfache Endpunkte
  const testEndpoints = [
    '/api/core/firmware/status',
    '/api/core/system/health',
    '/api/core/menu/search',
    '/api/diagnostics/interface/getArp',
    '/api/core/system/info'
  ];
  
  for (const endpoint of testEndpoints) {
    console.log(`🔗 Teste: ${endpoint}`);
    
    try {
      const curlCmd = `curl -k -u "${key}:${secret}" -s -w "\\nHTTP_CODE:%{http_code}\\n" "https://${host}${endpoint}"`;
      
      const { stdout, stderr } = await execAsync(curlCmd, { 
        timeout: 10000,
        encoding: 'utf8'
      });
      
      const lines = stdout.split('\n');
      const httpCodeLine = lines.find(line => line.startsWith('HTTP_CODE:'));
      const httpCode = httpCodeLine ? httpCodeLine.split(':')[1] : 'UNKNOWN';
      const responseBody = lines.filter(line => !line.startsWith('HTTP_CODE:')).join('\n').trim();
      
      console.log(`   Status: ${httpCode}`);
      
      if (httpCode === '200') {
        console.log('   ✅ Erfolgreich!');
        
        try {
          const jsonResponse = JSON.parse(responseBody);
          if (typeof jsonResponse === 'object') {
            const keys = Object.keys(jsonResponse);
            console.log(`   📊 JSON-Antwort mit ${keys.length} Eigenschaften`);
            
            // Zeige interessante Felder
            if (jsonResponse.hostname) console.log(`      Hostname: ${jsonResponse.hostname}`);
            if (jsonResponse.product) console.log(`      Produkt: ${jsonResponse.product}`);
            if (jsonResponse.version) console.log(`      Version: ${jsonResponse.version}`);
            if (jsonResponse.uptime) console.log(`      Uptime: ${jsonResponse.uptime}`);
          }
        } catch (parseError) {
          console.log(`   📄 Nicht-JSON Antwort: ${responseBody.substring(0, 100)}...`);
        }
        
        console.log('   🎯 API-Credentials funktionieren!\n');
        break; // Bei Erfolg stoppen
        
      } else if (httpCode === '401') {
        console.log('   ❌ 401 Unauthorized - API-Credentials sind falsch');
      } else if (httpCode === '403') {
        console.log('   ❌ 403 Forbidden - Keine Berechtigung für diesen Endpunkt');
      } else if (httpCode === '404') {
        console.log('   ⚠️ 404 Not Found - Endpunkt existiert nicht');
      } else {
        console.log(`   ⚠️ Unerwarteter Status: ${httpCode}`);
        if (responseBody) {
          console.log(`      Antwort: ${responseBody.substring(0, 100)}...`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Fehler: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('💡 Empfehlungen:');
  console.log('   - Bei 401: Prüfe API-Key und Secret');
  console.log('   - Bei 403: Prüfe Benutzer-Berechtigungen in OPNsense');
  console.log('   - Bei 404: Endpunkt existiert nicht (Plugin fehlt?)');
  console.log('   - Bei Erfolg: API ist grundsätzlich funktionsfähig');
}

testCredentials().catch(console.error);
