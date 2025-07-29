/**
 * Test-Script für LDAP-Gruppenabfragen
 * Verwende dieses Script um zu testen, welche Gruppen ein Benutzer hat
 */

import 'dotenv/config';
import ldapAuth from '../config/ldap.js';

// Ersetze 'username' mit dem gewünschten Benutzernamen
const testUsername = 'pbuchwald'; // Beispiel

console.log(`Testing LDAP groups for user: ${testUsername}`);

// Test 1: Standard getUserInfo
console.log('\n=== Test 1: Standard getUserInfo ===');
ldapAuth.getUserInfo(testUsername, (err, userInfo) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('\n=== LDAP User Information ===');
    console.log('Username:', userInfo.username);
    console.log('Display Name:', userInfo.displayName);
    console.log('Email:', userInfo.email);
    console.log('\n=== All Groups ===');
    console.log(userInfo.groups);
    console.log('\n=== Filtered Roles ===');
    console.log(userInfo.roles);
    
    console.log('\n=== Group Check ===');
    const targetGroups = ['IT-Mitarbeiter', 'ITSZadmins', 'Mitarbeiter', 'Studenten', 'GastDozenten', 'Dozenten'];
    
    targetGroups.forEach(targetGroup => {
      const hasGroup = userInfo.groups.some(group => 
        group.toLowerCase() === targetGroup.toLowerCase()
      );
      console.log(`${targetGroup}: ${hasGroup ? '✓' : '✗'}`);
    });
  }

  // Test 2: Reverse Search als Fallback
  console.log('\n=== Test 2: Reverse Group Search ===');
  ldapAuth.findUserGroupsByReverseSearch(testUsername, (err, groups) => {
    if (err) {
      console.error('Reverse search error:', err);
    } else {
      console.log('Groups found via reverse search:', groups);
      
      console.log('\n=== Reverse Search Group Check ===');
      const targetGroups = ['IT-Mitarbeiter', 'ITSZadmins', 'Mitarbeiter', 'Studenten', 'GastDozenten', 'Dozenten'];
      
      targetGroups.forEach(targetGroup => {
        const hasGroup = groups.some(group => 
          group.toLowerCase() === targetGroup.toLowerCase()
        );
        console.log(`${targetGroup}: ${hasGroup ? '✓' : '✗'}`);
      });
    }
    
    process.exit(0);
  });
});
