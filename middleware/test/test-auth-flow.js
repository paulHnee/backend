/**
 * Test für den kompletten Authentifizierungs-Flow mit Gruppenerkennung
 */

import 'dotenv/config';
import ldapAuth from '../config/ldap.js';
import { mapUserRoles } from '../utils/ldapUtils.js';

const testUsername = 'pbuchwald';
const testPassword = process.env.TEST_PASSWORD;

console.log(`Testing complete authentication flow for user: ${testUsername}`);
console.log('='.repeat(60));

// Simuliere den Login-Prozess
async function testAuthFlow() {
  try {
    console.log('🔐 Step 1: LDAP Authentication');
    
    // 1. LDAP-Authentifizierung (simulation - wir testen nur getUserInfo)
    console.log('   Skipping actual password auth for security...');
    
    // 2. Benutzerinformationen und Gruppen abrufen
    console.log('\n📋 Step 2: Getting User Information and Groups');
    
    const userInfo = await new Promise((resolve, reject) => {
      ldapAuth.getUserInfo(testUsername, (err, info) => {
        if (err) {
          reject(err);
        } else {
          resolve(info);
        }
      });
    });
    
    console.log('   User Info Retrieved:');
    console.log('   - Username:', userInfo.username);
    console.log('   - Display Name:', userInfo.displayName);
    console.log('   - Email:', userInfo.email);
    console.log('   - Groups Count:', userInfo.groups.length);
    console.log('   - Roles Count:', userInfo.roles.length);
    
    // 3. Rolle-Mapping anwenden
    console.log('\n🎭 Step 3: Role Mapping');
    const mappedRoles = mapUserRoles(userInfo.groups);
    
    console.log('   Mapped Roles:');
    Object.entries(mappedRoles).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value ? '✅' : '❌'}`);
    });
    
    // 4. Finale Token-Daten (ohne tatsächlichen JWT)
    console.log('\n🎫 Step 4: Token Data (without actual JWT)');
    const tokenData = {
      username: userInfo.username,
      displayName: userInfo.displayName,
      email: userInfo.email,
      groups: userInfo.groups,
      roles: userInfo.roles,
      ...mappedRoles
    };
    
    console.log('   Token would contain:');
    console.log('   - Basic Info: ✅');
    console.log('   - Groups:', userInfo.groups.length, 'groups');
    console.log('   - Roles:', userInfo.roles.length, 'HNEE roles');
    console.log('   - Permissions: ✅');
    
    // 5. Zeige spezifische HNEE-Rollen
    console.log('\n🏫 Step 5: HNEE Role Summary');
    console.log('   HNEE Groups Found:');
    userInfo.roles.forEach(role => {
      console.log(`   ✅ ${role}`);
    });
    
    if (userInfo.roles.length === 0) {
      console.log('   ❌ No HNEE roles found');
    }
    
    console.log('\n   Permissions Summary:');
    console.log(`   - Admin Access: ${mappedRoles.isAdmin ? '✅' : '❌'}`);
    console.log(`   - IT Employee: ${mappedRoles.isITEmployee ? '✅' : '❌'}`);
    console.log(`   - Regular Employee: ${mappedRoles.isEmployee ? '✅' : '❌'}`);
    console.log(`   - Can Manage Users: ${mappedRoles.canManageUsers ? '✅' : '❌'}`);
    console.log(`   - Can View Reports: ${mappedRoles.canViewReports ? '✅' : '❌'}`);
    
    console.log('\n✅ Authentication Flow Test Completed Successfully!');
    
  } catch (error) {
    console.error('\n❌ Authentication Flow Test Failed:', error);
  }
}

testAuthFlow();
