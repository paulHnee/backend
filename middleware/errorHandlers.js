/**
 * Error Handlers - Zentrale Fehlerbehandlung für HNEE System
 * 
 * Diese Datei enthält verschiedene Error-Handler-Middleware:
 * - Globaler Error Handler
 * - 404 Not Found Handler
 * - Validation Error Handler
 * - Security Error Handler
 * 
 * @author ITSZ Team
 * @version 1.0.0
 */

import { logSecurityEvent } from '../utils/securityLogger.js';

/**
 * Globaler Error Handler mit Security Logging
 * 
 * @param {Error} err - Error Objekt
 * @param {Request} req - Express Request
 * @param {Response} res - Express Response
 * @param {Function} next - Next Middleware
 */
export const globalErrorHandler = (err, req, res, next) => {
  // Security Event loggen
  logSecurityEvent('APPLICATION_ERROR', req, { 
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    statusCode: err.status || 500
  });
  
  // Error Details nur in Development zeigen
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Ein interner Serverfehler ist aufgetreten',
    ...(isDevelopment && { 
      stack: err.stack,
      details: err.details 
    })
  });
};

/**
 * 404 Not Found Handler
 * 
 * @param {Request} req - Express Request
 * @param {Response} res - Express Response
 */
export const notFoundHandler = (req, res) => {
  logSecurityEvent('NOT_FOUND', req, { 
    attemptedPath: req.originalUrl,
    method: req.method
  });
  
  res.status(404).json({ 
    error: 'Endpunkt nicht gefunden',
    path: req.originalUrl,
    method: req.method
  });
};

/**
 * Security Error Handler für spezifische Sicherheitsfehler
 * 
 * @param {string} errorType - Art des Sicherheitsfehlers
 * @param {string} message - Fehlermeldung
 * @param {number} statusCode - HTTP Status Code
 */
export const createSecurityErrorHandler = (errorType, message, statusCode = 403) => {
  return (req, res, next) => {
    logSecurityEvent(errorType, req, {
      message,
      statusCode,
      severity: 'high'
    });
    
    res.status(statusCode).json({
      error: message,
      type: errorType,
      timestamp: new Date().toISOString()
    });
  };
};

/**
 * Async Error Handler Wrapper
 * Verhindert unbehandelte Promise Rejections
 * 
 * @param {Function} fn - Async Middleware Function
 */
export const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
