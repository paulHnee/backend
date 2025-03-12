const jwt = require('jsonwebtoken');

// JWT SECRET MUST BE PROVIDED
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

// Function to generate a JWT
function generateToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// Function to verify a JWT
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return reject(new Error('Token has expired'));
        } else if (err.name === 'JsonWebTokenError') {
          return reject(new Error('Invalid token'));
        } else {
          return reject(new Error('Token verification failed'));
        }
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
