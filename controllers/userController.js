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

/**
 * Benutzer-Profil abrufen
 */
export const getUserProfile = async (req, res) => {
  try {
    const user = req.user?.username || 'unknown';
    
    console.log(`👤 Profil-Abruf für Benutzer: ${user}`);

    // Mock-Profildaten (in echter Implementierung aus LDAP/DB)
    const profile = {
      username: user,
      displayName: `${user.charAt(0).toUpperCase()}${user.slice(1)}`,
      email: `${user}@hnee.de`,
      department: 'Forstwirtschaft', // Beispiel
      role: 'Student', // oder 'Mitarbeiter', 'Professor'
      lastLogin: new Date().toISOString(),
      recentServices: [
        { name: 'Email', status: 'active', lastUsed: '2025-08-06' },
        { name: 'VPN', status: 'connected', lastUsed: '2025-08-05' }
      ],
      preferences: {
        language: 'de',
        notifications: true,
        theme: 'auto'
      }
    };

    res.json({
      success: true,
      profile,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler beim Profil-Abruf:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden des Profils',
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
        action: 'https://helpdesk.hnee.de',
        category: 'support',
        external: true
      },
      {
        id: 'itsz_contact',
        title: 'ITSZ kontaktieren',
        description: 'Direkter Kontakt zum IT-Service-Zentrum',
        icon: 'phone',
        action: '/api/user/contact-info',
        category: 'support'
      },
      {
        id: 'email_webmail',
        title: 'HNEE Email',
        description: 'Webmail-Zugang',
        icon: 'mail',
        action: 'https://mail.hnee.de',
        category: 'communication',
        external: true
      },
      {
        id: 'knowledge_base',
        title: 'Knowledge Base',
        description: 'FAQ und Anleitungen (Zammad)',
        icon: 'book',
        action: 'https://helpdesk.hnee.de/help',
        category: 'support',
        external: true
      }
    ];

    res.json({
      success: true,
      quickActions: quickActions,
      categories: ['support', 'learning', 'communication'],
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

/**
 * ITSZ Kontakt-Informationen
 */
export const getContactInfo = async (req, res) => {
  try {
    const contactInfo = {
      itsz: {
        name: 'IT-Service-Zentrum (ITSZ)',
        email: 'itsz@hnee.de',
        phone: '+49 3334 657-123',
        emergency: '+49 3334 657-999',
        office: {
          building: 'Hauptgebäude',
          room: '1.2.34',
          floor: '1. Obergeschoss'
        },
        hours: {
          monday: '08:00 - 16:00',
          tuesday: '08:00 - 16:00',
          wednesday: '08:00 - 16:00',
          thursday: '08:00 - 16:00',
          friday: '08:00 - 15:00',
          weekend: 'Nur Notfälle'
        }
      },
      zammad: {
        ticketSystem: 'https://helpdesk.hnee.de',
        knowledgeBase: 'https://helpdesk.hnee.de/help',
        description: 'Zammad-System für Support-Tickets und Knowledge Base'
      },
      team: [
        {
          name: 'Paul Buchwald',
          role: 'Leiter ITSZ',
          email: 'paul.buchwald@hnee.de',
          phone: '+49 3334 657-124',
          specialties: ['Netzwerk', 'Sicherheit']
        },
        {
          name: 'Max Mustermann',
          role: 'System-Administrator',
          email: 'max.mustermann@hnee.de',
          phone: '+49 3334 657-125',
          specialties: ['Server', 'Email', 'Backup']
        }
      ],
      emergencyInfo: {
        afterHours: 'Bei kritischen Systemausfällen: +49 3334 657-999',
        escalation: 'Rufbereitschaft außerhalb der Geschäftszeiten',
        priority: 'Nur für schwerwiegende Störungen'
      }
    };

    res.json({
      success: true,
      contactInfo: contactInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler bei Kontakt-Info:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der Kontakt-Informationen',
      details: error.message
    });
  }
};
