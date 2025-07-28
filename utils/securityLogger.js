/**
 * Security Logger - Zentrale Sicherheits-Logging-Funktionalität
 * 
 * Diese Datei stellt eine einheitliche Logging-Infrastruktur für 
 * sicherheitsrelevante Ereignisse zur Verfügung.
 * 
 * Features:
 * - Winston-basiertes strukturiertes Logging
 * - Datei- und Konsolen-Ausgabe
 * - Sicherheitsereignis-Kategorisierung
 * - Automatische Metadaten-Erfassung
 * 
 * @author ITSZ Team
 * @version 1.0.0
 */

import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Logs-Verzeichnis erstellen falls nicht vorhanden
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Security Logger Configuration
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'hnee-security' },
  transports: [
    // Sicherheitsereignisse in separate Datei
    new winston.transports.File({ 
      filename: path.join(logsDir, 'security.log'),
      level: 'warn'
    }),
    // Allgemeine Logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log') 
    }),
    // Konsolen-Ausgabe in Development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Security Event Logging Function
 * 
 * Zentrale Funktion zum Protokollieren von Sicherheitsereignissen
 * 
 * @param {string} event - Art des Sicherheitsereignisses
 * @param {object} req - Express Request Objekt
 * @param {object} details - Zusätzliche Event-Details
 */
export const logSecurityEvent = (event, req, details = {}) => {
  const logData = {
    event,
    ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
    userAgent: req?.get ? req.get('User-Agent') : 'unknown',
    url: req?.url || req?.originalUrl || 'unknown',
    method: req?.method || 'unknown',
    timestamp: new Date().toISOString(),
    sessionId: req?.sessionID,
    userId: req?.user?.username,
    ...details
  };

  // Log-Level basierend auf Event-Typ bestimmen
  const logLevel = getLogLevel(event);
  logger.log(logLevel, `Security Event: ${event}`, logData);
};

/**
 * Bestimmt das Log-Level basierend auf dem Event-Typ
 * 
 * @param {string} event - Art des Sicherheitsereignisses
 * @returns {string} Winston Log-Level
 */
const getLogLevel = (event) => {
  const criticalEvents = [
    'AUTH_RATE_LIMIT_EXCEEDED',
    'SUSPICIOUS_REQUEST',
    'PAYLOAD_TOO_LARGE',
    'VALIDATION_ERROR'
  ];
  
  const warningEvents = [
    'RATE_LIMIT_EXCEEDED',
    'NOT_FOUND',
    'HTTP_TO_HTTPS_REDIRECT'
  ];
  
  if (criticalEvents.includes(event)) {
    return 'error';
  } else if (warningEvents.includes(event)) {
    return 'warn';
  } else {
    return 'info';
  }
};

/**
 * Spezielle Funktion für Authentifizierungsereignisse
 * 
 * @param {string} username - Benutzername
 * @param {string} action - Authentifizierungsaktion (login, logout, failed)
 * @param {object} req - Express Request Objekt
 * @param {object} details - Zusätzliche Details
 */
export const logAuthEvent = (username, action, req, details = {}) => {
  logSecurityEvent(`AUTH_${action.toUpperCase()}`, req, {
    username,
    action,
    ...details
  });
};
