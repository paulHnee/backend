#!/usr/bin/env node

/**
 * VPN Peer Data Investigation - Find the right API call
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from test/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = dirname(__dirname);
dotenv.config({ path: join(testDir, '.env') });

console.log('🔍 Testing which API call returns actual peer data...\n');

// Test basic connectivity
import { getOPNsenseAPI } from '../config/opnsense.js';

async function findPeerDataSource() {
  try {
    const api = getOPNsenseAPI();
    
    console.log('🧪 Testing getServiceInfo()...');
    const serviceInfo = await api.getServiceInfo().catch(err => {
      console.warn(`⚠️ getServiceInfo failed: ${err.message}`);
      return null;
    });
    
    if (serviceInfo) {
      console.log('✅ getServiceInfo() result type:', typeof serviceInfo);
      console.log('getServiceInfo() keys:', Object.keys(serviceInfo));
      if (serviceInfo.peers) console.log('getServiceInfo() peers count:', serviceInfo.peers?.length);
      if (Array.isArray(serviceInfo)) console.log('getServiceInfo() array length:', serviceInfo.length);
    }
    
    console.log('\n🧪 Testing getServerInfo()...');
    const serverInfo = await api.getServerInfo().catch(err => {
      console.warn(`⚠️ getServerInfo failed: ${err.message}`);
      return null;
    });
    
    if (serverInfo) {
      console.log('✅ getServerInfo() result type:', typeof serverInfo);
      console.log('getServerInfo() keys:', Object.keys(serverInfo));
      if (serverInfo.peers) console.log('getServerInfo() peers count:', serverInfo.peers?.length);
      if (Array.isArray(serverInfo)) console.log('getServerInfo() array length:', serverInfo.length);
    }
    
    console.log('\n🧪 Testing getClients()...');
    const clients = await api.getClients().catch(err => {
      console.warn(`⚠️ getClients failed: ${err.message}`);
      return null;
    });
    
    if (clients) {
      console.log('✅ getClients() result type:', typeof clients);
      if (Array.isArray(clients)) {
        console.log('getClients() array length:', clients.length);
        if (clients.length > 0) {
          console.log('getClients() first item keys:', Object.keys(clients[0]));
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

findPeerDataSource();
