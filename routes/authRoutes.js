const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { generateTokenPair, verifyToken } = require('../config/jwtConfig');
const db = require('../config/database');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { validateLogin } = require('../middlewares/validation');

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: "Too many login attempts, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Less strict rate limit for token refresh
const refreshLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // limit each IP to 100 refresh requests per hour
  message: "Too many refresh attempts, please try again later."
});

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// Debug endpoint
router.get('/status', (req, res) => {
  res.json({ status: 'Auth router operational' });
});

// Add this before other routes
router.post('/test-cookies', (req, res) => {
  res.cookie('test-cookie', 'test-value', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 900000
  });
  res.json({ message: 'Cookie set test' });
});

// Login route with validation and rate limiting
router.post('/login', 
  authLimiter,
  validateLogin,
  (req, res, next) => {
    console.log('Login attempt:', {
      body: req.body,
      headers: req.headers,
      cookies: req.cookies
    });
    next();
  },
  authController.login
);

// Refresh token route with rate limiting
router.post('/refresh',
  refreshLimiter,
  authController.refresh
);

// Logout route with validation
router.post('/logout',
  authController.logout
);

// User info route (protected)
router.get('/me',
  require('../middlewares/validateToken'),
  authController.me
);

// Password reset request
router.post('/reset-password',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
  ],
  validate,
  authController.requestPasswordReset
);

// Password reset confirmation
router.post('/reset-password/confirm',
  authLimiter,
  [
    body('token')
      .isString()
      .notEmpty()
      .withMessage('Reset token is required'),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
  ],
  validate,
  authController.confirmPasswordReset
);

// Debug route
if (process.env.NODE_ENV !== 'production') {
  router.get('/test', (req, res) => {
    res.json({ message: 'Auth routes working' });
  });
}

module.exports = router;