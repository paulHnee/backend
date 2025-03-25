const bcrypt = require('bcrypt');
const { generateTokenPair } = require('../config/jwtConfig');
const db = require('../config/database');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check user credentials
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT payload with user information
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      name: user.display_name || user.username,
      iat: Math.floor(Date.now() / 1000)
    };

    // Generate tokens with the enhanced payload
    const { accessToken, refreshToken } = await generateTokenPair(payload);

    // Set access token in a httpOnly cookie
    res.cookie('auth_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Set refresh token in a separate httpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Return user info and non-sensitive token information
    const { password: _, refresh_token: __, ...userInfo } = user;
    res.json({ 
      user: userInfo,
      message: 'Login successful',
      // Include non-sensitive payload info for frontend use
      authInfo: {
        expiresAt: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
        username: payload.username,
        role: payload.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

exports.logout = async (req, res) => {
  try {
    // Clear cookies
    res.clearCookie('auth_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });

    // Clear refresh token from database if user is authenticated
    if (req.user?.id) {
      await db.query(
        'UPDATE users SET refresh_token = NULL WHERE id = ?',
        [req.user.id]
      );
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

exports.refresh = async (req, res) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }

  try {
    // Get user info from the refresh token
    const payload = req.user; // This comes from the middleware that validates the token

    // Create a new payload with updated timestamp
    const newPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000)
    };

    // Generate new token pair with updated payload
    const { accessToken, refreshToken: newRefreshToken } = await generateTokenPair(newPayload);

    // Update refresh token in database
    await db.query(
      'UPDATE users SET refresh_token = ? WHERE id = ?',
      [newRefreshToken, req.user.sub]
    );

    // Set new cookies with the updated tokens
    res.cookie('auth_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      message: 'Token refreshed successfully',
      // Include non-sensitive payload info for frontend use
      authInfo: {
        expiresAt: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
        username: newPayload.username,
        role: newPayload.role
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

exports.me = async (req, res) => {
  try {
    // req.user is set by validateToken middleware
    if (!req.user || !req.user.sub) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch the latest user data from database
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.sub]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove sensitive information
    const { password, refresh_token, ...userInfo } = rows[0];
    
    res.json(userInfo);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
};