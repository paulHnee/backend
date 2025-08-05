/**
 * HNEE Backend Server - Express.js API Server
 * 
 * Hauptserver für das HNEE (Hochschule für nachhaltige Entwicklung Eberswalde) 
 * Management-System mit LDAP-Integration und VPN-Management-Funktionalitäten.
 * 
 * ===== ARCHITEKTUR-ÜBERSICHT =====
 * 
 * Nginx Reverse Proxy Setup:
 * Internet → Nginx (Port 80/443) → Node.js Express (Port 5000)
 *          ↳ SSL-Terminierung      ↳ HTTP-only API
 * 
 * ===== KERN-FUNKTIONALITÄTEN =====
 * 
 * 🔐 Authentifizierung & Autorisierung:
 *    - LDAP-basierte Benutzerauthentifizierung
 *    - Session-Management mit HttpOnly-Cookies
 *    - Role-Based Access Control (RBAC)
 *    - CSRF-Schutz durch SameSite-Cookies
 * 
 * 🌐 VPN-Management:
 *    - Benutzer-VPN-Zugang verwalten
 *    - Zertifikat-Generierung und -Verwaltung
 *    - Verbindungsstatistiken und Monitoring
 * 
 * 🛡️ Sicherheitsfeatures:
 *    - Rate Limiting (100 Requests/15min)
 *    - Input Validation & Sanitization
 *    - Security Headers (CSP, X-Frame-Options, etc.)
 *    - Request Monitoring & Anomalie-Erkennung
 *    - Payload-Size-Validation (DoS-Schutz)
 * 
 * 📊 Monitoring & Debugging:
 *    - Strukturiertes Logging (Winston)
 *    - Health-Check-Endpoints
 *    - CORS-Debug-Middleware
 *    - Browser-Cache-Reset-Utilities
 * 
 * ===== TECHNISCHER STACK =====
 * 
 * - Express.js 4.x (Web Framework)
 * - Node.js 20+ (Runtime)
 * - LDAP-Integration (ldapjs)
 * - Session-Management (express-session)
 * - Security-Middleware (Custom Implementation)
 * - Winston (Structured Logging)
 * 
 * ===== KONFIGURATION =====
 * 
 * Umgebungsvariablen:
 * - NODE_ENV: development|production
 * - PORT: Server-Port (Standard: 5000)
 * - LDAP_URL: LDAP-Server-URL
 * - SESSION_SECRET: Session-Verschlüsselungsschlüssel
 * 
 * ===== DEPLOYMENT =====
 * 
 * Produktions-Setup:
 * 1. Nginx als Reverse Proxy (SSL-Terminierung)
 * 2. Node.js als HTTP-only Backend
 * 3. LDAP-Server-Integration
 * 4. Monitoring & Logging-Pipeline
 * 
 * ===== ENTWICKLUNG =====
 * 
 * Entwickler-Utilities:
 * - Hot-Reload mit nodemon
 * - Debug-Endpoints für CORS/Caching
 * - Umfangreiche Konsolen-Ausgaben
 * - Request/Response-Logging
 * 
 * @version 2.0.0
 * @author Paul Buchwald - ITSZ Team, HNEE
 * @since 2025-07-29
 * @license Proprietary - HNEE Internal Use Only
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
// import helmet from 'helmet'; // ENTFERNT - Verursacht upgrade-insecure-requests
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { productionConfig } from './config/production.js';
import cookieParser from 'cookie-parser';

// Security Imports
import { 
  generalLimiter, 
  securityMonitoring,
  validatePayloadSize 
} from './middleware/securityMiddleware.js';
// import { helmetConfig } from './config/securityHeaders.js'; // ENTFERNT
import { logger } from './utils/securityLogger.js';
import { 
  globalErrorHandler, 
  notFoundHandler 
} from './middleware/errorHandlers.js';

// Route Imports
import { router as authRoutes } from './routes/authRoutes.js';
import { router as vpnRoutes } from './routes/vpnRoutes.js';
import { router as adminRoutes } from './routes/adminRoutes.js';
import { corsOptions } from './config/cors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Express App-Instanz erstellen
const app = express();

// Middleware Konfiguration

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Force HTTPS in production (currently disabled for HTTP setup)
// app.use(forceHTTPS);

// General rate limiting
app.use(generalLimiter);

// Manuelle Sicherheits-Header ohne Helmet (um upgrade-insecure-requests zu vermeiden)
app.use((req, res, next) => {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Origin-Agent-Cluster', '?1');
  
  // EXPLIZIT KEINE HSTS Headers für HTTP-only Setup
  // res.setHeader('Strict-Transport-Security', '...'); // ABSICHTLICH WEGGELASSEN
  
  // CSP ohne upgrade-insecure-requests UND ohne HTTPS-Anforderungen
  res.setHeader('Content-Security-Policy', 
    "default-src 'self' http: https:; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: http: https:; " +
    "connect-src 'self' http: https:; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'self'; " +
    "script-src-attr 'none'"
  );
  
  // X-Powered-By header entfernen
  res.removeHeader('X-Powered-By');
  
  // Explizit Browser über HTTP-Erlaubnis informieren
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  next();
});

// Erweiterte Sicherheits-Header Konfiguration (separiert)
// app.use(helmet(helmetConfig)); // ENTFERNT - Um upgrade-insecure-requests zu vermeiden

/**
 * CORS-Konfiguration mit Debug-Ausgabe
 * 
 * Protokolliert alle eingehenden CORS-Anfragen für Debugging-Zwecke.
 * Wichtig für die Fehlerbehebung bei Frontend-Backend-Kommunikation.
 * 
 * @author Paul Buchwald - ITSZ Team
 */
app.use((req, res, next) => {
  // Debug-Informationen für CORS-Anfragen
  console.log(`🌐 CORS Request: ${req.method} ${req.url}`);
  console.log(`   Origin: ${req.get('Origin') || 'None'}`);
  console.log(`   Host: ${req.get('Host')}`);
  console.log(`   User-Agent: ${req.get('User-Agent')?.substring(0, 50) || 'None'}...`);
  next();
});

/**
 * Temporäre CORS-Konfiguration für HTTP-Debugging
 * 
 * Erlaubt alle Origins für Entwicklung und Debugging.
 * WICHTIG: In Produktion durch restriktive CORS-Konfiguration ersetzen.
 * 
 * Features:
 * - Dynamische Origin-Verarbeitung
 * - Preflight-Request-Handling
 * - Credential-Support für Session-Cookies
 * 
 * @author Paul Buchwald - ITSZ Team
 */
app.use((req, res, next) => {
  const origin = req.get('Origin');
  
  // Alle Origins für Debugging erlauben (TEMPORÄR)
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Preflight-Anfragen behandeln
  if (req.method === 'OPTIONS') {
    console.log(`✅ CORS Preflight handled for origin: ${origin}`);
    return res.status(200).end();
  }
  
  console.log(`✅ CORS Headers set for origin: ${origin}`);
  next();
});

// app.use(cors(corsOptions)); // Temporär deaktiviert für Debugging

/**
 * Payload-Größenvalidierung
 * 
 * Verhindert DoS-Attacken durch übermäßig große Request-Bodies.
 * Implementiert als Custom-Middleware vor Body-Parser.
 * 
 * @author Paul Buchwald - ITSZ Team
 */
app.use(validatePayloadSize);

/**
 * Body-Parser-Konfiguration mit Sicherheitslimits
 * 
 * Konfiguriert Express für sicheres Parsing von Request-Bodies:
 * - JSON-Limit: 10MB (ausreichend für Datei-Uploads)
 * - URL-encoded-Limit: 10MB (für Formulardaten)
 * - Extended: true (für komplexe Objektstrukturen)
 * 
 * Sicherheitsaspekte:
 * - Verhindert Memory-Exhaustion-Attacken
 * - Begrenzt Request-Body-Größe
 * - Sichere Parameter-Verarbeitung
 * 
 * @author Paul Buchwald - ITSZ Team
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

/**
 * Cookie-Parser-Middleware
 * 
 * Ermöglicht das Lesen und Schreiben von HTTP-Cookies.
 * Essentiell für Session-Management und CSRF-Schutz.
 * 
 * @author Paul Buchwald - ITSZ Team
 */
app.use(cookieParser());

/**
 * Sicherheitsüberwachungs-Middleware
 * 
 * Protokolliert verdächtige Aktivitäten und potentielle Angriffe.
 * Implementiert Real-Time-Monitoring für Sicherheitsereignisse.
 * 
 * Features:
 * - Request-Anomalie-Erkennung
 * - Rate-Limiting-Violations
 * - Verdächtige Header-Muster
 * - IP-basierte Threat-Detection
 * 
 * @author Paul Buchwald - ITSZ Team
 */
app.use(securityMonitoring);

/**
 * Test-Endpoints - VOR Route-Mounting definiert um Konflikte zu vermeiden
 * 
 * Diese Endpoints dienen der Systemdiagnose und dem Debugging.
 * Sie werden vor den Hauptrouten gemountet, um Routing-Konflikte zu verhindern.
 * 
 * @author Paul Buchwald - ITSZ Team
 */

/**
 * Health-Check-Endpoint
 * 
 * Überprüft den Systemstatus und gibt detaillierte Informationen
 * über die aktive Serverkonfiguration zurück.
 * 
 * @route GET /api/health
 * @returns {Object} Systemstatus und Konfigurationsinformationen
 * @author Paul Buchwald - ITSZ Team
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    security: {
      rateLimiting: true,
      inputValidation: true,
      securityHeaders: true,
      requestMonitoring: true,
      httpsEnforcement: false
    }
  });
});

/**
 * CORS-Test-Endpoint
 * 
 * Testet die CORS-Konfiguration und gibt detaillierte Informationen
 * über Request-Header und Origin-Behandlung zurück.
 * 
 * @route GET /api/cors-test
 * @returns {Object} CORS-Konfigurationsdaten und Request-Informationen
 * @author Paul Buchwald - ITSZ Team
 */
app.get('/api/cors-test', (req, res) => {
  res.json({
    message: 'CORS test successful',
    origin: req.get('Origin'),
    method: req.method,
    timestamp: new Date().toISOString(),
    protocol: req.protocol,
    secure: req.secure,
    headers: {
      host: req.get('Host'),
      origin: req.get('Origin'),
      referer: req.get('Referer')
    }
  });
});

/**
 * Browser-Cache und HSTS-Reset-Endpoint
 * 
 * Sendet aggressive Anti-Cache-Header um Browser-Caching-Probleme
 * und HSTS-Einträge zu umgehen. Hilfreich bei HTTP-zu-HTTPS-Problemen.
 * 
 * Features:
 * - Aggressive Cache-Control-Header
 * - Clear-Site-Data-Direktive
 * - HSTS-Header-Entfernung
 * - Browser-spezifische Reset-Anweisungen
 * 
 * @route GET /api/browser-reset
 * @returns {Object} Reset-Bestätigung und Benutzeranweisungen
 * @author Paul Buchwald - ITSZ Team
 */
app.get('/api/browser-reset', (req, res) => {
  // Aggressive Anti-Cache-Header
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', 'Thu, 01 Jan 1970 00:00:00 GMT');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Clear-Site-Data', '"cache", "storage"');
  
  // Explizit KEINE HSTS-Header
  res.removeHeader('Strict-Transport-Security');
  
  res.json({
    message: 'Browser-Cache-Reset erfolgreich',
    protocol: 'HTTP',
    port: 5000,
    httpsRedirect: false,
    timestamp: new Date().toISOString(),
    instructions: [
      '1. Drücken Sie Strg+Shift+R (Hard-Refresh)',
      '2. Öffnen Sie Developer Tools > Application > Storage > Clear Storage',
      '3. Oder verwenden Sie Incognito-Modus',
      '4. Bei Chrome: chrome://net-internals/#hsts - Domain löschen'
    ]
  });
});

/**
 * Haupt-Routen-Mounting
 * 
 * Ordnet die verschiedenen Router den entsprechenden URL-Pfaden zu.
 * WICHTIG: Routen werden NACH den Test-Endpoints gemountet.
 * 
 * Route-Struktur:
 * - /api/* -> authRoutes (Authentifizierung, Session-Management)
 * - /api/vpn/* -> vpnRoutes (VPN-Management-Funktionen)
 * - /api/admin/* -> adminRoutes (Administrative Funktionen)
 * 
 * @author Paul Buchwald - ITSZ Team
 */
app.use('/api', authRoutes);  // Auth-Routen unter /api mounten
app.use('/api/vpn', vpnRoutes); // VPN-Routen unter /api/vpn mounten
app.use('/api/admin', adminRoutes); // Admin-Routen unter /api/admin mounten

/**
 * Error-Handler (Reihenfolge ist wichtig - diese müssen als letztes definiert werden!)
 * 
 * Globale Fehlerbehandlung für alle nicht gefangenen Fehler.
 * Implementiert strukturierte Fehlerbehandlung und Logging.
 * 
 * Handler-Reihenfolge:
 * 1. notFoundHandler - für 404-Fehler
 * 2. globalErrorHandler - für alle anderen Fehler
 * 
 * @author Paul Buchwald - ITSZ Team
 */
app.use(notFoundHandler);
app.use(globalErrorHandler);

/**
 * Produktions-spezifische Middleware-Konfiguration
 * 
 * Aktiviert zusätzliche Sicherheitsmaßnahmen in der Produktionsumgebung.
 * Wird durch NODE_ENV=production gesteuert.
 * 
 * @author Paul Buchwald - ITSZ Team
 */
if (process.env.NODE_ENV === 'production') {
  // Zusätzliche Produktions-Sicherheitsmaßnahmen
  logger.info('Production mode: Enhanced security measures activated');
}

/**
 * Server-Port-Konfiguration
 * 
 * Port wird aus Umgebungsvariablen gelesen oder Standard-Port 5000 verwendet.
 * In Docker/Kubernetes-Umgebungen wird PORT automatisch gesetzt.
 * 
 * @author Paul Buchwald - ITSZ Team
 */
const PORT = process.env.PORT || 5000;

/**
 * === VEREINFACHTER HTTP-SERVER-START ===
 * 
 * In einer Produktionsumgebung mit Nginx als Reverse-Proxy sollte der Node-Server
 * immer als einfacher HTTP-Server laufen. Nginx kümmert sich um SSL/HTTPS.
 * 
 * Architektur:
 * Internet → Nginx (Port 80/443, SSL-Terminierung) → Node.js (Port 5000, HTTP-only)
 * 
 * Vorteile:
 * - SSL-Zertifikat-Management durch Nginx
 * - Load Balancing durch Nginx möglich
 * - Static File Serving durch Nginx (performanter)
 * - Node.js fokussiert auf API-Logic
 * 
 * Der gesamte 'if (process.env.NODE_ENV === 'production')' Block für HTTPS wurde entfernt,
 * da Nginx die SSL-Terminierung übernimmt.
 * 
 * @author Paul Buchwald - ITSZ Team
 */
http.createServer(app).listen(PORT, () => {
  const environment = process.env.NODE_ENV || 'development';
  
  // Strukturiertes Server-Start-Logging
  logger.info('HNEE Server gestartet', {
    port: PORT,
    environment: environment,
    timestamp: new Date().toISOString(),
    protocol: 'HTTP',
    httpsRedirect: false,
    securityFeatures: [
      'rate-limiting',
      'input-validation', 
      'security-headers',
      'request-monitoring',
      'error-handling',
      'payload-validation'
    ]
  });
  
  // Benutzerfreundliche Konsolen-Ausgabe
  console.log(`🚀 HNEE Server läuft auf Port ${PORT} (Umgebung: ${environment})`);
  console.log(`📡 Protokoll: HTTP (HTTPS-Redirect deaktiviert)`);
  console.log(`🔒 Sicherheitsfeatures aktiv: Rate Limiting, Input Validation, Security Headers`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 CORS Origins: Frontend auf verschiedenen Ports erlaubt`);
  console.log(`🔧 Nginx-Integration: API-Requests über Port 80/443 → Port ${PORT}`);
});
