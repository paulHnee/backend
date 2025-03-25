const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const TokenError = require('../errors/TokenError');

// Validate environment variables
const requiredEnvVars = ['JWT_SECRET', 'REFRESH_SECRET'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`${varName} environment variable is required`);
  }
});

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

// Token configuration
const config = {
  accessToken: {
    expiresIn: '15m',
    algorithm: 'HS512'
  },
  refreshToken: {
    expiresIn: '7d',
    algorithm: 'HS512'
  }
};

class TokenManager {
  static revokedTokens = new Map();

  static async generateToken(payload, type = 'accessToken') {
    try {
      const jti = crypto.randomBytes(32).toString('hex');
      const tokenConfig = config[type];

      const token = jwt.sign(
        {
          ...payload,
          jti,
          type
        },
        type === 'accessToken' ? JWT_SECRET : REFRESH_SECRET,
        {
          expiresIn: tokenConfig.expiresIn,
          algorithm: tokenConfig.algorithm,
          audience: process.env.JWT_AUDIENCE,
          issuer: process.env.JWT_ISSUER
        }
      );

      return token;
    } catch (error) {
      console.error('Token generation error:', error);
      throw new TokenError('Failed to generate token');
    }
  }

  static async verifyToken(token, type = 'accessToken') {
    try {
      const secret = type === 'accessToken' ? JWT_SECRET : REFRESH_SECRET;
      const decoded = jwt.verify(token, secret, {
        algorithms: [config[type].algorithm],
        audience: process.env.JWT_AUDIENCE,
        issuer: process.env.JWT_ISSUER
      });

      // Check if token is revoked
      if (this.revokedTokens.has(decoded.jti)) {
        throw new TokenError('Token has been revoked');
      }

      return decoded;
    } catch (error) {
      if (error instanceof TokenError) throw error;
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenError('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenError('Invalid token');
      }
      throw new TokenError('Token verification failed');
    }
  }

  static async revokeToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.jti) {
        throw new TokenError('Invalid token format');
      }

      // Store revoked token JTI with expiration
      this.revokedTokens.set(decoded.jti, Date.now());

      // Clean up expired revoked tokens every 100 operations
      if (this.revokedTokens.size % 100 === 0) {
        this.cleanupRevokedTokens();
      }

      return true;
    } catch (error) {
      console.error('Token revocation error:', error);
      throw new TokenError('Failed to revoke token');
    }
  }

  static cleanupRevokedTokens() {
    const now = Date.now();
    for (const [jti, timestamp] of this.revokedTokens.entries()) {
      // Remove tokens that are more than 24 hours old
      if (now - timestamp > 24 * 60 * 60 * 1000) {
        this.revokedTokens.delete(jti);
      }
    }
  }

  static async generateTokenPair(payload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateToken(payload, 'accessToken'),
      this.generateToken(payload, 'refreshToken')
    ]);

    return {
      accessToken,
      refreshToken,
      cookieOptions: {
        access: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000 // 15 minutes
        },
        refresh: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        }
      }
    };
  }

  static getTokenFromCookie(cookies) {
    return cookies.token || null;
  }

  static getRefreshTokenFromCookie(cookies) {
    return cookies.refreshToken || null;
  }
}

// Cleanup revoked tokens periodically (every hour)
setInterval(() => {
  TokenManager.cleanupRevokedTokens();
}, 60 * 60 * 1000);

module.exports = {
  generateTokenPair: TokenManager.generateTokenPair.bind(TokenManager),
  verifyToken: TokenManager.verifyToken.bind(TokenManager),
  revokeToken: TokenManager.revokeToken.bind(TokenManager)
};
