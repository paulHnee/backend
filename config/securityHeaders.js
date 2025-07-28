/**
 * Security Headers Configuration - Helmet Konfiguration für HNEE System
 * 
 * Diese Datei definiert die Sicherheits-Header-Konfiguration für die Anwendung.
 * Verwendet Helmet.js für umfassenden Schutz vor häufigen Web-Schwachstellen.
 * 
 * Schutzmaßnahmen:
 * - Content Security Policy (CSP)
 * - Clickjacking-Schutz
 * - MIME-Type-Sniffing-Schutz
 * - XSS-Schutz
 * - HSTS (HTTP Strict Transport Security)
 * 
 * @author ITSZ Team
 * @version 1.0.0
 */

/**
 * Helmet Konfiguration für erweiterte Sicherheits-Header
 */
export const helmetConfig = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    },
  },
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  // Prevent MIME type sniffing
  noSniff: true,
  // XSS protection
  xssFilter: true,
  // Strict Transport Security (HTTPS only)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  // Referrer policy
  referrerPolicy: { policy: 'same-origin' },
  // Hide X-Powered-By header
  hidePoweredBy: true
};
