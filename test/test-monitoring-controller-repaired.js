#!/usr/bin/env node

/**
 * Test für den reparierten Monitoring Controller
 * Prüft alle wichtigen Endpunkte mit den neuen OU-basierten LDAP-Statistiken
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🧪 Starte Test des reparierten Monitoring Controllers...\n');

// Test-Konfiguration
const baseUrl = 'https://localhost:5000';
const endpoints = [
    { 
        name: 'Portal Statistics', 
        path: '/api/monitoring/portal-stats',
        expectedFields: ['users', 'vpn', 'timestamp', 'status']
    },
    { 
        name: 'Health Check', 
        path: '/api/monitoring/health',
        expectedFields: ['status', 'timestamp', 'services']
    },
    { 
        name: 'System Status', 
        path: '/api/monitoring/system-status',
        expectedFields: ['status', 'timestamp', 'components']
    },
    { 
        name: 'LDAP Groups Debug', 
        path: '/api/monitoring/debug/ldap-groups',
        expectedFields: ['totalGroups', 'groups', 'timestamp']
    }
];

// Test-Utility-Funktion
async function testEndpoint(endpoint) {
    try {
        console.log(`📊 Teste: ${endpoint.name} (${endpoint.path})`);
        
        const curlCommand = `curl -k -s -w "\\n%{http_code}" "${baseUrl}${endpoint.path}"`;
        const { stdout, stderr } = await execAsync(curlCommand);
        
        if (stderr) {
            console.error(`❌ cURL-Fehler: ${stderr}`);
            return false;
        }
        
        const lines = stdout.trim().split('\n');
        const httpCode = lines[lines.length - 1];
        const responseBody = lines.slice(0, -1).join('\n');
        
        console.log(`   HTTP Status: ${httpCode}`);
        
        if (httpCode !== '200') {
            console.error(`❌ Fehlerhafter HTTP-Status: ${httpCode}`);
            console.error(`   Response: ${responseBody}`);
            return false;
        }
        
        try {
            const data = JSON.parse(responseBody);
            
            // Prüfe erwartete Felder
            const missingFields = endpoint.expectedFields.filter(field => !(field in data));
            if (missingFields.length > 0) {
                console.warn(`⚠️ Fehlende Felder: ${missingFields.join(', ')}`);
            }
            
            // Spezielle Prüfung für Portal Statistics
            if (endpoint.path === '/api/monitoring/portal-stats') {
                if (data.users && data.users.totalRegistered) {
                    console.log(`   ✅ LDAP-Benutzer gefunden: ${data.users.totalRegistered} gesamt`);
                    if (data.users.groups) {
                        console.log(`   📊 Studenten: ${data.users.groups.studenten}`);
                        console.log(`   📊 Angestellte: ${data.users.groups.angestellte}`);
                        console.log(`   📊 Gastdozenten: ${data.users.groups.gastdozenten}`);
                        console.log(`   📊 ITSZ: ${data.users.groups.itsz}`);
                    }
                } else {
                    console.warn(`⚠️ Keine LDAP-Benutzerstatistiken in Response`);
                }
            }
            
            // Spezielle Prüfung für LDAP Groups Debug
            if (endpoint.path === '/api/monitoring/debug/ldap-groups') {
                if (data.totalGroups !== undefined) {
                    console.log(`   ✅ LDAP-Gruppen gefunden: ${data.totalGroups} Gruppen`);
                    if (data.groups && data.groups.length > 0) {
                        console.log(`   📋 Erste Gruppe: ${data.groups[0].name} (${data.groups[0].dn})`);
                    }
                }
            }
            
            console.log(`   ✅ ${endpoint.name}: SUCCESS\n`);
            return true;
            
        } catch (parseError) {
            console.error(`❌ JSON-Parse-Fehler: ${parseError.message}`);
            console.error(`   Response: ${responseBody}`);
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Test-Fehler für ${endpoint.name}: ${error.message}\n`);
        return false;
    }
}

// Haupt-Test-Funktion
async function runTests() {
    console.log(`🎯 Teste Backend-Endpunkte auf ${baseUrl}\n`);
    
    let successCount = 0;
    const totalTests = endpoints.length;
    
    for (const endpoint of endpoints) {
        const success = await testEndpoint(endpoint);
        if (success) {
            successCount++;
        }
        
        // Kurze Pause zwischen Tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('='.repeat(60));
    console.log(`📊 Test-Ergebnisse: ${successCount}/${totalTests} erfolgreich`);
    
    if (successCount === totalTests) {
        console.log('🎉 Alle Tests erfolgreich! Monitoring Controller ist voll funktionsfähig.');
        console.log('✅ Die neuen OU-basierten LDAP-Statistiken funktionieren korrekt.');
    } else {
        console.log(`⚠️ ${totalTests - successCount} Test(s) fehlgeschlagen. Weitere Überprüfung notwendig.`);
    }
    
    console.log('='.repeat(60));
}

// Test ausführen
runTests().catch(error => {
    console.error('❌ Test-Skript fehlgeschlagen:', error.message);
    process.exit(1);
});
