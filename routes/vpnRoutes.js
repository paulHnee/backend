const express = require('express');
const router = express.Router();
const db = require('../config/database'); 
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../config/jwtConfig'); 

// Authenticate token
const authenticateToken = async (req, res, next) => {
  const token = req.cookies.token; // Read token from cookie

  if (!token) {
    console.error('No token provided');
    return res.status(401).json({ error: 'No token provided' }); // Unauthorized
  }

  try {
    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(403).json({ error: 'Invalid token' }); // Forbidden
  }
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later."
});

router.use(limiter); // Apply rate limiting to all routes in this router

router.get('/vpn', authenticateToken, (req, res) => {
  console.log(`VPN accessed by user: ${req.user.username}`); 
  res.send(`Hello VPN!  Welcome, ${req.user.username}`);
});

// Insert a new public key and device (username + Device)
// including the IP address.
// into the database
router.post('/public_key', [ 
  authenticateToken, 
  body('publickey').isString().notEmpty().trim().escape(), 
  body('device').isString().notEmpty().trim().escape()      
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { publickey, device } = req.body;
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
  if (publickey.length < 32 || !publickey) {
    allowed = false;
    return res.status(400).json({ error: 'Public key is too short' }); // 400 Bad Request
  }
  if (device.length < 3 || !device) {
    allowed = false;
    return res.status(400).json({ error: 'Device name is too short' }); // 400 Bad Request
  }

  try {
    if (!allowed) {
      return res.status(403).json({ error: 'Something went wrong' }); // 403 Forbidden      
    } else { 
      const result = await db.query(
        'INSERT INTO vpn (device_name, public_key, ip_address) VALUES (?, ?, ?)', // Insert public key into database
        [username +"-"+ device, publickey, ipAddress]
      );
    }

    console.log(`Public key added for user ${username}, device ${device}`);
    res.status(201).json({ message: 'Public key added successfully' }); // 201 Success
  } catch (error) {
    console.error('Error adding public key:', error);
    res.status(500).json({ error: 'Failed to add public key' }); // 500 Internal Server Error
  }
});

// Delete a VPN entry
router.delete('/vpn/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM vpn WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'VPN entry not found' }); // 404 Not Found
    }

    res.status(200).json({ message: 'VPN entry deleted successfully' }); // 200 Success
  } catch (error) {
    console.error('Error deleting VPN entry:', error);
    res.status(500).json({ error: 'Failed to delete VPN entry' }); // 500 Internal Server Error
  }
});

// Fetch VPN list
router.get('/list', authenticateToken, async (req, res) => {
  const username = req.user.username;

  try {
    // Fetch devices from database
    const devices = await db.query(
      'SELECT device_name FROM vpn WHERE device_name LIKE ?',
      [`${username}-%`]
    );

    res.json({ devices: devices.rows.map(row => row.device_name) }); // Send list of device names
  } catch (error) {
    console.error('Error fetching device list:', error);
    res.status(500).json({ error: 'Failed to fetch device list' });
  }
});

// Get VPN configuration
router.get('/vpn-configuration', authenticateToken, async (req, res) => {
  try {
    // Fetch VPN configuration from database or configuration file
    const dbIpAddress = await db.query('SELECT ip_address FROM vpn WHERE user_id = ?', [req.user.userId]);
    const dbDeviceName = await db.query('SELECT device_name FROM vpn WHERE user_id = ?', [req.user.userId]);
    const vpnConfig = `VPN configuration\n IP Address: ${dbIpAddress[0].ip_address} \n Device Name: ${dbDeviceName[0].device_name}`;

    if (!dbIpAddress.length || !dbDeviceName.length) {
      return res.status(404).json({ error: 'VPN configuration not found' }); // 404 Not Found
    }

    res.json({ vpnConfig }); // Send VPN configuration
  } catch (error) {
    console.error('Error fetching VPN configuration:', error);
    res.status(500).json({ error: 'Failed to fetch VPN configuration, please contact the IT-Support' }); // 500 Internal Server Error
  }
});

// Refresh VPN list
router.get('/refresh', authenticateToken, async (req, res) => {
  try {
    // Logic to refresh VPN list
    const refreshedList = await db.query('SELECT * FROM vpn WHERE user_id = ?', [req.user.userId]);

    res.json(refreshedList); // Send refreshed VPN list
  } catch (error) {
    console.error('Error refreshing VPN list:', error);
    res.status(500).json({ error: 'Error fetching VPN list' }); // 500 Internal Server Error
  }
});

module.exports = router;