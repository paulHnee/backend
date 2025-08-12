/**
 * Security Headers Middleware (CSP, X-Frame-Options, etc.)
 *
 * Exportiert eine Middleware, die alle wichtigen Security-Header setzt.
 * Kann zentral in server.js eingebunden werden.
 */
/**
 * Kompakte Security-Header Middleware (CSP, X-Frame-Options, etc.)
 * Setzt alle wichtigen HTTP-Sicherheitsheader für Express.js
 */
export const securityHeaders = (req, res, next) => {
    // Basis-Schutz: MIME, Clickjacking, DNS Prefetch, Download, Cross-Domain
    res.setHeader('X-Content-Type-Options', 'nosniff'); // MIME sniffing verhindern
    res.setHeader('X-Frame-Options', 'DENY'); // Clickjacking verhindern
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // Referrer und Cross-Origin Policies
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Origin-Agent-Cluster', '?1');

    // Content Security Policy (CSP) - kompakt, ohne upgrade-insecure-requests
    res.setHeader('Content-Security-Policy', [
        "default-src 'self' http: https:",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: http: https:",
        "connect-src 'self' http: https:",
        "font-src 'self'",
        "object-src 'none'",
        "media-src 'self'",
        "frame-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "script-src-attr 'none'"
    ].join('; '));

    // Server-Infos und Caching
    res.removeHeader('X-Powered-By'); // Express-Version verbergen
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
};

/**
 * CORS (Cross-Origin Resource Sharing) Konfigurationsoptionen
 * Definiert die Regeln für Cross-Origin Anfragen
 */
const corsOptions = {
    // Erlaubt mehrere Origins
    origin: function(origin, callback) {
        const allowedOrigins = [
            // Frontend URLs (mit und ohne Port)
            process.env.FRONTEND_URL || 'https://itsz.hnee.de',
            'http://localhost',          // Local nginx proxy
            'http://localhost:80',       // Local nginx proxy explicit
            'http://localhost:3000',     // Local Development
            'http://127.0.0.1',          // Localhost IPv4
            'http://127.0.0.1:80',       // Localhost IPv4 explicit
            // Legacy IP-based origins for backward compatibility
            'http://10.1.1.45',
            'http://10.1.1.45:3000',
            // Additional origins from env
            ...(process.env.ADDITIONAL_ORIGINS ? process.env.ADDITIONAL_ORIGINS.split(',') : []),
        ];
        
        // Allow requests with no origin (mobile apps, curl, Postman, etc.)
        if (!origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS request from unauthorized origin: ${origin}`);
            console.warn(`Allowed origins:`, allowedOrigins);
            callback(new Error('CORS policy violation'));
        }
    },
    
    // Erlaubte HTTP-Methoden
    methods: ['GET', 'POST', 'OPTIONS'],
    
    // Erlaubte HTTP-Header
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    
    // Erlaubt das Senden von Cookies und Authentication-Headers
    credentials: true,
    
    // Cache-Dauer für CORS-Preflight Requests in Sekunden
    maxAge: 86400, // 24 Stunden

    // Expose these headers to the browser
    exposedHeaders: ['Content-Length', 'X-Requested-With']
};

export { corsOptions };