const { verifyToken } = require('../config/jwtConfig');

const validateToken = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    console.error('No token provided');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = await verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    
    // Clear invalid token
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    return res.status(401).json({ error: 'Session expired' });
  }
};

module.exports = validateToken;