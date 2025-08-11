/**
 * IntegrationController - Einfaches HNEE Service Portal
 * 
 * ===== EINFACHE LINKS UND SERVICES =====
 * 
 * Vereinfachter Controller nur für:
 * - Direkte Links zu HNEE-Services
 * - ITSZ-Kontakt
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 1.0.0 (Vereinfacht)
 * @since 2025-08-06
 */

import { logSecurityEvent } from '../utils/securityLogger.js';

/**
 * HNEE Quick-Services und externe Links
 */
export const getQuickServices = async (req, res) => {
  try {
    const user = req.user?.username || 'unknown';



    const quickServices = {
      essential: [
        {
          id: 'email',
          name: 'HNEE Email',
          description: 'Webmail-Zugang',
          url: 'https://webmail.hnee.de',
          icon: 'mail',
          category: 'communication'
        },
        {
          id: 'moodle',
          name: 'Moodle E-Learning',
          description: 'Online-Kurse und Lernmaterialien',
          url: 'https://lms.hnee.de',
          icon: 'book-open',
          category: 'learning'
        },
      ],
      tools: [
        {
          id: 'vpn',
          name: 'VPN-Konfiguration',
          description: 'VPN-Profile herunterladen',
          url: '/api/vpn/config',
          icon: 'shield',
          category: 'network'
        },
        {
          id: 'support',
          name: 'Support (Zammad)',
          description: 'Tickets und Hilfe',
          url: 'https://zammad.hnee.de',
          icon: 'help-circle',
          category: 'support'
        }
      ]
    };

    res.json({
      success: true,
      quickServices: quickServices,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler bei Quick-Services:', error);
    res.status(500).json({ 
      error: 'Fehler beim Laden der Quick-Services',
      details: error.message
    });
  }
};
