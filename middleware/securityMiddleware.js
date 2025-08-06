/**
 * Security Middleware - Zentrale Sicherheits-Middleware für HNEE System
 * 
 * Diese Datei enthält verschiedene Sicherheits-Middleware-Funktionen:
 * - Rate Limiting (allgemein und authentifizierungsspezifisch)
 * - Input Validation
 * - HTTPS Enforcement
 * - Request Monitoring
 * 
 * @author ITSZ Team
 * @version 1.0.0
 */

import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { logSecurityEvent } from '../utils/securityLogger.js';

// Rate Limiting Configuration
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: {
    error: 'Zu viele Anfragen von dieser IP, bitte versuchen Sie es später erneut'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', req, { 
      limit: 'general',
      windowMs: 15 * 60 * 1000 
    });
    res.status(429).json({
      error: 'Zu viele Anfragen von dieser IP, bitte versuchen Sie es später erneut'
    });
  }
});

// Stricter rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window per IP
  message: {
    error: 'Zu viele Login-Versuche, bitte versuchen Sie es in 15 Minuten erneut'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent('AUTH_RATE_LIMIT_EXCEEDED', req, { 
      username: req.body?.username,
      attempts: 5 
    });
    res.status(429).json({
      error: 'Zu viele Login-Versuche, bitte versuchen Sie es in 15 Minuten erneut'
    });
  }
});

// Input Validation Middleware
export const loginValidation = [
  body('username')
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Ungültiger Benutzername - nur Buchstaben, Zahlen, Punkte, Unterstriche und Bindestriche erlaubt'),
  body('password')
    .isLength({ min: 1, max: 128 })
    .withMessage('Passwort erforderlich')
];

// Validation Error Handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logSecurityEvent('VALIDATION_ERROR', req, { 
      errors: errors.array(),
      body: req.body 
    });
    return res.status(400).json({ 
      error: 'Ungültige Eingabedaten',
      details: errors.array() 
    });
  }
  next();
};

// HTTPS Redirect Middleware (for production)
export const forceHTTPS = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && 
      !req.secure && 
      req.get('x-forwarded-proto') !== 'https') {
    logSecurityEvent('HTTP_TO_HTTPS_REDIRECT', req);
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  next();
};

// Security logging middleware for suspicious requests
export const securityMonitoring = (req, res, next) => {
  // Log suspicious requests
  const suspiciousPatterns = [
    /\.\.\//,  // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
    /eval\(/i, // Code injection
  ];
  
  const url = req.url.toLowerCase();
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url));
  
  if (isSuspicious) {
    logSecurityEvent('SUSPICIOUS_REQUEST', req, { 
      pattern: 'detected',
      severity: 'high' 
    });
  }
  
  next();
};

// Payload size validation middleware
export const validatePayloadSize = (req, res, next) => {
  const contentLength = req.get('content-length');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    logSecurityEvent('PAYLOAD_TOO_LARGE', req, { 
      size: contentLength,
      maxSize: maxSize 
    });
    return res.status(413).json({
      error: 'Payload zu groß',
      maxSize: '10MB'
    });
  }
  
  next();
};

// Admin role validation middleware
export const requireAdmin = (req, res, next) => {
  // Check if user object exists (should be set by verifyToken middleware)
  if (!req.user) {
    logSecurityEvent('ADMIN_ACCESS_ATTEMPT_NO_USER', req, { 
      severity: 'high' 
    });
    return res.status(401).json({
      error: 'Authentifizierung erforderlich'
    });
  }

  // Check if user has admin role
  if (!req.user.isAdmin && !req.user.roles?.includes('admin')) {
    logSecurityEvent('ADMIN_ACCESS_DENIED', req, { 
      username: req.user.username,
      roles: req.user.roles,
      severity: 'medium' 
    });
    return res.status(403).json({
      error: 'Administratorrechte erforderlich'
    });
  }

  next();
};
