class TokenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenError';
    this.statusCode = 401;
  }
}

module.exports = TokenError;