/**
 * UserController - Benutzer-Profile für HNEE Service Portal
 * 
 * ===== BENUTZER-ORIENTIERTE FUNKTIONEN =====
 * 
 * Dieser Controller implementiert grundlegende Profil-Funktionen
 * ohne komplexe Self-Service-Features. Fokus auf Profil-Management.
 * 
 * ===== KERN-FUNKTIONALITÄTEN =====
 * 
 * 1. PROFIL-MANAGEMENT:
 *    - Eigene Profil-Informationen anzeigen
 *    - Kontaktdaten-Aktualisierung  
 *    - Benachrichtigungs-Einstellungen
 * 
 * 2. QUICK-ACTIONS:
 *    - Häufig verwendete HNEE-Links
 *    - Direkte ITSZ-Kontakte
 *    - Zammad-Ticket-System Integration
 * 
 * HINWEIS: 
 * - Passwort-Reset erfolgt über ITSZ-Team
 * - Support über Zammad-System
 * - Keine Software-/Ressourcen-Anfragen
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 1.0.0 (Profile Focus)
 * @since 2025-08-06
 */

import { logSecurityEvent } from '../utils/securityLogger.js';
import ldapAuth from '../config/ldap.js';

/**
 * Benutzer-Profil abrufen (ECHTE LDAP-DATEN)
 */
export const getUserProfile = async (req, res) => {
  try {
    const user = req.user?.username || 'unknown';
    
    console.log(`👤 LDAP-Profil-Abruf für Benutzer: ${user}`);

    // Echte LDAP-Daten abrufen
    ldapAuth.getUserInfo(user, (err, ldapUserInfo) => {
      if (err) {
        console.error('LDAP Fehler:', err);
        // Fallback bei LDAP-Fehlern
        return res.status(500).json({
          error: 'Fehler beim Laden der LDAP-Profildaten',
          details: err.message
        });
      }

      // LDAP-Daten in Profil-Format umwandeln
      const profile = {
        username: user,
        displayName: ldapUserInfo.displayName || ldapUserInfo.cn || user,
        email: ldapUserInfo.email || ldapUserInfo.mail || `${user}@hnee.de`,
        organisation: ldapUserInfo.organisation || ldapUserInfo.department || ldapUserInfo.ou || 'Unbekannt',
        role: mapLdapGroupsToRole(ldapUserInfo.groups || []),
        groups: ldapUserInfo.groups || [],
        lastLogin: new Date().toISOString(),
        preferences: {
          language: 'de',
          notifications: true,
          theme: 'auto'
        },
        ldapSource: true // Kennzeichnung für echte LDAP-Daten
      };

      logSecurityEvent(user, 'LDAP_PROFILE_ACCESS', 
        `LDAP-Profil abgerufen: ${profile.displayName}`);

      res.json({
        success: true,
        profile,
        timestamp: new Date().toISOString()
      });
    });

  } catch (error) {
    console.error('Fehler beim LDAP-Profil-Abruf:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden des LDAP-Profils',
      details: error.message
    });
  }
};

/**
 * Quick-Actions für häufige Aufgaben
 */
export const getQuickActions = async (req, res) => {
  try {
    const user = req.user?.username || 'unknown';

    const quickActions = [
      {
        id: 'zammad_ticket',
        title: 'Support-Ticket (Zammad)',
        description: 'Problem an ITSZ-Team über Zammad melden',
        icon: 'help-circle',
        action: 'https://Zammad.hnee.de',
        category: 'support',
        external: true
      },
      {
        id: 'email_webmail',
        title: 'HNEE Email',
        description: 'Webmail-Zugang',
        icon: 'mail',
        action: 'https://webmail.hnee.de',
        category: 'communication',
        external: true
      },
      {
        id: 'knowledge_base',
        title: 'Knowledge Base',
        description: 'FAQ und Anleitungen (Zammad)',
        icon: 'book',
        action: 'https://zammad.hnee.de/help',
        category: 'support',
        external: true
      }
    ];

    res.json({
      success: true,
      quickActions: quickActions,
      categories: ['support', 'communication'],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler bei Quick-Actions:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der Quick-Actions',
      details: error.message
    });
  }
};

// ===== HELPER FUNCTIONS =====

/**
 * Mappt LDAP-Gruppen zu HNEE-Rollen
 */
function mapLdapGroupsToRole(groups) {
  if (!groups || !Array.isArray(groups)) return 'Unbekannt';
  
  // ITSZ-Administratoren (höchste Priorität)
  if (groups.some(group => group.toLowerCase().includes('itszadmins') || 
                           group.toLowerCase().includes('it-admin'))) {
    return 'ITSZ-Administrator';
  }
  
  // IT-Mitarbeiter
  if (groups.some(group => group.toLowerCase().includes('it-mitarbeiter') || 
                           group.toLowerCase().includes('itsz'))) {
    return 'IT-Mitarbeiter';
  }
  
  // Dozenten/Professoren
  if (groups.some(group => group.toLowerCase().includes('dozenten') || 
                           group.toLowerCase().includes('professoren') ||
                           group.toLowerCase().includes('lehrpersonal'))) {
    return 'Dozent/Professor';
  }
  
  // Mitarbeiter (allgemein)
  if (groups.some(group => group.toLowerCase().includes('mitarbeiter') || 
                           group.toLowerCase().includes('staff'))) {
    return 'Mitarbeiter';
  }
  
  // Studenten
  if (groups.some(group => group.toLowerCase().includes('studenten') || 
                           group.toLowerCase().includes('students'))) {
    return 'Student';
  }
  
  // Gäste
  if (groups.some(group => group.toLowerCase().includes('gast') || 
                           group.toLowerCase().includes('guest'))) {
    return 'Gast';
  }
  
  // Standard-Fallback
  return 'HNEE-Mitglied';
}
