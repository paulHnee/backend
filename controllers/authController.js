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

    // Generate tokens
    const { accessToken, refreshToken, cookieOptions } = await generateTokenPair({
      sub: user.id, // JWT subject
      username: user.username,
      role: user.role
    });

    // Store refresh token in database
    await db.query(
      'UPDATE users SET refresh_token = ? WHERE id = ?',
      [refreshToken, user.id]
    );

    // Set cookies
    res.cookie('token', accessToken, cookieOptions.access);
    res.cookie('refreshToken', refreshToken, cookieOptions.refresh);

    // Return user info (exclude sensitive data)
    const { password: _, refresh_token: __, ...userInfo } = user;
    res.json({ 
      user: userInfo,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

exports.logout = async (req, res) => {
  try {
    // Clear cookies
    res.clearCookie('token', { path: '/' });
    res.clearCookie('refreshToken', { path: '/auth/refresh' });

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
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }

  try {
    // Verify refresh token and generate new token pair
    const { accessToken, refreshToken: newRefreshToken, cookieOptions } = 
      await generateTokenPair(req.user);

    // Update refresh token in database
    await db.query(
      'UPDATE users SET refresh_token = ? WHERE id = ?',
      [newRefreshToken, req.user.id]
    );

    // Set new cookies
    res.cookie('token', accessToken, cookieOptions.access);
    res.cookie('refreshToken', newRefreshToken, cookieOptions.refresh);

    res.json({ message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};