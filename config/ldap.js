const ldap = require('ldapauth-fork');

/**
 * LDAP-Authentifizierungskonfiguration
 * Erstellt eine neue LDAP-Authentifizierungsinstanz mit Umgebungsvariablen
 * 
 * @param {Object} config - LDAP-Konfigurationsobjekt
 * @property {string} url - LDAP-Server URL (z.B. ldap://localhost:389)
 * @property {string} bindDN - Distinguished Name für die initiale Verbindung
 * @property {string} bindCredentials - Passwort für die initiale Verbindung
 * @property {string} searchBase - Basis-DN für die Benutzersuche
 * @property {string} searchFilter - LDAP-Filter für die Benutzersuche (z.B. (uid={{username}}))
 */
const auth = new ldap({
  url: process.env.LDAP_URL,
  bindDN: process.env.LDAP_BIND_DN,
  bindCredentials: process.env.LDAP_BIND_CREDENTIALS,
  searchBase: process.env.LDAP_SEARCH_BASE,
  searchFilter: process.env.LDAP_SEARCH_FILTER
});

module.exports = auth;