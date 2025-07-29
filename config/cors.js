import cors from 'cors';

/**
 * CORS (Cross-Origin Resource Sharing) Konfigurationsoptionen
 * Definiert die Regeln für Cross-Origin Anfragen
 */
const corsOptions = {
    // Erlaubt mehrere Origins
    origin: function(origin, callback) {
        const allowedOrigins = [
            // Frontend URLs (mit und ohne Port)
            process.env.FRONTEND_URL || 'http://10.1.1.45',
            'http://10.1.1.45:8080',  // Frontend Dev Server
            'http://10.1.1.45:3000',  // Alternative Frontend Port
            'http://10.1.1.45:5173', // Vite Dev Server
            'http://localhost:8080',  // Local Frontend
            'http://localhost:3000',  // Local Development
            'http://localhost:5173',  // Local Vite
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