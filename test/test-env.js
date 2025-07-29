/**
 * Test für Umgebungsvariablen
 */

import 'dotenv/config';

console.log('=== Umgebungsvariablen Test ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Definiert' : 'Nicht definiert');
console.log('LDAP_URL:', process.env.LDAP_URL);
console.log('LDAP_BIND_DN:', process.env.LDAP_BIND_DN);
console.log('LDAP_BIND_CREDENTIALS:', process.env.LDAP_BIND_CREDENTIALS ? 'Definiert' : 'Nicht definiert');
console.log('LDAP_SEARCH_BASE:', process.env.LDAP_SEARCH_BASE);
console.log('LDAP_SEARCH_FILTER:', process.env.LDAP_SEARCH_FILTER);

// Test LDAP-Verbindung
import ldapAuth from '../config/ldap.js';

console.log('\n=== LDAP Test ===');
try {
  ldapAuth.authenticate('test', 'test', (err, user) => {
    if (err) {
      console.log('LDAP Auth Test - Expected error:', err.message);
    } else {
      console.log('LDAP Auth Test - Unexpected success:', user);
    }
    
    // Test getUserInfo
    ldapAuth.getUserInfo('pbuchwald', (err, userInfo) => {
      if (err) {
        console.error('getUserInfo Error:', err);
      } else {
        console.log('getUserInfo Success:', userInfo);
      }
      process.exit(0);
    });
  });
} catch (error) {
  console.error('LDAP Test Error:', error);
  process.exit(1);
}
