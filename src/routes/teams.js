const express = require('express');
const Team = require('../models/Team');
const { auth } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const AppError = require('../errors/AppError');

const router = express.Router();

const MAX_TEAM_SIZE = 10;

const isCaptainOrAdmin = (team, user) =>
  team.captain.toString() === user._id.toString() || user.role === 'admin';

/**
 * GET /api/teams
 * Public. Geeft alle teams terug.
 */
router.get('/', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const [teams, total] = await Promise.all([
      Team.find({ isActive: true })
        .populate('captain', 'username')
        .populate('members.userId', 'username')
        .skip(skip)
        .limit(limit)
        .sort('-createdAt'),
      Team.countDocuments({ isActive: true }),
    ]);

    res.status(200).json({
      status: 'success',
      results: teams.length,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      data: { teams },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/teams
 * Protected. Maakt een team aan, de aanmaker wordt automatisch captain.
 */
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, tag, description } = req.body;

    if (!name || !tag || typeof name !== 'string' || typeof tag !== 'string') {
      return next(new AppError('Team name and tag are required', 400));
    }

    const existingCaptaincy = await Team.findOne({ captain: req.user._id, isActive: true });
    if (existingCaptaincy) {
      return next(new AppError('You are already captain of a team. Disband it first.', 409));
    }

    const team = await Team.create({
      name: name.trim(),
      tag: tag.trim().toUpperCase(),
      description: description ? String(description).trim() : '',
      captain: req.user._id,
      members: [{ userId: req.user._id, role: 'captain' }],
    });

    await team.populate('captain', 'username');
    res.status(201).json({ status: 'success', data: { team } });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return next(new AppError(`A team with this ${field} already exists.`, 409));
    }
    next(err);
  }
});

/**
 * GET /api/teams/:id
 * Public. Geeft het team terug inclusief captain en leden.
 */
router.get('/:id', validateObjectId('id'), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('captain', 'username email')
      .populate('members.userId', 'username stats');

    if (!team) return next(new AppError('Team not found', 404));

    res.status(200).json({ status: 'success', data: { team } });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/teams/:id
 * Protected. Captain of admin kan teamdetails updaten. Alleen admin kan naam en tag aanpassen.
 */
router.put('/:id', auth, validateObjectId('id'), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return next(new AppError('Team not found', 404));

    if (!isCaptainOrAdmin(team, req.user)) {
      return next(new AppError('Only the team captain or an admin can update team details', 403));
    }

    const updates = {};
    if (typeof req.body.description === 'string') updates.description = req.body.description.trim();
    if (req.user.role === 'admin') {
      if (typeof req.body.name === 'string') updates.name = req.body.name.trim();
      if (typeof req.body.tag  === 'string') updates.tag  = req.body.tag.trim().toUpperCase();
    }

    const updated = await Team.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true,
    })
      .populate('captain', 'username')
      .populate('members.userId', 'username');

    res.status(200).json({ status: 'success', data: { team: updated } });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return next(new AppError(`A team with this ${field} already exists.`, 409));
    }
    next(err);
  }
});

/**
 * DELETE /api/teams/:id
 * Protected. Captain of admin delete het team (soft delete via isActive flag).
 */
router.delete('/:id', auth, validateObjectId('id'), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return next(new AppError('Team not found', 404));

    if (!isCaptainOrAdmin(team, req.user)) {
      return next(new AppError('Only the team captain or an admin can disband this team', 403));
    }

    team.isActive = false;
    await team.save();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/teams/:id/join
 * Protected. Geauthenticeerde gebruiker voegt zich bij het team.
 */
router.post('/:id/join', auth, validateObjectId('id'), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team)            return next(new AppError('Team not found', 404));
    if (!team.isActive)   return next(new AppError('This team is no longer active', 400));

    const alreadyMember = team.members.some(
      (m) => m.userId.toString() === req.user._id.toString()
    );
    if (alreadyMember) return next(new AppError('You are already a member of this team', 409));

    if (team.members.length >= MAX_TEAM_SIZE) {
      return next(new AppError(`Team is full (max ${MAX_TEAM_SIZE} members)`, 400));
    }

    team.members.push({ userId: req.user._id, role: 'member' });
    await team.save();
    await team.populate('members.userId', 'username');

    res.status(200).json({ status: 'success', data: { team } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/teams/:id/leave
 * Protected. Geathenticeerde gebruiker verlaat het team. 
 * Captains kunnen niet leaveen, zij moeten het team disbanden.
 */
router.delete('/:id/leave', auth, validateObjectId('id'), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return next(new AppError('Team not found', 404));

    if (team.captain.toString() === req.user._id.toString()) {
      return next(new AppError('Captain cannot leave. Disband the team instead.', 400));
    }

    const idx = team.members.findIndex(
      (m) => m.userId.toString() === req.user._id.toString()
    );
    if (idx === -1) return next(new AppError('You are not a member of this team', 404));

    team.members.splice(idx, 1);
    await team.save();

    res.status(200).json({ status: 'success', message: 'Successfully left the team' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;