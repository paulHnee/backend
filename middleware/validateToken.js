const { verifyToken } = require('../config/jwtConfig');

const validateToken = async (req, res, next) => {
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

module.exports = validateToken;