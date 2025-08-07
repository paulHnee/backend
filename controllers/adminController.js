/**
 * System-Konfiguration Controller - Vereinfacht für HNEE Service Portal
 * 
 * Dieser Controller stellt nur noch die grundlegende System-Konfiguration bereit.
 * Alle Admin-Funktionen wurden entfernt für ein einfaches Service Portal.
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 4.0.0 (Vereinfacht - Keine Admin-Operationen)
 * @since 2025-08-07
 */

import { checkOPNsenseConfig } from '../config/opnsense.js';

/**
 * System-Konfiguration abrufen (Nur Lesen)
 */
export const getSystemConfig = async (req, res) => {
  try {
    const config = {
      ldap: {
        configured: Boolean(process.env.LDAP_URL),
        url: process.env.LDAP_URL ? process.env.LDAP_URL.replace(/\/\/.*@/, '//***@') : null,
        baseDN: process.env.LDAP_BASE_DN || null
      },
      opnsense: checkOPNsenseConfig(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };

    res.json(config);

  } catch (error) {
    console.error('Fehler beim Abrufen der System-Konfiguration:', error);
    res.status(500).json({ 
      error: 'Fehler beim Abrufen der System-Konfiguration' 
    });
  }
};


