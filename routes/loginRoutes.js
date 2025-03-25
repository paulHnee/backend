require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { generateTokenPair, verifyToken, revokeToken } = require('../config/jwtConfig');
const db = require('../config/database');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const validateToken = require('../middlewares/validateToken');
const TokenError = require('../errors/TokenError');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later."
});
router.use(limiter);

// Login route
router.post('/login', [
  body('username').isString().notEmpty().trim().escape(),
  body('password').isString().notEmpty().trim() // Do NOT escape passwords
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    // Check user credentials
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken, cookieOptions } = await generateTokenPair({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    // Store refresh token in database
    await db.query('UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, user.id]);

    // Set cookies
    res.cookie('token', accessToken, cookieOptions.access);
    res.cookie('refreshToken', refreshToken, cookieOptions.refresh);

    // Return user info (exclude sensitive data)
    const { password: _, refresh_token: __, ...userInfo } = user;
    res.json({ user: userInfo });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Refresh token route
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  try {
    if (!refreshToken) {
      throw new Error('No refresh token provided');
    }

    // Verify refresh token
    const decoded = await verifyToken(refreshToken, 'refreshToken');
    
    // Check if refresh token exists in database
    const [rows] = await db.query(
      'SELECT * FROM users WHERE id = ? AND refresh_token = ?',
      [decoded.userId, refreshToken]
    );

    if (rows.length === 0) {
      throw new Error('Invalid refresh token');
    }

    // Generate new token pair
    const { accessToken, refreshToken: newRefreshToken, cookieOptions } = 
      await generateTokenPair({
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role
      });

    // Update refresh token in database
    await db.query(
      'UPDATE users SET refresh_token = ? WHERE id = ?',
      [newRefreshToken, decoded.userId]
    );

    // Set new cookies
    res.cookie('token', accessToken, cookieOptions.access);
    res.cookie('refreshToken', newRefreshToken, cookieOptions.refresh);

    res.json({ message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    // Clear cookies on error
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    
    res.status(401).json({ error: 'Session expired' });
  }
});

// Logout route
router.post('/logout', validateToken, async (req, res) => {
  try {
    // Clear refresh token in database
    await db.query('UPDATE users SET refresh_token = NULL WHERE user_id = ?', [req.user.userId]);

    // Clear cookies
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Failed to logout' });
  }
});

// Get current user info
router.get('/me', validateToken, (req, res) => {
  try {
    const { userId, username } = req.user;
    res.json({ userId, username });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ message: 'Failed to fetch user info' });
  }
});
module.exports = router;