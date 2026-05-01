const mongoose = require('mongoose');
const AppError = require('../errors/AppError');

/**
 * Valideert dat opgegeven parameters geldige MongoDB ObjectId's zijn. 
 * Gebruik ik overal als middleware in routes waar ObjectId's worden verwacht.
 */
const validateObjectId = (...paramNames) => {
  return (req, res, next) => {
    for (const param of paramNames) {
      const id = req.params[param];
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new AppError(`Invalid ID format for parameter '${param}'.`, 400));
      }
    }
    next();
  };
};

module.exports = validateObjectId;
