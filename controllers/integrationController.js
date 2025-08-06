/**
 * IntegrationController - Einfaches HNEE Service Portal
 * 
 * ===== EINFACHE LINKS UND SERVICES =====
 * 
 * Vereinfachter Controller nur für:
 * - Direkte Links zu HNEE-Services
 * - VPN-Konfiguration
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

    console.log(`🚀 Quick-Services für ${user}`);

    const quickServices = {
      essential: [
        {
          id: 'email',
          name: 'HNEE Email',
          description: 'Webmail-Zugang',
          url: 'https://mail.hnee.de',
          icon: 'mail',
          category: 'communication'
        },
        {
          id: 'moodle',
          name: 'Moodle E-Learning',
          description: 'Online-Kurse und Lernmaterialien',
          url: 'https://moodle.hnee.de',
          icon: 'book-open',
          category: 'learning'
        },
        {
          id: 'portal',
          name: 'Studierendenportal',
          description: 'Bescheinigungen und Verwaltung',
          url: 'https://portal.hnee.de',
          icon: 'user',
          category: 'admin'
        }
      ],
      tools: [
        {
          id: 'vpn',
          name: 'VPN-Konfiguration',
          description: 'VPN-Profile herunterladen',
          url: '/api/integration/vpn-config',
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

/**
 * VPN-Konfiguration generieren
 */
export const generateVpnConfig = async (req, res) => {
  try {
    const user = req.user?.username || 'unknown';
    const { platform = 'windows' } = req.query;

    console.log(`🔐 VPN-Konfiguration für ${user}, Plattform: ${platform}`);

    // Mock VPN-Konfiguration (in echter Implementierung: echte Zertifikate)
    const vpnConfigs = {
      windows: {
        filename: `hnee-vpn-${user}-windows.ovpn`,
        content: generateOpenVpnConfig(user, 'windows'),
        instructions: [
          'OpenVPN Client herunterladen: https://openvpn.net/downloads/',
          'Konfigurationsdatei in OpenVPN-Verzeichnis kopieren',
          'OpenVPN GUI starten und Profil auswählen',
          'Mit HNEE-Anmeldedaten verbinden'
        ]
      },
      macos: {
        filename: `hnee-vpn-${user}-macos.ovpn`,
        content: generateOpenVpnConfig(user, 'macos'),
        instructions: [
          'Tunnelblick herunterladen: https://tunnelblick.net/',
          'Konfigurationsdatei doppelklicken',
          'Installation bestätigen',
          'Mit HNEE-Anmeldedaten verbinden'
        ]
      },
      ios: {
        filename: `hnee-vpn-${user}-ios.mobileconfig`,
        content: generateIosProfile(user),
        instructions: [
          'Profil per E-Mail oder AirDrop übertragen',
          'In Einstellungen > VPN installieren',
          'Installation bestätigen',
          'VPN in Einstellungen aktivieren'
        ]
      },
      android: {
        filename: `hnee-vpn-${user}-android.ovpn`,
        content: generateOpenVpnConfig(user, 'android'),
        instructions: [
          'OpenVPN Connect App installieren',
          'Profil importieren (QR-Code oder Datei)',
          'Mit HNEE-Anmeldedaten verbinden'
        ]
      }
    };

    const config = vpnConfigs[platform];
    if (!config) {
      return res.status(400).json({
        error: 'Unbekannte Plattform',
        supportedPlatforms: Object.keys(vpnConfigs)
      });
    }

    logSecurityEvent(user, 'GENERATE_VPN_CONFIG', 
      `VPN-Konfiguration generiert für Plattform: ${platform}`);

    res.json({
      success: true,
      platform: platform,
      config: {
        filename: config.filename,
        instructions: config.instructions,
        downloadUrl: `/api/integration/vpn-download/${user}/${platform}`,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
      },
      security: {
        note: 'Konfiguration ist persönlich und nicht übertragbar',
        expires: '24 Stunden nach Generierung',
        usage: 'Nur für autorisierte HNEE-Mitglieder'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fehler bei VPN-Konfiguration:', error);
    res.status(500).json({ 
      error: 'Fehler beim Generieren der VPN-Konfiguration',
      details: error.message
    });
  }
};

// ===== HELPER FUNCTIONS =====

function isItszTeam(username) {
  const itszMembers = ['itsz.admin', 'paul.buchwald', 'admin'];
  return itszMembers.includes(username);
}

function generateOpenVpnConfig(username, platform) {
  // Mock OpenVPN-Konfiguration
  return `# HNEE VPN Configuration for ${username}
# Platform: ${platform}
# Generated: ${new Date().toISOString()}

client
dev tun
proto udp
remote vpn.hnee.de 1194
resolv-retry infinite
nobind
persist-key
persist-tun
auth-user-pass
remote-cert-tls server
cipher AES-256-CBC
auth SHA256
verb 3

# Certificates would be embedded here in real implementation
<ca>
-----BEGIN CERTIFICATE-----
[CA Certificate Content]
-----END CERTIFICATE-----
</ca>

<cert>
-----BEGIN CERTIFICATE-----
[Client Certificate Content]
-----END CERTIFICATE-----
</cert>

<key>
-----BEGIN PRIVATE KEY-----
[Private Key Content]
-----END PRIVATE KEY-----
</key>`;
}

function generateIosProfile(username) {
  // Mock iOS-Konfigurationsprofil
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadDisplayName</key>
    <string>HNEE VPN (${username})</string>
    <key>PayloadIdentifier</key>
    <string>de.hnee.vpn.${username}</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${generateUUID()}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <!-- VPN Configuration would be here -->
</dict>
</plist>`;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
