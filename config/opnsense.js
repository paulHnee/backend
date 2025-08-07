/**
 * OPNsense API-Konfiguration und -Client für HNEE Service Portal
 * 
 * Diese Konfiguration stellt eine zentrale OPNsense API-Verbindung bereit,
 * die von verschiedenen Controllern verwendet werden kann.
 * 
 * Features:
 * - WireGuard-Client-Management
 * - Service-Kontrolle (Start/Stop/Restart)
 * - Konfiguration neu laden
 * - Status-Abfragen
 * 
 * @author Paul Buchwald - ITSZ Team
 * @version 1.0.0
 * @since 2025-08-07
 */

import https from 'https';

/**
 * OPNsense API-Client für WireGuard-Management
 */
class OPNsenseAPI {
  constructor() {
    this.host = process.env.OPNSENSE_HOST || 'vpn.hnee.de';
    this.fallbackHost = process.env.OPNSENSE_IP || '10.1.1.48'; // Fallback IP
    this.apiKey = process.env.OPNSENSE_API_KEY;
    this.apiSecret = process.env.OPNSENSE_API_SECRET;
    this.baseUrl = `https://${this.host}/api/wireguard`;
    this.currentHost = this.host; // Aktuell verwendeter Host
    
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('OPNsense API-Anmeldedaten nicht konfiguriert (OPNSENSE_API_KEY/OPNSENSE_API_SECRET fehlen)');
    }
  }

  /**
   * HTTP-Request an OPNsense API senden (mit Fallback auf IP)
   */
  async request(endpoint, method = 'GET', data = null) {
    // Versuche erst mit Hostname, dann mit IP als Fallback
    return this.makeRequest(this.currentHost, endpoint, method, data)
      .catch(async (error) => {
        if (this.currentHost !== this.fallbackHost) {
          console.warn(`🔄 Hostname ${this.currentHost} fehlgeschlagen, versuche IP ${this.fallbackHost}...`);
          this.currentHost = this.fallbackHost;
          return this.makeRequest(this.fallbackHost, endpoint, method, data);
        }
        throw error;
      });
  }

  /**
   * Eigentliche HTTP-Request-Implementierung
   */
  async makeRequest(hostname, endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
      
      const options = {
        hostname: hostname,
        port: 443,
        path: `/api/wireguard${endpoint}`,
        method: method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        rejectUnauthorized: false // Für Self-Signed Certificates
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`✅ OPNsense API Request erfolgreich: ${hostname}${endpoint}`);
              resolve(parsedData);
            } else {
              reject(new Error(`OPNsense API Error: ${res.statusCode} - ${responseData}`));
            }
          } catch (error) {
            reject(new Error(`JSON Parse Error: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request Error zu ${hostname}: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout zu ${hostname}`));
      });

      req.setTimeout(5000); // 5 Sekunden Timeout für echten Server

      if (data && (method === 'POST' || method === 'PUT')) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * Alle WireGuard-Clients abrufen
   */
  async getClients() {
    try {
      const response = await this.request('/client/searchClient');
      return response.rows || [];
    } catch (error) {
      console.error('Fehler beim Abrufen der WireGuard-Clients:', error);
      throw error;
    }
  }

  /**
   * WireGuard-Client erstellen
   */
  async createClient(clientData) {
    try {
      const response = await this.request('/client/addClient', 'POST', clientData);
      return response;
    } catch (error) {
      console.error('Fehler beim Erstellen des WireGuard-Clients:', error);
      throw error;
    }
  }

  /**
   * WireGuard-Client löschen
   */
  async deleteClient(clientId) {
    try {
      const response = await this.request(`/client/delClient/${clientId}`, 'POST');
      return response;
    } catch (error) {
      console.error('Fehler beim Löschen des WireGuard-Clients:', error);
      throw error;
    }
  }

  /**
   * WireGuard-Konfiguration neu laden
   */
  async reconfigure() {
    try {
      const response = await this.request('/service/reconfigure', 'POST');
      return response;
    } catch (error) {
      console.error('Fehler beim Neuladen der WireGuard-Konfiguration:', error);
      throw error;
    }
  }

  /**
   * WireGuard-Status abrufen
   */
  async getStatus() {
    try {
      const response = await this.request('/service/status');
      return response;
    } catch (error) {
      console.error('Fehler beim Abrufen des WireGuard-Status:', error);
      throw error;
    }
  }

  /**
   * Server-Informationen abrufen
   */
  async getServerInfo() {
    try {
      const response = await this.request('/server/searchServer');
      return response.rows || [];
    } catch (error) {
      console.error('Fehler beim Abrufen der Server-Informationen:', error);
      throw error;
    }
  }

  /**
   * Prüfen ob OPNsense API erreichbar ist
   */
  async isAvailable() {
    try {
      await this.getStatus();
      return true;
    } catch (error) {
      console.warn('OPNsense API nicht erreichbar:', error.message);
      return false;
    }
  }
}

// Singleton-Instanz für wiederverwendung
let opnsenseInstance = null;

/**
 * OPNsense API-Instanz abrufen (Singleton)
 */
export const getOPNsenseAPI = () => {
  if (!opnsenseInstance) {
    opnsenseInstance = new OPNsenseAPI();
  }
  return opnsenseInstance;
};

/**
 * OPNsense-Konfiguration prüfen
 */
export const checkOPNsenseConfig = () => {
  const host = process.env.OPNSENSE_HOST;
  const apiKey = process.env.OPNSENSE_API_KEY;
  const apiSecret = process.env.OPNSENSE_API_SECRET;
  
  return {
    configured: Boolean(host && apiKey && apiSecret),
    host: host || 'nicht konfiguriert',
    hasCredentials: Boolean(apiKey && apiSecret)
  };
};

export default OPNsenseAPI;
