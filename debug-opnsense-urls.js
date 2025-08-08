#!/usr/bin/env node

/**
 * Debug script to compare URL construction between test and production
 */

import 'dotenv/config';
import { getOPNsenseAPI } from './config/opnsense.js';

console.log('🔍 Debugging OPNsense URL Construction...\n');

async function debugOPNsenseURLs() {
  
  console.log('📋 Test 1: Direct OPNsense API getInstance...');
  try {
    const opnsense = getOPNsenseAPI();
    console.log(`🔗 Host: ${opnsense.host}`);
    console.log(`🔗 Port: ${opnsense.port}`);
    console.log(`🔗 Base URL: ${opnsense.baseUrl}`);
    console.log(`🔗 Timeout: ${opnsense.timeout}`);
    console.log(`🔗 API Key present: ${!!opnsense.apiKey}`);
    console.log(`🔗 Configured: ${opnsense.configured}`);
    
    // Test URL construction manually
    const testEndpoint = '/api/wireguard/client/searchClient';
    console.log(`\n🔗 Test endpoint: ${testEndpoint}`);
    console.log(`🔗 Full URL would be: https://${opnsense.host}:${opnsense.port}${testEndpoint}`);
    
    // Test actual API call with extra debugging
    console.log('\n📡 Making actual API call...');
    const startTime = Date.now();
    const clients = await opnsense.getClients();
    const endTime = Date.now();
    
    console.log(`⏱️ API call took: ${endTime - startTime}ms`);
    console.log(`📊 Total clients returned: ${clients.length}`);
    
    if (clients.length > 0) {
      console.log(`📋 First client: ${JSON.stringify(clients[0], null, 2)}`);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(`❌ Stack: ${error.stack}`);
  }
  
  console.log('\n📋 Test 2: Environment variables check...');
  console.log(`🔗 OPNSENSE_HOST: ${process.env.OPNSENSE_HOST}`);
  console.log(`🔗 OPNSENSE_PORT: ${process.env.OPNSENSE_PORT}`);
  console.log(`🔗 OPNSENSE_TIMEOUT: ${process.env.OPNSENSE_TIMEOUT} (type: ${typeof process.env.OPNSENSE_TIMEOUT})`);
  console.log(`🔗 OPNSENSE_API_KEY: ${process.env.OPNSENSE_API_KEY ? 'Present (length: ' + process.env.OPNSENSE_API_KEY.length + ')' : 'Missing'}`);
  console.log(`🔗 OPNSENSE_API_SECRET: ${process.env.OPNSENSE_API_SECRET ? 'Present (length: ' + process.env.OPNSENSE_API_SECRET.length + ')' : 'Missing'}`);
  
  console.log('\n🎯 Debug completed!');
}

debugOPNsenseURLs().catch(console.error);
