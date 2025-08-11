#!/usr/bin/env node

/**
 * VPN/OPNsense Connection Test with proper .env loading
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from test/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('🔍 Testing VPN/OPNsense Connection...\n');

// Check environment variables
console.log('📋 Environment Configuration:');
console.log(`OPNSENSE_HOST: ${process.env.OPNSENSE_HOST || 'vpn.hnee.de (default)'}`);
console.log(`OPNSENSE_IP: ${process.env.OPNSENSE_IP || '10.1.1.48 (default)'}`);
console.log(`OPNSENSE_PORT: ${process.env.OPNSENSE_PORT || '443 (default)'}`);
console.log(`OPNSENSE_API_KEY: ${process.env.OPNSENSE_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`OPNSENSE_API_SECRET: ${process.env.OPNSENSE_API_SECRET ? '✅ Set' : '❌ Missing'}`);
console.log(`OPNSENSE_TIMEOUT: ${process.env.OPNSENSE_TIMEOUT || '10000 (default)'}\n`);

// Test basic connectivity
import { getOPNsenseAPI } from '../config/opnsense.js';

async function testVPNConnection() {
  try {
    console.log('🌐 Testing OPNsense API Connection...');
    const api = getOPNsenseAPI();
    
    console.log('🧪 Testing System Status...');
    const systemStatus = await api.getSystemStatus().catch(err => {
      console.warn(`⚠️ System Status failed: ${err.message}`);
      return null;
    });
    
    if (systemStatus) {
      console.log('✅ System Status: Success');
    }
    
    console.log('\n🧪 Testing WireGuard Status...');
    const status = await api.getStatus().catch(err => {
      console.warn(`⚠️ WireGuard Status failed: ${err.message}`);
      return null;
    });
    
    if (status) {
      console.log('✅ WireGuard Status: Success');
      console.log('WireGuard Info:', {
        status: status.status,
        wireguard: status.wireguard,
        vpn: status.vpn
      });
    }
    
    console.log('\n🧪 Testing Clients...');
    const clients = await api.getClients().catch(err => {
      console.warn(`⚠️ Clients failed: ${err.message}`);
      return null;
    });
    
    if (clients) {
      console.log(`✅ Clients: Found ${clients.length} clients`);
      if (clients.length > 0) {
        console.log('Sample client:', clients[0]);
      }
    }
    
    console.log('\n🧪 Testing Service Info...');
    const serviceInfo = await api.getServiceInfo().catch(err => {
      console.warn(`⚠️ Service Info failed: ${err.message}`);
      return null;
    });
    
    if (serviceInfo) {
      console.log('✅ Service Info: Success');
      console.log('Service Info:', serviceInfo);
    }
    
  } catch (error) {
    console.error('❌ VPN Connection Test failed:', error.message);
  }
}

testVPNConnection();
