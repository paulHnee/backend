require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');
const expressWinston = require('express-winston');
const rateLimit = require('express-rate-limit');
const corsConfig = require('./config/corsConfig');
const loginRoutes = require('./routes/loginRoutes');
const vpnRoutes = require('./routes/vpnRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const port = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors(corsConfig));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,                                   // 15 minutes
  max: 100                                                    // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Logging
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

app.use(express.json());
app.use('/api', loginRoutes);
app.use('/vpn', vpnRoutes);

// Zentrales error handling
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});