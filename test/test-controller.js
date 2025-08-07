#!/usr/bin/env node

/**
 * Test des Monitoring Controllers mit der neuen API
 */

import 'dotenv/config';
import { getWireGuardServiceStatus } from '../controllers/monitoringController.js';

console.log('🔍 Teste Monitoring Controller mit neuer OPNsense API...\n');

// Mock Request und Response
const mockReq = {
  user: { username: 'test-user' }
};

const mockRes = {
  json: (data) => {
    console.log('✅ Controller Response:');
    console.log(JSON.stringify(data, null, 2));
  },
  status: (code) => ({
    json: (data) => {
      console.log(`❌ Error Response (${code}):`);
      console.log(JSON.stringify(data, null, 2));
    }
  })
};

async function testController() {
  console.log('📋 Teste getWireGuardServiceStatus...');
  try {
    await getWireGuardServiceStatus(mockReq, mockRes);
  } catch (error) {
    console.error('❌ Controller Fehler:', error.message);
  }
}

testController().catch(console.error);
