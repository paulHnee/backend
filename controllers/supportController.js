/**
 * SupportController - Zammad-Integration für HNEE Service Portal
 * 
 * ===== ZAMMAD-INTEGRATION =====
 * 
 * Dieser Controller bietet Integration mit dem bestehenden Zammad-System
 * für Support und Knowledge Base.
 * 
 * ===== KERN-FUNKTIONALITÄTEN =====
 * 
 * 1. ZAMMAD-LINKS:
 *    - Direkte Links zu Zammad-Ticket-System
 *    - Knowledge Base Integration
 *    - ITSZ-Kontakt-Informationen
 * 
 * 2. BASIC DIAGNOSTICS:
 *    - Einfache Diagnose-Tools
 *    - Connectivity-Checker
 *    - Konfiguration-Helpers
 * 
 * HINWEIS: 
 * - Support erfolgt primär über Zammad
 * - Kein integriertes Live-Chat
 * - Keine Video-Tutorials im Portal
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 1.0.0 (Zammad Integration)
 * @since 2025-08-06
 */

import { logSecurityEvent } from '../utils/securityLogger.js';

/**
 * Zammad-System Information
 */
export const getZammadInfo = async (req, res) => {
  try {
    console.log(`📚 Zammad-Info Zugriff`);

    const zammadInfo = {
      ticketSystem: {
        url: 'https://zammad.hnee.de',
        description: 'Zammad-Ticket-System für Support-Anfragen',
        features: [
          'Support-Tickets erstellen und verfolgen',
          'E-Mail-Benachrichtigungen',
          'Ticket-Status einsehen',
          'Direkter Kontakt zum ITSZ-Team'
        ]
      },
      knowledgeBase: {
        url: 'https://zammad.hnee.de/help',
        description: 'Knowledge Base mit FAQ und Anleitungen',
        categories: [
          'VPN & Netzwerk',
          'Email & Outlook', 
          'WLAN & Internet',
          'Account & Passwort',
          'Drucken & Scannen'
        ]
      },
      howToUse: [
        'Besuchen Sie https://zammad.hnee.de',
        'Erstellen Sie ein Ticket für Support-Anfragen',
        'Durchsuchen Sie die Knowledge Base für Antworten',
        'Bei dringenden Problemen: Telefon +49 3334 657-123'
      ]
    };

    res.json({
      success: true,
      zammadInfo: zammadInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler bei Zammad-Info:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der Zammad-Informationen',
      details: error.message
    });
  }
};

/**
 * Self-Help Diagnose-Tools
 */
export const getDiagnosticTools = async (req, res) => {
  try {
    const tools = [
      {
        id: 'connectivity_check',
        name: 'Verbindungs-Test',
        description: 'Prüft Ihre Internetverbindung und HNEE-Services',
        category: 'network',
        estimatedTime: '30 Sekunden',
        steps: [
          'DNS-Auflösung testen',
          'HNEE-Server Erreichbarkeit',
          'Latenz messen'
        ]
      },
      {
        id: 'email_diagnostic',
        name: 'Email-Diagnose',
        description: 'Überprüft Email-Konfiguration und Verbindung',
        category: 'email',
        estimatedTime: '1 Minute',
        steps: [
          'SMTP/IMAP Server prüfen',
          'Port-Verfügbarkeit',
          'Konfiguration validieren'
        ]
      },
      {
        id: 'printer_finder',
        name: 'Drucker-Finder',
        description: 'Findet verfügbare Drucker in Ihrer Nähe',
        category: 'printing',
        estimatedTime: '45 Sekunden',
        steps: [
          'Verfügbare Drucker suchen',
          'Status prüfen',
          'Installationsanleitung'
        ]
      }
    ];

    res.json({
      success: true,
      tools: tools,
      categories: ['network', 'email', 'printing'],
      note: 'Für komplexere Probleme nutzen Sie bitte das Zammad-System',
      zammadUrl: 'https://zammad.hnee.de',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler bei Diagnose-Tools:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der Diagnose-Tools',
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
        description: 'Hauptanlaufstelle für alle Support-Anfragen'
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
        },
        {
          name: 'Anna Schmidt',
          role: 'User-Support',
          email: 'anna.schmidt@hnee.de',
          phone: '+49 3334 657-126',
          specialties: ['Endgeräte', 'Software', 'Schulungen']
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
