const ldap = require('ldapauth-fork');

const auth = new ldap({
  url: process.env.LDAP_URL,
  bindDN: process.env.LDAP_BIND_DN,
  bindCredentials: process.env.LDAP_BIND_CREDENTIALS,
  searchBase: process.env.LDAP_SEARCH_BASE,
  searchFilter: process.env.LDAP_SEARCH_FILTER
});

module.exports = auth;