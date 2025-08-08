#!/usr/bin/env node

/**
 * Production server test for _MS365 filtering
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, 'test/.env') });

import { getUsersFromOU } from '../utils/ldapOUUtils.js';

console.log('🔍 PRODUCTION SERVER TEST: Testing _MS365 filtering...\n');

async function testProduction() {
  try {
    console.log('📊 Testing ONLY Angestellte OU with filtering...');
    const angestellte = await getUsersFromOU('OU=Angestellte,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Angestellte');
    
    console.log(`\n🎯 RESULT: ${angestellte.length} Angestellte found`);
    console.log(`Expected: ~255 (with _MS365 filtering)`);
    console.log(`Previous: 578 (without _MS365 filtering)`);
    
    if (angestellte.length < 300) {
      console.log('✅ FILTERING IS WORKING! _MS365 accounts excluded.');
    } else {
      console.log('❌ FILTERING NOT WORKING! Still includes _MS365 accounts.');
      console.log('🔄 Server needs restart to load new ldapOUUtils.js');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testProduction();
