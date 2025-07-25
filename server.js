import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
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

// --- VEREINFACHTER SERVER-START ---
// In einer Produktionsumgebung mit Nginx als Reverse-Proxy sollte der Node-Server
// immer als einfacher HTTP-Server laufen. Nginx kümmert sich um SSL/HTTPS.
// Der gesamte 'if (process.env.NODE_ENV === 'production')' Block für HTTPS wird entfernt.

http.createServer(app).listen(PORT, () => {
  // Wir geben die Umgebung aus, um Klarheit zu schaffen.
  const environment = process.env.NODE_ENV || 'development';
  console.log(`HTTP Server running on port ${PORT} (Environment: ${environment})`);
});
