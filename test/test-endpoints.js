#!/usr/bin/env node

/**
 * Test verschiedener OPNsense API-Endpunkte
 */

import 'dotenv/config';
import { getOPNsenseAPI } from '../config/opnsense.js';

console.log('🔍 Teste verschiedene API-Endpunkte...\n');

async function testEndpoints() {
    const api = getOPNsenseAPI();
    
    // Test 1: Menu search ohne Body (GET-like)
    try {
        console.log('📋 Test 1: /api/core/menu/search ohne Body...');
        const result = await api.request('/api/core/menu/search', 'POST');
        console.log('✅ Menu-Search erfolgreich:', Object.keys(result || {}).length, 'items');
    } catch (error) {
        console.log('❌ Menu-Search Fehler:', error.message);
    }
    
    // Test 2: Menu search mit leerem Object
    try {
        console.log('\n📋 Test 2: /api/core/menu/search mit leerem Body...');
        const result = await api.request('/api/core/menu/search', 'POST', {});
        console.log('✅ Menu-Search erfolgreich:', Object.keys(result || {}).length, 'items');
    } catch (error) {
        console.log('❌ Menu-Search Fehler:', error.message);
    }
    
    // Test 3: System Status via GET 
    try {
        console.log('\n📋 Test 3: /api/core/system/getStatus via GET...');
        const result = await api.request('/api/core/system/getStatus', 'GET');
        console.log('✅ System Status erfolgreich:', typeof result);
    } catch (error) {
        console.log('❌ System Status Fehler:', error.message);
    }
    
    // Test 4: Service Status
    try {
        console.log('\n📋 Test 4: /api/core/service/getStatus...');
        const result = await api.request('/api/core/service/getStatus', 'POST', {});
        console.log('✅ Service Status erfolgreich:', typeof result);
    } catch (error) {
        console.log('❌ Service Status Fehler:', error.message);
    }
    
    // Test 5: Simple GET auf Root
    try {
        console.log('\n📋 Test 5: Simple GET /api/core/menu...');
        const result = await api.request('/api/core/menu', 'GET');
        console.log('✅ Menu GET erfolgreich:', typeof result);
    } catch (error) {
        console.log('❌ Menu GET Fehler:', error.message);
    }
}

testEndpoints().catch(console.error);
