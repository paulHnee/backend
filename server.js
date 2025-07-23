import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { productionConfig } from './config/production.js';
import cookieParser from 'cookie-parser';

import { router as authRoutes } from './routes/authRoutes.js';
import { corsOptions } from './config/cors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Express App-Instanz erstellen
const app = express();

// Middleware Konfiguration
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use('/api', authRoutes);

// Produktions-Middleware
if (process.env.NODE_ENV === 'production') {
  app.use(helmet());
  app.set('trust proxy', 1);
}

// Server-Port aus Umgebungsvariablen oder Standard-Port 5000
const PORT = process.env.PORT || 5000;

// Server starten basierend auf Umgebung
if (process.env.NODE_ENV === 'production') {
  try {
    const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs');
    const options = {
      key: fs.readFileSync(path.join(certPath, 'itsz.hnee.de.key')),
      cert: fs.readFileSync(path.join(certPath, 'itsz.hnee.de.crt')),
      ...productionConfig.ssl
    };

    https.createServer(options, app).listen(PORT, () => {
      console.log(`HTTPS Server running on port ${PORT} (Production)`);
    });
  } catch (error) {
    console.error('Failed to start HTTPS server:', error);
    process.exit(1);
  }
} else {
  // Development-Modus: HTTP-Server
  http.createServer(app).listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT} (Development)`);
  });
}
