const express = require('express');
const router = express.Router();
const db = require('../config/database'); 
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../config/jwtConfig'); 

// Authanticate token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];                     // Bearer <token>

  if (token == null) {
    return res.sendStatus(401);                                            // Unauthorized
  }

  try {
    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.sendStatus(403);                                             // Forbidden
  }
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,                                                 // 15 minutes
  max: 100,                                                                 // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later."
});

router.use(limiter);                                                        // Apply rate limiting to all routes in this router

router.get('/vpn', authenticateToken, (req, res) => {
  console.log(`VPN accessed by user: ${req.user.username}`); 
  res.send(`Hello VPN!  Welcome, ${req.user.username}`);
});

// FUNCTION:
// Insert a new public key and device (username + Device)
// including the IP address.
// into the database, 
router.post('/public_key', [ 
  authenticateToken, 
  body('publickey').isString().notEmpty().trim().escape(), 
  body('Device').isString().notEmpty().trim().escape()      
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { publickey, Device } = req.body;
  const username = req.user.username;


// FOR TESTING PURPOSES ONLY
// Random IP address
//! comment out for production
/*  ########################################  */
  const ipAddress = Math.random().toString(36).substring(7); 
/*  ########################################  */


// CHECK INPUT VALIDITY //
/*  ########################################  */
  let allowed = true;
  if (publickey.length < 32 || publickey.isEmpty()) {
    allowed = false;
    return res.status(400).json({ error: 'Public key is too short' });      // 400 Bad Request
  }
  if (Device.length < 3 || Device.isEmpty()) {
    allowed = false;
    return res.status(400).json({ error: 'Device name is too short' });     // 400 Bad Request
  }
/*  ########################################  */      

try {
    if (!allowed) {
      return res.status(403).json({ error: 'Something went wrong' });       // 403 Forbidden      
    } else { 
      const result = await db.query(
        'INSERT INTO vpn (name, public_key, ip_address) VALUES (?, ?, ?)',  // Insert public key into database
        [username +"-"+ Device, publickey, ipAddress]
      );
    }

    console.log(`Public key added for user ${username}, device ${Device}`);
    res.status(201).json({ message: 'Public key added successfully' });     // 201 Success
  } catch (error) {
    console.error('Error adding public key:', error);
    res.status(500).json({ error: 'Failed to add public key' });            // 500 Internal Server Error
  }
});

// Should display all the devices a user has
router.get('/list', authenticateToken, async (req, res) => {
  const username = req.user.username;

  try {
    //  Fetch devices from database
    const devices = await db.query(
      'SELECT device FROM vpn WHERE name LIKE ?',
      [{username} + '-%']
    );

    res.json({ devices: devices.rows.map(row => row.device) });              // Send list of device names
  } catch (error) {
    console.error('Error fetching device list:', error);
    res.status(500).json({ error: 'Failed to fetch device list' });
  }
});

module.exports = router;