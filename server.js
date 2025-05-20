require('dotenv').config(); // Lädt Umgebungsvariablen aus .env Datei
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const { corsOptions } = require('./config/cors');

// Express App-Instanz erstellen
const app = express();

// Middleware Konfiguration
app.use(cors(corsOptions));        // CORS-Schutz aktivieren
app.use(express.json());           // JSON-Parser für Request Bodies
app.use('/api', authRoutes);       // Auth-Routen unter /api mounten

// Server-Port aus Umgebungsvariablen oder Standard-Port 5000
const PORT = process.env.PORT || 5000;

// Server starten und auf eingestelltem Port lauschen
app.listen(PORT, () => {
  console.log(`Server laeuft auf Port ${PORT}`);
});