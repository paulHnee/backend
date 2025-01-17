const jwt = require('jsonwebtoken');

// Use environment variable for JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'NE'; // Default to 'NE' if no env var

// Function to generate a JWT
function generateToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// Function to verify a JWT
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return reject(new Error('Invalid or expired token'));
      }
      resolve(decoded);
    });
  });
}

// Function to blacklist a token (example implementation)
const blacklistedTokens = new Set();

function blacklistToken(token) {
  blacklistedTokens.add(token);
}

function isTokenBlacklisted(token) {
  return blacklistedTokens.has(token);
}

module.exports = { generateToken, verifyToken, blacklistToken, isTokenBlacklisted };
