#!/usr/bin/env node

/**
 * Test der funktionierenden OPNsense API-Integration
 */

import 'dotenv/config';
import { getOPNsenseAPI } from '../config/opnsense.js';

console.log('🔍 Teste funktionierende OPNsense API-Integration...\n');

async function testWorkingAPI() {
    const api = getOPNsenseAPI();
    
    // Test 1: System Status
    console.log('📋 Test 1: System Status...');
    try {
        const systemStatus = await api.getSystemStatus();
        console.log('✅ System Status erfolgreich:');
        console.log(`   Status: ${systemStatus.status}`);
        console.log(`   Message: ${systemStatus.message}`);
        console.log(`   Menu Items: ${systemStatus.menuItems}`);
        console.log(`   Available Modules: ${systemStatus.availableModules?.join(', ')}`);
        console.log(`   Source: ${systemStatus.source}`);
    } catch (error) {
        console.log('❌ System Status Fehler:', error.message);
    }
    
    // Test 2: Service Status  
    console.log('\n📋 Test 2: Service Status...');
    try {
        const serviceStatus = await api.getCoreServiceStatus();
        console.log('✅ Service Status erfolgreich:');
        console.log(`   Total Services: ${serviceStatus.total}`);
        console.log(`   Source: ${serviceStatus.source}`);
        
        if (serviceStatus.rows && serviceStatus.rows.length > 0) {
            console.log('   Services:');
            serviceStatus.rows.forEach(service => {
                console.log(`     - ${service.name} (${service.id}): ${service.running ? 'Running' : 'Stopped'}`);
            });
        }
    } catch (error) {
        console.log('❌ Service Status Fehler:', error.message);
    }
    
    // Test 3: Hybrid Status (wie im Monitoring Controller verwendet)
    console.log('\n📋 Test 3: Hybrid Status (Complete)...');
    try {
        const hybridStatus = await api.getStatus();
        console.log('✅ Hybrid Status erfolgreich:');
        console.log(`   Status: ${hybridStatus.status}`);
        console.log(`   Source: ${hybridStatus.source}`);
        console.log(`   Has Services: ${hybridStatus.services ? 'Yes' : 'No'}`);
        console.log(`   Has System Info: ${hybridStatus.system ? 'Yes' : 'No'}`);
    } catch (error) {
        console.log('❌ Hybrid Status Fehler:', error.message);
    }
}

testWorkingAPI().catch(console.error);
