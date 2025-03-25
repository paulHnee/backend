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
const authRoutes = require('./routes/authRoutes'); // Replace loginRoutes import
const vpnRoutes = require('./routes/vpnRoutes');
const errorHandler = require('./middlewares/errorHandler');
const printRoutes = require('./utils/routeDebugger');

const app = express();
const port = process.env.PORT || 5000;

// 1. Basic middleware - Must be first
app.use(express.json());
app.use(cookieParser());

// 2. CORS configuration - Must be before other middleware
app.use(cors(corsConfig));

// 3. Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now, configure as needed
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  xssFilter: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later."
});
app.use(limiter);

// 4. Request logging
app.use(morgan('combined'));
app.use(expressWinston.logger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' })
  ],
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.json()
  )
}));

// Enable detailed error logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
  
  // Add request debugging in development
  const requestDebug = require('./middlewares/requestDebug');
  app.use(requestDebug);
}

// 5. Routes
app.use('/auth', authRoutes); // Use the new auth routes
app.use('/api/vpn', vpnRoutes); // Updated VPN routes path for clarity

// Test route
app.get('/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// 404 handler - add before error handler
app.use((req, res, next) => {
  console.log(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  
  // Print all registered routes
  printRoutes(app);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});