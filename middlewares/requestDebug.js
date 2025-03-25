const winston = require('winston');

// Configure production logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'requests.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

const requestDebug = (req, res, next) => {
  try {
    // Log only essential information in production
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.headers['x-correlation-id']
    };

    // Don't log sensitive data
    if (req.path.includes('login') || req.path.includes('password')) {
      logData.body = '[REDACTED]';
    }

    logger.info('Request received', logData);

    // Add response logging
    const originalSend = res.send;
    res.send = function (data) {
      res.send = originalSend;
      logger.info('Response sent', {
        ...logData,
        statusCode: res.statusCode,
        responseTime: Date.now() - req._startTime
      });
      return res.send(data);
    };

    next();
  } catch (error) {
    logger.error('Request logging failed', {
      error: error.message,
      stack: error.stack
    });
    next();
  }
};

module.exports = requestDebug;