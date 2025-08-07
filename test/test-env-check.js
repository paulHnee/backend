#!/usr/bin/env node

/**
 * Umgebungsvariablen-Check für HNEE Backend
 */

// Lade dotenv-Konfiguration
import 'dotenv/config';

console.log('🔍 HNEE Backend Umgebungsvariablen-Check\n');

const requiredVars = [
  'LDAP_URL',
  'LDAP_BIND_DN', 
  'LDAP_BIND_CREDENTIALS',
  'LDAP_SEARCH_BASE',
  'OPNSENSE_HOST',
  'OPNSENSE_API_KEY',
  'OPNSENSE_API_SECRET'
];

const optionalVars = [
  'NODE_ENV',
  'PORT',
  'SESSION_SECRET',
  'FRONTEND_URL'
];

console.log('📋 Erforderliche Variablen:');
console.log('   ' + '─'.repeat(40));

let missingRequired = 0;
for (const varName of requiredVars) {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const display = value ? (varName.includes('CREDENTIALS') || varName.includes('SECRET') || varName.includes('KEY') 
    ? `***${value.slice(-4)}` 
    : value.length > 50 ? `${value.substring(0, 47)}...` : value) : 'NICHT GESETZT';
  
  console.log(`   ${status} ${varName}: ${display}`);
  if (!value) missingRequired++;
}

console.log('\n📋 Optionale Variablen:');
console.log('   ' + '─'.repeat(40));

for (const varName of optionalVars) {
  const value = process.env[varName];
  const status = value ? '✅' : '⚠️';
  const display = value ? (varName.includes('SECRET') 
    ? `***${value.slice(-4)}` 
    : value) : 'Standard wird verwendet';
  
  console.log(`   ${status} ${varName}: ${display}`);
}

console.log('\n🎯 Zusammenfassung:');
console.log(`   Erforderliche Variablen: ${requiredVars.length - missingRequired}/${requiredVars.length} gesetzt`);

if (missingRequired > 0) {
  console.log('\n❌ Fehlende erforderliche Variablen gefunden!');
  console.log('   Erstelle .env Datei oder setze Umgebungsvariablen.');
  process.exit(1);
} else {
  console.log('\n✅ Alle erforderlichen Umgebungsvariablen sind gesetzt!');
}

// Teste LDAP-Verbindung
console.log('\n🔍 Teste LDAP-Verbindung...');
if (process.env.LDAP_URL) {
  const ldapUrl = new URL(process.env.LDAP_URL);
  console.log(`   Host: ${ldapUrl.hostname}`);
  console.log(`   Port: ${ldapUrl.port || (ldapUrl.protocol === 'ldaps:' ? 636 : 389)}`);
  console.log(`   Protokoll: ${ldapUrl.protocol}`);
  console.log(`   TLS: ${ldapUrl.protocol === 'ldaps:' ? 'Ja' : 'Nein'}`);
}

// Teste OPNsense-Konfiguration
console.log('\n🔍 Teste OPNsense-Konfiguration...');
if (process.env.OPNSENSE_HOST) {
  console.log(`   Host: ${process.env.OPNSENSE_HOST}`);
  console.log(`   API Key gesetzt: ${process.env.OPNSENSE_API_KEY ? 'Ja' : 'Nein'}`);
  console.log(`   API Secret gesetzt: ${process.env.OPNSENSE_API_SECRET ? 'Ja' : 'Nein'}`);
}
