#!/usr/bin/env node

/**
 * Debug test for LDAP OU filtering
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, 'test/.env') });

import { getUsersFromOU } from '../utils/ldapOUUtils.js';

console.log('🔍 Testing LDAP OU filtering for _MS365 exclusion...');
console.log(`LDAP URL: ${process.env.LDAP_URL}`);
console.log(`LDAP Base: ${process.env.LDAP_SEARCH_BASE}\n`);

async function testOUFiltering() {
  try {
    console.log('📊 Testing Angestellte OU with filtering...');
    const angestellte = await getUsersFromOU('OU=Angestellte,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Angestellte');
    console.log(`✅ Found ${angestellte.length} Angestellte (should be ~263 without _MS365)`);
    
    console.log('\n📊 Testing Studenten OU with filtering...');
    const studenten = await getUsersFromOU('OU=Studenten,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Studenten');
    console.log(`✅ Found ${studenten.length} Studenten (should exclude _MS365 and Pooltest)`);
    
    const total = angestellte.length + studenten.length;
    console.log(`\n🎯 TOTAL with OU filtering: ${total}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testOUFiltering();
