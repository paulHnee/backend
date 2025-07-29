import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import helmet from 'helmet';
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
import { helmetConfig } from './config/securityHeaders.js';
import { logger } from './utils/securityLogger.js';
import { 
  globalErrorHandler, 
  notFoundHandler 
} from './middleware/errorHandlers.js';

// Route Imports
import { router as authRoutes } from './routes/authRoutes.js';
import { router as vpnRoutes } from './routes/vpnRoutes.js';
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

// Enhanced security headers using separated config
app.use(helmet(helmetConfig));

// CORS configuration
app.use(cors(corsOptions));

// Payload size validation
app.use(validatePayloadSize);

// Body parsing with size limits (prevent DoS attacks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cookie parser
app.use(cookieParser());

// Security monitoring middleware
app.use(securityMonitoring);

// Mount routes
app.use('/api', authRoutes);  // Auth-Routen unter /api mounten
app.use('/api/vpn', vpnRoutes); // VPN-Routen unter /api/vpn mounten

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    security: {
      rateLimiting: true,
      inputValidation: true,
      securityHeaders: true,
      requestMonitoring: true
    }
  });
});

// Error Handlers (Order matters - these should be last!)
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Produktions-Middleware
if (process.env.NODE_ENV === 'production') {
  // Additional production security measures
  logger.info('Production mode: Enhanced security measures activated');
}

// Server-Port aus Umgebungsvariablen oder Standard-Port 5000
const PORT = process.env.PORT || 5000;

// --- VEREINFACHTER SERVER-START ---
// In einer Produktionsumgebung mit Nginx als Reverse-Proxy sollte der Node-Server
// immer als einfacher HTTP-Server laufen. Nginx kümmert sich um SSL/HTTPS.
// Der gesamte 'if (process.env.NODE_ENV === 'production')' Block für HTTPS wird entfernt.

http.createServer(app).listen(PORT, () => {
  const environment = process.env.NODE_ENV || 'development';
  
  // Log server startup
  logger.info('HNEE Server gestartet', {
    port: PORT,
    environment: environment,
    timestamp: new Date().toISOString(),
    securityFeatures: [
      'rate-limiting',
      'input-validation', 
      'security-headers',
      'request-monitoring',
      'error-handling',
      'payload-validation'
    ]
  });
  
  console.log(`🚀 HNEE Server läuft auf Port ${PORT} (Umgebung: ${environment})`);
  console.log(`� Protokoll: HTTP (HTTPS-Redirect deaktiviert)`);
  console.log(`�🔒 Sicherheitsfeatures aktiv: Rate Limiting, Input Validation, Security Headers`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
});
