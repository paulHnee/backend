/**
 * HNEE Backend Server - Express.js API Server
 *
 * Hauptserver für das HNEE Management-System mit LDAP-Integration und VPN-Management.
 * Architektur: Nginx Reverse Proxy (SSL) → Node.js Express (HTTP-only)
 * Features: Authentifizierung, VPN-Management, Security Headers, Monitoring, Logging
 * Stack: Express.js, Node.js 20+, LDAP, Winston
 *
 * @author Paul Buchwald - ITSZ Team, HNEE
 * @version 2.0.0
 * @since 2025-07-29
 * @license Proprietary - HNEE Internal Use Only
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cookieParser from 'cookie-parser';

// Security Imports
import { 
  generalLimiter, 
  securityMonitoring,
  validatePayloadSize 
} from './middleware/securityMiddleware.js';
import { logger } from './utils/securityLogger.js';
import { 
  globalErrorHandler, 
  notFoundHandler 
} from './middleware/errorHandlers.js';

// Route Imports
import { router as authRoutes } from './routes/authRoutes.js';
import { router as vpnRoutes } from './routes/vpnRoutes.js';
import { router as adminRoutes } from './routes/adminRoutes.js';
import { router as monitoringRoutes } from './routes/monitoringRoutes.js';
import userRoutes from './routes/userRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';

// Import CORS options and compact, well-commented securityHeaders middleware
import { corsOptions, securityHeaders } from './config/cors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


// Express-App initialisieren
const app = express();

// Middleware-Konfiguration

// Proxy-Vertrauen aktivieren (korrekte IP-Erkennung hinter Nginx)
app.set('trust proxy', 1);

// Rate Limiting aktivieren
app.use(generalLimiter);

// Security-Header Middleware (CSP, X-Frame-Options, Referrer-Policy, ...)
app.use(securityHeaders);

// CORS für Produktion aktivieren (siehe corsOptions in config/cors.js)
app.use(cors(corsOptions));


// Payload-Größenvalidierung (Schutz vor zu großen Requests)
app.use(validatePayloadSize);

// Body-Parser mit Limit (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cookie-Parser für Session-Handling
app.use(cookieParser());

// Sicherheitsüberwachung & Monitoring
app.use(securityMonitoring);

// Test- und Diagnose-Endpunkte (vor den Hauptrouten)

// Health-Check-Endpunkt
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

// Browser-Cache- und HSTS-Reset-Endpunkt
app.get('/api/browser-reset', (req, res) => {
  // Aggressive Anti-Cache-Header setzen
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', 'Thu, 01 Jan 1970 00:00:00 GMT');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Clear-Site-Data', '"cache", "storage"');
  // HSTS-Header explizit entfernen
  res.removeHeader('Strict-Transport-Security');
  res.json({
    message: 'Browser-Cache-Reset erfolgreich',
    protocol: 'HTTP',
    port: 5000,
    httpsRedirect: false,
    timestamp: new Date().toISOString(),
    instructions: [
      '1. Strg+Shift+R (Hard-Refresh)',
      '2. Developer Tools > Application > Storage > Clear Storage',
      '3. Oder Inkognito-Modus verwenden',
      '4. Chrome: chrome://net-internals/#hsts - Domain löschen'
    ]
  });
});

// Haupt-Routen-Mounting (nach Test-Endpunkten)
app.use('/api', authRoutes);        // Authentifizierung & Session
app.use('/api/vpn', vpnRoutes);     // VPN-Management
app.use('/api/admin', adminRoutes); // Admin/Monitoring
app.use('/api/monitoring', monitoringRoutes); // System-Monitoring
app.use('/api/user', userRoutes);   // Benutzerfunktionen
app.use('/api/integration', integrationRoutes); // Externe Integrationen

// Fehlerbehandlung (404 zuerst, dann global)
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Produktionsspezifische Middleware (nur in Produktion)
if (process.env.NODE_ENV === 'production') {
  logger.info('Production mode: Erweiterte Sicherheitsmaßnahmen aktiv');
}

// Server-Port-Konfiguration
const PORT = process.env.PORT || 5000;

// HTTP-Server-Start (SSL/HTTPS via Nginx, Node.js nur HTTP)
http.createServer(app).listen(PORT, () => {
  const environment = process.env.NODE_ENV || 'development';
  // Server-Start Logging
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
  // Konsolenausgabe
  console.log(`🚀 HNEE Server läuft auf Port ${PORT} (Umgebung: ${environment})`);
  console.log(`📡 Protokoll: HTTP (HTTPS-Redirect deaktiviert)`);
  console.log(`🔒 Sicherheitsfeatures aktiv: Rate Limiting, Input Validation, Security Headers`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 CORS Origins: Frontend auf verschiedenen Ports erlaubt`);
  console.log(`🔧 Nginx-Integration: API-Requests über Port 80/443 → Port ${PORT}`);
});
