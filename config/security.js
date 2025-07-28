/**
 * Security Configuration - Zentrale Sicherheitskonfiguration für HNEE System
 * 
 * Diese Datei enthält alle sicherheitsrelevanten Konfigurationen:
 * - Rate Limiting Einstellungen
 * - Validation Rules
 * - Security Thresholds
 * - Environment-spezifische Einstellungen
 * 
 * @author ITSZ Team
 * @version 1.0.0
 */

/**
 * Rate Limiting Konfiguration
 */
export const rateLimitConfig = {
  // Allgemeine API Rate Limits
  general: {
    windowMs: 15 * 60 * 1000, // 15 Minuten
    max: 100, // 100 Requests pro IP pro Window
    message: 'Zu viele Anfragen von dieser IP, bitte versuchen Sie es später erneut'
  },
  
  // Authentifizierung Rate Limits (strenger)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 Minuten
    max: 5, // 5 Login-Versuche pro IP pro Window
    message: 'Zu viele Login-Versuche, bitte versuchen Sie es in 15 Minuten erneut'
  },
  
  // VPN-spezifische Rate Limits
  vpn: {
    windowMs: 60 * 60 * 1000, // 1 Stunde
    max: 10, // 10 VPN-Operationen pro IP pro Stunde
    message: 'Zu viele VPN-Anfragen, bitte versuchen Sie es später erneut'
  }
};

/**
 * Input Validation Regeln
 */
export const validationRules = {
  username: {
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9._-]+$/,
    errorMessage: 'Ungültiger Benutzername - nur Buchstaben, Zahlen, Punkte, Unterstriche und Bindestriche erlaubt'
  },
  
  password: {
    minLength: 1,
    maxLength: 128,
    errorMessage: 'Passwort erforderlich'
  },
  
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    errorMessage: 'Ungültige E-Mail-Adresse'
  },
  
  vpnKey: {
    minLength: 32,
    maxLength: 1024,
    pattern: /^[A-Za-z0-9+/=]+$/,
    errorMessage: 'Ungültiger VPN-Schlüssel Format'
  }
};

/**
 * Sicherheits-Schwellenwerte
 */
export const securityThresholds = {
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  maxFileUploadSize: 1 * 1024 * 1024, // 1MB
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 Stunden
  csrfTokenTimeout: 60 * 60 * 1000, // 1 Stunde
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000 // 15 Minuten
};

/**
 * Suspicious Request Patterns
 */
export const suspiciousPatterns = [
  /\.\.\//,  // Path traversal
  /<script/i, // XSS attempts
  /union.*select/i, // SQL injection
  /javascript:/i, // JavaScript injection
  /eval\(/i, // Code injection
  /exec\(/i, // Command injection
  /system\(/i, // System calls
  /\bor\b.*\b1=1\b/i, // SQL injection patterns
  /\bdrop\b.*\btable\b/i, // SQL DDL attacks
  /<iframe/i, // Iframe injection
  /vbscript:/i, // VBScript injection
  /document\.cookie/i, // Cookie theft attempts
  /onload\s*=/i, // Event handler injection
  /onclick\s*=/i, // Event handler injection
];

/**
 * Erlaubte Dateitypen für File Uploads
 */
export const allowedFileTypes = {
  vpnConfig: ['.conf', '.ovpn'],
  certificates: ['.crt', '.pem', '.key'],
  images: ['.jpg', '.jpeg', '.png', '.gif', '.svg'],
  documents: ['.pdf', '.txt', '.doc', '.docx']
};

/**
 * Environment-spezifische Konfiguration
 */
export const environmentConfig = {
  development: {
    logLevel: 'debug',
    showStackTrace: true,
    corsOrigins: ['http://localhost:3000', 'http://localhost:5173'],
    httpsRequired: false
  },
  
  production: {
    logLevel: 'warn',
    showStackTrace: false,
    corsOrigins: ['https://10.1.1.45'],
    httpsRequired: true,
    additionalHeaders: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    }
  },
  
  test: {
    logLevel: 'error',
    showStackTrace: true,
    corsOrigins: ['http://localhost:3000'],
    httpsRequired: false
  }
};

/**
 * Security Headers für verschiedene Umgebungen
 */
export const getSecurityConfig = (environment = 'development') => {
  const config = environmentConfig[environment] || environmentConfig.development;
  
  return {
    rateLimits: rateLimitConfig,
    validation: validationRules,
    thresholds: securityThresholds,
    suspiciousPatterns,
    allowedFileTypes,
    environment: config
  };
};
