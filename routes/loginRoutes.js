require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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
    const [rows] = await db.query('SELECT id, username, password FROM users WHERE username = ?', [username]);

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
      userId: user.id,
      username: user.username,
      // Add other relevant user data (roles, permissions, etc.)
    };

    const token = generateToken(payload); // Generate token
    res.json({ message: 'Login successful!', token });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Protected route
router.get('/protected', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; // Extract the token

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Access the username from the decoded token
    const username = decoded.username;
    const userId = decoded.userId;

    res.json({
      message: 'Protected route accessed',
      user: {
        userId: userId,
        username: username,
      },
    });
  } catch (error) {
    console.error('Error during protected route access:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
});

module.exports = router;