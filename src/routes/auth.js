const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const AppError = require('../errors/AppError');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({ status: 'success', token, data: { user } });
};

const validateRegisterInput = (body) => {
  const { username, email, password } = body;
  if (!username || !email || !password) {
    return 'Username, email, and password are required';
  }
  if (typeof username !== 'string' || username.trim().length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  return null;
};


// Vanaf hier alle routes
// --------------------------------------------------------------------------------------------------------


/**
 * POST /api/auth/register
 * Public. Maakt een nieuwe User aan.
 */
router.post('/register', async (req, res, next) => {
  try {
    const validationError = validateRegisterInput(req.body);
    if (validationError) {
      return next(new AppError(validationError, 400));
    }

    const { username, email, password } = req.body;

    const user = await User.create({ username: username.trim(), email, password });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    // Dit is de error code voor duplicate key error in MongoDB, 
    // wat betekent dat er al een gebruiker is met dezelfde email of username.
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return next(new AppError(`This ${field} is already taken.`, 409));
    }
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Public. Stuurt een JWT terug als de inloggegevens correct zijn.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Email and password are required', 400));
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return next(new AppError('Invalid input', 400));
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password', 401));
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Protected. Stuurt de gegevens van de ingelogde gebruiker terug. 
 * (Voor nu alleen username en email, geen gevoelige info)
 */
router.get('/me', auth, (req, res) => {
  res.status(200).json({ status: 'success', data: { user: req.user } });
});

module.exports = router;
