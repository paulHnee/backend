const debug = require('debug')('app:request');

const requestDebug = (req, res, next) => {
  debug(`${req.method} ${req.url}`);
  debug('Headers:', req.headers);
  debug('Body:', req.body);
  debug('Cookies:', req.cookies);
  next();
};

module.exports = requestDebug;