const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const admin = require('../middleware/admin');
const validateObjectId = require('../middleware/validateObjectId');
const AppError = require('../errors/AppError');

const router = express.Router();

// Vanaf hier alle routes
// --------------------------------------------------------------------------------------------------------

/**
 * GET /api/users
 * Admin only. Geeft alle gebruikers terug.
 */
router.get('/', auth, admin, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().skip(skip).limit(limit).sort('-createdAt'),
      User.countDocuments(),
    ]);

    res.status(200).json({
      status: 'success',
      results: users.length,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      data: { users },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id
 * Protected. Geeft de gebruiker terug, maar alleen als het de eigen gebruiker is of een admin.
 */
router.get('/:id', auth, validateObjectId('id'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found', 404));

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/users/:id
 * Protected. Users kunnen alleen hun eigen profiel updaten, admins kunnen elk profiel updaten. 
 * Velden die niet geüpdatet mogen worden (password, role) worden genegeerd als ze in de request body staan.
 */
router.put('/:id', auth, validateObjectId('id'), async (req, res, next) => {
  try {
    const isOwnProfile = req.user._id.toString() === req.params.id;
    if (!isOwnProfile && req.user.role !== 'admin') {
      return next(new AppError('You do not have permission to update this profile', 403));
    }

    const { password, role, ...rest } = req.body;
    if (password) {
      return next(new AppError('Password changes are not supported via this endpoint', 400));
    }

    const allowedUpdates = {};
    if (typeof rest.username === 'string') allowedUpdates.username = rest.username.trim();
    if (typeof rest.email    === 'string') allowedUpdates.email    = rest.email.trim();

    const user = await User.findByIdAndUpdate(req.params.id, allowedUpdates, {
      new: true,
      runValidators: true,
    });
    if (!user) return next(new AppError('User not found', 404));

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return next(new AppError(`This ${field} is already taken.`, 409));
    }
    next(err);
  }
});

/**
 * DELETE /api/users/:id
 * Admin only.
 */
router.delete('/:id', auth, admin, validateObjectId('id'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return next(new AppError('User not found', 404));

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;