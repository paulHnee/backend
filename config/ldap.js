import ldap from 'ldapauth-fork';
import ldapjs from 'ldapjs';

/**
 * LDAP-Authentifizierungskonfiguration mit verbessertem Error Handling
 */
const getLdapConfig = () => {
  // Debug: Logge Umgebungsvariablen
  console.log('LDAP Environment Variables:');
  console.log('LDAP_URL:', process.env.LDAP_URL);
  console.log('LDAP_BIND_DN:', process.env.LDAP_BIND_DN);
  console.log('LDAP_SEARCH_BASE:', process.env.LDAP_SEARCH_BASE);
  console.log('LDAP_SEARCH_FILTER:', process.env.LDAP_SEARCH_FILTER);

  if (!process.env.LDAP_URL) {
    throw new Error('LDAP_URL environment variable is not defined');
  }

  return {
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

  try {
    const ldapConfig = getLdapConfig();
    auth = new ldap(ldapConfig);

    auth.on('error', (err) => {
      console.error('LDAP connection error:', err);
      setTimeout(createLdapClient, 5000); // Attempt reconnection after 5 seconds
    });

    auth.on('connect', () => {
      console.log('Successfully connected to LDAP server');
    });

    return auth;
  } catch (error) {
    console.error('Failed to create LDAP client:', error);
    return null;
  }
}

// Verzögerte Initialisierung - wird erst beim ersten Aufruf erstellt
// auth = createLdapClient();

// Export the client as default export
const ldapAuth = {
  authenticate: (username, password, callback) => {
    // Lazy initialization - erstelle Client bei Bedarf
    if (!auth) {
      auth = createLdapClient();
    }
    
    if (!auth) {
      return callback(new Error('LDAP client could not be initialized'), null);
    }

    if (!auth._adminClient) {
      auth = createLdapClient();
    }
    auth.authenticate(username, password, callback);
  },

  /**
   * Holt Benutzerinformationen und Gruppenmitgliedschaften aus LDAP
   * @param {string} username - Der Benutzername
   * @param {function} callback - Callback-Funktion (err, userInfo)
   */
  getUserInfo: (username, callback) => {
    // Versuche zuerst eine einfache LDAP-Abfrage
    try {
      // Überprüfe Umgebungsvariablen
      if (!process.env.LDAP_URL) {
        console.error('LDAP_URL not defined in environment variables');
        return callback(null, {
          username,
          displayName: username,
          email: `${username}@hnee.de`,
          groups: [],
          roles: []
        });
      }

      const client = ldapjs.createClient({
        url: process.env.LDAP_URL,
        timeout: 10000,
        connectTimeout: 5000
      });

      // Error handler für den Client
      client.on('error', (err) => {
        console.error('LDAP Client Error:', err);
        client.destroy();
        // Fallback bei Client-Fehlern
        return callback(null, {
          username,
          displayName: username,
          email: `${username}@hnee.de`,
          groups: [],
          roles: []
        });
      });

      // Zuerst mit Service-Account verbinden
      client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_CREDENTIALS, (err) => {
        if (err) {
          console.error('LDAP bind failed:', err);
          client.destroy();
          // Fallback bei Bind-Fehlern
          return callback(null, {
            username,
            displayName: username,
            email: `${username}@hnee.de`,
            groups: [],
            roles: []
          });
        }

        // Suche nach dem Benutzer
        const searchFilter = process.env.LDAP_SEARCH_FILTER.replace('{{username}}', username);
        const searchOptions = {
          scope: 'sub',
          filter: searchFilter,
          attributes: [
            'cn', 'mail', 'memberOf', 'distinguishedName', 'displayName', 'sAMAccountName',
            // Erweiterte Attribute für verschiedene LDAP-Server
            'groups', 'groupMembership', 'primaryGroupID', 'objectClass'
          ],
          timeLimit: 5
        };

        client.search(process.env.LDAP_SEARCH_BASE, searchOptions, (err, searchRes) => {
          if (err) {
            console.error('LDAP search failed:', err);
            client.destroy();
            // Fallback bei Search-Fehlern
            return callback(null, {
              username,
              displayName: username,
              email: `${username}@hnee.de`,
              groups: [],
              roles: []
            });
          }

          let userInfo = null;
          let searchTimeout = setTimeout(() => {
            client.destroy();
            console.error('LDAP search timeout');
            callback(null, {
              username,
              displayName: username,
              email: `${username}@hnee.de`,
              groups: [],
              roles: []
            });
          }, 8000);

          searchRes.on('searchEntry', (entry) => {
            clearTimeout(searchTimeout);
            
            try {
              // Use entry.pojo for ldapjs to get all attributes as object
              const attributes = entry.pojo ? entry.pojo.attributes : (entry.object || entry.raw);
              
              // Check if attributes exist
              if (!attributes) {
                console.error(`No attributes found for ${username}`);
                callback(null, {
                  username: username,
                  displayName: username,
                  email: `${username}@hnee.de`,
                  groups: [],
                  roles: []
                });
                return;
              }
              
              // Convert attributes array to object if needed
              let attrObj = {};
              if (Array.isArray(attributes)) {
                attributes.forEach(attr => {
                  attrObj[attr.type] = attr.values.length === 1 ? attr.values[0] : attr.values;
                });
              } else {
                attrObj = attributes;
              }
              
              // Debug: Logge alle verfügbaren Attribute (mit Null-Check)
              console.log(`LDAP Attributes for ${username}:`, Object.keys(attrObj));
              
              // Extrahiere Gruppennamen aus memberOf (safe access)
              let groups = [];
              if (attrObj && attrObj.memberOf) {
                // memberOf kann ein String oder Array sein
                const memberOfArray = Array.isArray(attrObj.memberOf) 
                  ? attrObj.memberOf 
                  : [attrObj.memberOf];
                
                groups = memberOfArray.map(dn => {
                  // Extrahiere CN aus DN (z.B. "CN=Domain Admins,CN=Users,DC=example,DC=com" -> "Domain Admins")
                  const cnMatch = dn.match(/^CN=([^,]+)/i);
                  return cnMatch ? cnMatch[1] : dn;
                });
                
                // Debug: Logge alle gefundenen Gruppen
                console.log(`LDAP Groups found for ${username}:`, groups);
              } else {
                console.log(`No memberOf attribute found for ${username}, trying alternative group search...`);
                
                // Alternative: Suche in anderen Attributen
                if (attrObj.groups) {
                  groups = Array.isArray(attrObj.groups) ? attrObj.groups : [attrObj.groups];
                  console.log(`Found groups in 'groups' attribute:`, groups);
                } else if (attrObj.groupMembership) {
                  groups = Array.isArray(attrObj.groupMembership) ? attrObj.groupMembership : [attrObj.groupMembership];
                  console.log(`Found groups in 'groupMembership' attribute:`, groups);
                }
              }

              userInfo = {
                username: attrObj.sAMAccountName || attrObj.cn || username,
                displayName: attrObj.displayName || attrObj.cn || username,
                email: attrObj.mail || `${username}@hnee.de`,
                distinguishedName: attrObj.distinguishedName || '',
                groups: groups,
                // Filtere nach den spezifischen HNEE-Gruppen
                roles: groups.filter(group => {
                  const groupLower = group.toLowerCase();
                  return groupLower === 'it-mitarbeiter' ||
                         groupLower === 'itszadmins' ||
                         groupLower === 'beschaeftigte' ||
                         groupLower === 'studierende' ||
                         groupLower === 'gastdozenten' ||
                         groupLower === 'lehrende' ||
                         groupLower === 'dozenten' ||
                         groupLower === 'mitarbeiter';

                })
              };
              
              // Debug: Logge gefilterte Rollen
              console.log(`Filtered roles for ${username}:`, userInfo.roles);
            } catch (parseError) {
              console.error('Error parsing LDAP attributes:', parseError);
              userInfo = {
                username,
                displayName: username,
                email: `${username}@hnee.de`,
                groups: [],
                roles: []
              };
            }
          });

          searchRes.on('error', (err) => {
            clearTimeout(searchTimeout);
            console.error('LDAP search error:', err);
            client.destroy();
            callback(null, {
              username,
              displayName: username,
              email: `${username}@hnee.de`,
              groups: [],
              roles: []
            });
          });

          searchRes.on('end', (result) => {
            clearTimeout(searchTimeout);
            client.destroy();
            
            if (userInfo) {
              console.log(`User info retrieved for ${username}:`, {
                username: userInfo.username,
                displayName: userInfo.displayName,
                groupCount: userInfo.groups.length,
                roleCount: userInfo.roles.length
              });
              callback(null, userInfo);
            } else {
              // Fallback wenn kein User gefunden
              console.log(`User ${username} not found in LDAP, using fallback`);
              callback(null, {
                username,
                displayName: username,
                email: `${username}@hnee.de`,
                groups: [],
                roles: []
              });
            }
          });
        });
      });
    } catch (error) {
      console.error('Unexpected error in getUserInfo:', error);
      // Fallback bei unerwarteten Fehlern
      callback(null, {
        username,
        displayName: username,
        email: `${username}@hnee.de`,
        groups: [],
        roles: []
      });
    }
  },

  /**
   * Alternative Methode: Suche nach Gruppenmitgliedschaft durch umgekehrte Suche
   * @param {string} username - Der Benutzername
   * @param {function} callback - Callback-Funktion (err, groups)
   */
  findUserGroupsByReverseSearch: (username, callback) => {
    try {
      // Überprüfe Umgebungsvariablen
      if (!process.env.LDAP_URL) {
        console.error('LDAP_URL not defined in environment variables');
        return callback(null, []);
      }

      const client = ldapjs.createClient({
        url: process.env.LDAP_URL,
        timeout: 10000,
        connectTimeout: 5000
      });

      client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_CREDENTIALS, (err) => {
        if (err) {
          console.error('LDAP bind failed for reverse search:', err);
          client.destroy();
          return callback(null, []);
        }

        // Suche nach Gruppen, die den Benutzer als Mitglied haben
        const searchFilter = `(&(objectClass=group)(member=*${username}*))`;
        const searchOptions = {
          scope: 'sub',
          filter: searchFilter,
          attributes: ['cn'],
          timeLimit: 5
        };

        client.search(process.env.LDAP_SEARCH_BASE, searchOptions, (err, searchRes) => {
          if (err) {
            console.error('LDAP reverse group search failed:', err);
            client.destroy();
            return callback(null, []);
          }

          let groups = [];
          let searchTimeout = setTimeout(() => {
            client.destroy();
            callback(null, groups);
          }, 8000);

          searchRes.on('searchEntry', (entry) => {
            const attributes = entry.object;
            if (attributes.cn) {
              groups.push(attributes.cn);
            }
          });

          searchRes.on('error', (err) => {
            clearTimeout(searchTimeout);
            console.error('LDAP reverse search error:', err);
            client.destroy();
            callback(null, groups);
          });

          searchRes.on('end', () => {
            clearTimeout(searchTimeout);
            client.destroy();
            console.log(`Reverse search found groups for ${username}:`, groups);
            callback(null, groups);
          });
        });
      });
    } catch (error) {
      console.error('Unexpected error in findUserGroupsByReverseSearch:', error);
      callback(null, []);
    }
  }
};
export default ldapAuth;