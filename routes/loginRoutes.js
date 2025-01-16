const express = require('express');
const bcrypt = require('bcrypt'); // For hashing passwords
const router = express.Router();
const db = require('../config/db');

// Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    // Query the database for the user
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = rows[0];

    // Compare the password (assuming it's hashed)
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Successful login
    return res.status(200).json({ message: 'Login successful!' });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
