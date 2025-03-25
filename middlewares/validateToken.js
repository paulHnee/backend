const { verifyToken } = require('../config/jwtConfig');

const validateToken = async (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    console.error('No auth token provided');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Verify the JWT token
    const decoded = await verifyToken(token);
    
    // Set user info from token payload in the request object
    req.user = decoded;
    
    // Continue to the next middleware/route handler
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    
    // Clear the invalid token
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    
    return res.status(401).json({ error: 'Session expired' });
  }
};

module.exports = validateToken;