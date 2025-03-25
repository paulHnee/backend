require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');
const expressWinston = require('express-winston');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const corsConfig = require('./config/corsConfig');
const authRoutes = require('./routes/authRoutes');
const vpnRoutes = require('./routes/vpnRoutes');
const errorHandler = require('./middlewares/errorHandler');
const printRoutes = require('./utils/routeDebugger');

const app = express();
const port = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  xssFilter: true
}));

// Basic middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsConfig));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later."
}));

// Logging
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' })
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

app.use(morgan('combined'));
app.use(expressWinston.logger({ winstonInstance: logger }));

// Development middleware
if (process.env.NODE_ENV !== 'production') {
  const requestDebug = require('./middlewares/requestDebug');
  app.use(requestDebug);
}

// Routes
app.use('/auth', authRoutes);
app.use('/api/vpn', vpnRoutes);

// Health check
app.get('/ping', (req, res) => res.json({ status: 'ok' }));

// Error handlers
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

// Server startup
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`Server running on port ${port}`);
  if (process.env.NODE_ENV !== 'production') {
    printRoutes(app);
  }
});

// Graceful shutdown
const shutdown = signal => {
  logger.info(`${signal} received: closing HTTP server`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));