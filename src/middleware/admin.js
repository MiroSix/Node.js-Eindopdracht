const AppError = require('../errors/AppError');

/**
 * Simpele middleware om te controleren of de gebruiker een admin is. 
 * Vereist dat de auth middleware al heeft gedraaid en req.user heeft gezet.
 */
const admin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }
  if (req.user.role !== 'admin') {
    return next(new AppError('Access denied. Admin privileges required.', 403));
  }
  next();
};

module.exports = admin;
