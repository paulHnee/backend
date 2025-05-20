const cors = require('cors');

/**
 * CORS (Cross-Origin Resource Sharing) Konfigurationsoptionen
 * Definiert die Regeln für Cross-Origin Anfragen
 */
export const corsOptions = {
    // Erlaubte Origin (Frontend-URL)
    // Fällt zurück auf localhost:3000 wenn keine Umgebungsvariable gesetzt ist
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // Erlaubte HTTP-Methoden
    methods: ['GET', 'POST'],
    
    // Erlaubte HTTP-Header
    allowedHeaders: ['Content-Type', 'Authorization'],
    
    // Erlaubt das Senden von Cookies und Authentication-Headers
    credentials: true,
    
    // Cache-Dauer für CORS-Preflight Requests in Sekunden
    maxAge: 86400 // 24 Stunden
  };