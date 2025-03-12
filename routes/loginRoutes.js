require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { generateToken } = require('../config/jwtConfig');
const db = require('../config/database');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

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
    // Check if the user exists
    const [rows] = await db.query('SELECT user_id, username, password FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if the password is correct
    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Include the user ID
    const payload = {
      userId: user.user_id,
      username: user.username,
      // Add other relevant user data (roles, permissions, etc.)
    };

    const token = generateToken(payload); // Generate token

    // Set token in HttpOnly cookie
    res.cookie('token', token, { httpOnly: true, secure: true });

    res.json({ message: 'Login successful!' });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;