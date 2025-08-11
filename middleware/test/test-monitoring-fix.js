#!/usr/bin/env node

/**
 * Test Monitoring Controller VPN Fix
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from test/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = dirname(__dirname);
dotenv.config({ path: join(testDir, '.env') });

console.log('🔍 Testing VPN monitoring fix...\n');

// Import monitoring controller
import { getPortalStats } from '../controllers/monitoringController.js';

async function testVPNMonitoring() {
  try {
    console.log('🧪 Testing getPortalStats()...');
    
    // Create mock request and response objects
    const req = { user: { isAdmin: true } };
    const res = {
      json: (data) => {
        console.log('✅ Portal stats retrieved successfully!');
        console.log('\n📊 VPN Statistics:');
        console.log(`Total Peers: ${data.vpn.totalPeers}`);
        console.log(`Connected Peers: ${data.vpn.connectedPeers}`);
        console.log(`Active Today: ${data.vpn.activeToday}`);
        console.log(`Active This Week: ${data.vpn.activeThisWeek}`);
        console.log(`Server Reachable: ${data.vpn.serverReachable}`);
        console.log(`Service Running: ${data.vpn.serviceRunning}`);
        console.log(`Data Source: ${data.vpn.dataSource}`);
        
        console.log('\n📊 User Statistics:');
        console.log(`Employees: ${data.users.employees}`);
        console.log(`Students: ${data.users.students}`);
      },
      status: (code) => ({ json: (data) => console.error('Error:', code, data) })
    };
    
    await getPortalStats(req, res);
    
  } catch (error) {
    console.error('❌ Monitoring test failed:', error.message);
  }
}

testVPNMonitoring();
