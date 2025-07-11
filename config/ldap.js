import ldap from 'ldapauth-fork';

/**
 * LDAP-Authentifizierungskonfiguration mit verbessertem Error Handling
 */
const ldapConfig = {
  url: process.env.LDAP_URL,
  bindDN: process.env.LDAP_BIND_DN,
  bindCredentials: process.env.LDAP_BIND_CREDENTIALS,
  searchBase: process.env.LDAP_SEARCH_BASE,
  searchFilter: process.env.LDAP_SEARCH_FILTER,
  reconnect: {
    initialDelay: 1000,
    maxDelay: 10000,
    failAfter: 10
  },
  timeout: 30000,
  connectTimeout: 10000,
  idleTimeout: 300000,
  tlsOptions: {
    rejectUnauthorized: true 
  },
  logging: {
    name: 'ldap-auth',
    level: 'debug'
  }
};

let auth = null;

function createLdapClient() {
  if (auth) {
    try {
      auth._adminClient && auth._adminClient.destroy();
      auth.close();
    } catch (e) {
      console.error('Error closing existing LDAP connection:', e);
    }
  }

  auth = new ldap(ldapConfig);

  auth.on('error', (err) => {
    console.error('LDAP connection error:', err);
    setTimeout(createLdapClient, 5000); // Attempt reconnection after 5 seconds
  });

  auth.on('connect', () => {
    console.log('Successfully connected to LDAP server');
  });

  return auth;
}

// Create initial LDAP client
auth = createLdapClient();

// Export the client as default export
const ldapAuth = {
  authenticate: (username, password, callback) => {
    if (!auth._adminClient) {
      auth = createLdapClient();
    }
    auth.authenticate(username, password, callback);
  }
};
export default ldapAuth;