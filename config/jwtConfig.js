const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const TokenError = require('../errors/TokenError');
const db = require('../config/database');

// Environment validation
const requiredEnvVars = [
  'JWT_SECRET',
  'REFRESH_SECRET',
  'JWT_AUDIENCE',
  'JWT_ISSUER',
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`${varName} environment variable is required`);
  }
});

// Token configuration
const config = {
  accessToken: {
    expiresIn: '15m',
    algorithm: 'HS512'
  },
  refreshToken: {
    expiresIn: '7d',
    algorithm: 'HS512'
  },
  cookies: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    domain: process.env.COOKIE_DOMAIN,
    path: '/'
  }
};

class TokenManager {
  static async generateToken(payload, type = 'accessToken') {
    if (!['accessToken', 'refreshToken'].includes(type)) {
      throw new TokenError('Invalid token type', 'INVALID_TYPE');
    }

    try {
      const jti = crypto.randomBytes(32).toString('hex');
      const tokenConfig = config[type];
      const secret = type === 'accessToken' ? 
        process.env.JWT_SECRET : 
        process.env.REFRESH_SECRET;

      const token = jwt.sign(
        {
          ...payload,
          jti,
          type,
          iat: Math.floor(Date.now() / 1000)
        },
        secret,
        {
          expiresIn: tokenConfig.expiresIn,
          algorithm: tokenConfig.algorithm,
          audience: process.env.JWT_AUDIENCE,
          issuer: process.env.JWT_ISSUER
        }
      );

      // Store token metadata
      await db.query(
        'INSERT INTO token_metadata (jti, user_id, type, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))',
        [jti, payload.sub, type, type === 'accessToken' ? 900 : 604800]
      );

      return { token, jti };
    } catch (error) {
      console.error('Token generation error:', error);
      throw new TokenError('Failed to generate token', 'GENERATION_FAILED');
    }
  }

  static async verifyToken(token, type = 'accessToken') {
    if (!token || typeof token !== 'string') {
      throw new TokenError('Invalid token provided', 'INVALID_TOKEN');
    }

    try {
      const secret = type === 'accessToken' ? 
        process.env.JWT_SECRET : 
        process.env.REFRESH_SECRET;

      const decoded = jwt.verify(token, secret, {
        algorithms: [config[type].algorithm],
        audience: process.env.JWT_AUDIENCE,
        issuer: process.env.JWT_ISSUER
      });

      // Check token blacklist
      const [blacklisted] = await db.query(
        'SELECT 1 FROM token_blacklist WHERE jti = ? AND expires_at > NOW()',
        [decoded.jti]
      );

      if (blacklisted.length > 0) {
        throw new TokenError('Token has been revoked', 'TOKEN_REVOKED');
      }

      // Verify token metadata
      const [metadata] = await db.query(
        'SELECT 1 FROM token_metadata WHERE jti = ? AND type = ? AND expires_at > NOW()',
        [decoded.jti, type]
      );

      if (metadata.length === 0) {
        throw new TokenError('Token metadata not found', 'INVALID_TOKEN');
      }

      return decoded;
    } catch (error) {
      if (error instanceof TokenError) throw error;
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenError('Token has expired', 'TOKEN_EXPIRED');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenError('Invalid token', 'INVALID_TOKEN');
      }
      throw new TokenError('Token verification failed', 'VERIFICATION_FAILED');
    }
  }

  static async revokeToken(token, userId) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.jti) {
        throw new TokenError('Invalid token format', 'INVALID_FORMAT');
      }

      const expirationDate = new Date(decoded.exp * 1000);
      
      await db.query(
        'INSERT INTO token_blacklist (jti, user_id, type, expires_at) VALUES (?, ?, ?, ?)',
        [decoded.jti, userId, decoded.type, expirationDate]
      );

      // Delete token metadata
      await db.query(
        'DELETE FROM token_metadata WHERE jti = ?',
        [decoded.jti]
      );

      return true;
    } catch (error) {
      console.error('Token revocation error:', error);
      throw new TokenError('Failed to revoke token', 'REVOCATION_FAILED');
    }
  }

  static async generateTokenPair(payload) {
    const { token: accessToken, jti: accessJti } = await this.generateToken(payload, 'accessToken');
    const { token: refreshToken, jti: refreshJti } = await this.generateToken(payload, 'refreshToken');

    const cookieOptions = {
      access: {
        ...config.cookies,
        httpOnly: true,
        maxAge: 15 * 60 * 1000 // 15 minutes
      },
      refresh: {
        ...config.cookies,
        httpOnly: true,
        path: '/api/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      }
    };

    return {
      accessToken,
      refreshToken,
      cookieOptions,
      tokenData: { accessJti, refreshJti }
    };
  }

  static async cleanup() {
    try {
      // Clean expired blacklist entries
      await db.query('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
      // Clean expired metadata
      await db.query('DELETE FROM token_metadata WHERE expires_at <= NOW()');
    } catch (error) {
      console.error('Token cleanup error:', error);
    }
  }
}

// Schedule cleanup
setInterval(() => TokenManager.cleanup(), 3600000); // Run every hour

module.exports = {
  generateTokenPair: TokenManager.generateTokenPair.bind(TokenManager),
  verifyToken: TokenManager.verifyToken.bind(TokenManager),
  revokeToken: TokenManager.revokeToken.bind(TokenManager),
  config
};
