/**
 * Security Headers Configuration - Helmet Konfiguration für HNEE System
 * 
 * Diese Datei definiert die Sicherheits-Header-Konfiguration für die Anwendung.
 * Verwendet Helmet.js für umfassenden Schutz vor häufigen Web-Schwachstellen.
 * 
 * Aktuelle Konfiguration: HTTP (HSTS deaktiviert)
 * 
 * Schutzmaßnahmen:
 * - Content Security Policy (CSP)
 * - Clickjacking-Schutz
 * - MIME-Type-Sniffing-Schutz
 * - XSS-Schutz
 * - HSTS deaktiviert (für HTTP-Betrieb)
 * 
 * @author Paul Buchwald
 * @version 1.0.0
 */

/**
 * Helmet Konfiguration für erweiterte Sicherheits-Header
 * WICHTIG: Komplett angepasst für HTTP-Only-Betrieb ohne upgrade-insecure-requests
 */
export const helmetConfig = {
  // CSP komplett manuell definieren um upgrade-insecure-requests zu vermeiden
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'"],
      "font-src": ["'self'"],
      "object-src": ["'none'"],
      "media-src": ["'self'"],
      "frame-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'self'"],
      "script-src-attr": ["'none'"]
    },
    useDefaults: false, // Verhindert automatisches upgrade-insecure-requests
    reportOnly: false
  },
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  // Prevent MIME type sniffing
  noSniff: true,
  // XSS protection (disabled - CSP ist besser)
  xssFilter: false,
  // Strict Transport Security (EXPLIZIT deaktiviert für HTTP)
  hsts: false,
  // Referrer policy
  referrerPolicy: { policy: 'same-origin' },
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // Cross-Origin policies
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  // Origin Agent Cluster
  originAgentCluster: true,
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  // X-Download-Options
  ieNoOpen: true,
  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: false
};
