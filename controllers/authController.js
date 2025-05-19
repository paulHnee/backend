
const jwt = require('jsonwebtoken');
const ldapAuth = require('../config/ldap');

exports.login = async (req, res) => {
  console.log('Login attempt received');
  const { username, password } = req.body;
  console.log('Received username:', username);
  // Be cautious logging passwords in production environments
  // For debugging, we'll log a masked version or just confirm it's received
  console.log('Received password (exists):', password ? 'Yes' : 'No');

  try {
    await new Promise((resolve, reject) => {
      ldapAuth.authenticate(username, password, (err, user) => {
        if (err) {
          console.error('LDAP authentication error for username:', username, 'Error:', err);
          return reject(err);
        }
        if (!user) {
          // This case might indicate user not found or password incorrect by some ldapauth libraries
          console.error('LDAP authentication failed for username:', username, 'User not found or invalid credentials.');
          return reject(new Error('Authentication failed: User not found or invalid credentials'));
        }
        console.log('LDAP authentication successful for username:', username, 'User details:', user);
        resolve(user); // Resolve with the user object
      });
    });
    
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });

    res.json({ token });
  } catch (error) {
    console.error('LDAP authentication processing failed for username:', username, 'Error:', error);
    res.status(401).json({ error: 'Authentication failed', details: error.message });
  }
};

exports.getDashboardData = (req, res) => {
  res.json({
    message: `Welcome, ${req.user.username}!`,
    status: 'success'
  });
};