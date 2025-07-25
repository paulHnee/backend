import cors from 'cors';

/**
 * CORS (Cross-Origin Resource Sharing) Konfigurationsoptionen
 * Definiert die Regeln für Cross-Origin Anfragen
 */
const corsOptions = {
    // Erlaubt mehrere Origins
    origin: function(origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL || 'http://10.1.1.45',
            process.env.ADDITIONAL_ORIGINS ? process.env.ADDITIONAL_ORIGINS.split(',') : [],
        ].flat();
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS request from unauthorized origin: ${origin}`);
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