const express = require('express');
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const Team = require('../models/Team');
const { auth } = require('../middleware/auth');
const admin = require('../middleware/admin');
const validateObjectId = require('../middleware/validateObjectId');
const AppError = require('../errors/AppError');

const router = express.Router();

// ─── Bracket helper ───────────────────────────────────────────────────────────

/**
 * Builds a single-elimination bracket and persists Round 1 Match documents.
 * Teams are shuffled randomly. Odd-sized fields are padded to the next power of 2
 * with null byes — bye slots are skipped (no Match document created).
 */
const buildBracket = async (tournamentId, teams) => {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);

  const size        = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
  const totalRounds = Math.log2(size);

  while (shuffled.length < size) shuffled.push(null);

  const roundLabel = { 1: 'Final', 2: 'Semi Final', 4: 'Quarter Final' };
  const rounds     = [];
  let current      = shuffled;

  for (let r = 1; r <= totalRounds; r++) {
    const pairCount = current.length / 2;
    const name      = roundLabel[pairCount] || `Round of ${current.length}`;
    const matches   = [];

    for (let m = 0; m < pairCount; m++) {
      const teamA = current[m * 2];
      const teamB = current[m * 2 + 1];

      let matchDoc = null;
      if (r === 1 && teamA && teamB) {
        matchDoc = await Match.create({
          tournament: tournamentId,
          round: r,
          roundName: name,
          teamA: teamA._id,
          teamB: teamB._id,
          status: 'scheduled',
        });
      }

      matches.push({
        matchId: matchDoc?._id ?? null,
        teamA:   teamA?._id  ?? null,
        teamB:   teamB?._id  ?? null,
        winner:  null,
        status:  'pending',
      });
    }

    rounds.push({ roundNumber: r, name, matches });
    current = new Array(pairCount).fill(null); // next round slots are TBD
  }

  return rounds;
};


// Vanaf hier alle routes
// --------------------------------------------------------------------------------------------------------

/**
 * GET /api/tournaments
 * Public. Toont alle toernooien met optionele filters en paginatie.
 */
router.get('/', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      const valid = ['registration', 'ongoing', 'completed', 'cancelled'];
      if (!valid.includes(req.query.status)) {
        return next(new AppError('Invalid status filter', 400));
      }
      filter.status = req.query.status;
    }
    if (req.query.game) {
      filter.game = { $regex: req.query.game, $options: 'i' };
    }

    const [tournaments, total] = await Promise.all([
      Tournament.find(filter)
        .populate('admin', 'username')
        .populate('registeredTeams', 'name tag')
        .skip(skip).limit(limit).sort('-createdAt'),
      Tournament.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      results: tournaments.length,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      data: { tournaments },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tournaments
 * Admin only. Maakt een nieuw toernooi aan. Vereist name, game, settings.maxTeams en settings.startDate.
 */
router.post('/', auth, admin, async (req, res, next) => {
  try {
    const { name, game, format, settings } = req.body;

    if (!name || !game || !settings?.maxTeams || !settings?.startDate) {
      return next(new AppError('name, game, settings.maxTeams and settings.startDate are required', 400));
    }
    if (Number(settings.maxTeams) < 2) {
      return next(new AppError('maxTeams must be at least 2', 400));
    }
    if (isNaN(new Date(settings.startDate).getTime())) {
      return next(new AppError('startDate must be a valid date', 400));
    }

    const tournament = await Tournament.create({
      name:   String(name).trim(),
      game:   String(game).trim(),
      format: format || 'single_elimination',
      admin:  req.user._id,
      settings: {
        maxTeams:    Number(settings.maxTeams),
        prizePool:   settings.prizePool   ? String(settings.prizePool).trim()   : 'No prize',
        startDate:   new Date(settings.startDate),
        description: settings.description ? String(settings.description).trim() : '',
      },
    });

    await tournament.populate('admin', 'username');
    res.status(201).json({ status: 'success', data: { tournament } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tournaments/:id
 * Public. Geeft het toernooi terug.
 */
router.get('/:id', validateObjectId('id'), async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('admin', 'username')
      .populate('registeredTeams', 'name tag stats')
      .populate('champion', 'name tag')
      .populate('rounds.matches.teamA', 'name tag')
      .populate('rounds.matches.teamB', 'name tag')
      .populate('rounds.matches.winner', 'name tag');

    if (!tournament) return next(new AppError('Tournament not found', 404));

    res.status(200).json({ status: 'success', data: { tournament } });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/tournaments/:id
 * Admin only. Update van de toernooi details.
 */
router.put('/:id', auth, admin, validateObjectId('id'), async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return next(new AppError('Tournament not found', 404));

    const updates = {};

    // These fields are always safe to update
    if (typeof req.body.settings?.prizePool   === 'string') updates['settings.prizePool']   = req.body.settings.prizePool.trim();
    if (typeof req.body.settings?.description === 'string') updates['settings.description'] = req.body.settings.description.trim();

    // These fields are only editable during registration
    if (tournament.status === 'registration') {
      if (typeof req.body.name === 'string') updates.name = req.body.name.trim();
      if (typeof req.body.game === 'string') updates.game = req.body.game.trim();
      if (req.body.format)                   updates.format = req.body.format;
      if (req.body.settings?.maxTeams)       updates['settings.maxTeams'] = Number(req.body.settings.maxTeams);
      if (req.body.settings?.startDate) {
        const d = new Date(req.body.settings.startDate);
        if (isNaN(d.getTime())) return next(new AppError('Invalid startDate', 400));
        updates['settings.startDate'] = d;
      }
    }

    const updated = await Tournament.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true,
    }).populate('admin', 'username');

    res.status(200).json({ status: 'success', data: { tournament: updated } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/tournaments/:id
 * Admin only. Een toernooi kan niet verwijderd worden als het nog bezig is.
 */
router.delete('/:id', auth, admin, validateObjectId('id'), async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return next(new AppError('Tournament not found', 404));

    if (tournament.status === 'ongoing') {
      return next(new AppError('Cancel the tournament before deleting it', 400));
    }

    await Tournament.findByIdAndDelete(req.params.id);
    await Match.deleteMany({ tournament: req.params.id });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tournaments/:id/register
 * Protected. Team captain kan zijn team inschrijven voor een toernooi.
 */
router.post('/:id/register', auth, validateObjectId('id'), async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return next(new AppError('Tournament not found', 404));

    if (tournament.status !== 'registration') {
      return next(new AppError('This tournament is not open for registration', 400));
    }

    const { teamId } = req.body;
    if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
      return next(new AppError('A valid teamId is required', 400));
    }

    const team = await Team.findById(teamId);
    if (!team || !team.isActive) return next(new AppError('Team not found or inactive', 404));

    if (team.captain.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new AppError('Only the team captain can register the team', 403));
    }
    if (tournament.registeredTeams.some((t) => t.toString() === teamId)) {
      return next(new AppError('Team is already registered', 409));
    }
    if (tournament.registeredTeams.length >= tournament.settings.maxTeams) {
      return next(new AppError('Tournament is full', 400));
    }

    tournament.registeredTeams.push(teamId);
    await tournament.save();

    res.status(200).json({
      status: 'success',
      message: `"${team.name}" registered for "${tournament.name}"`,
      data: { registeredTeams: tournament.registeredTeams.length },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tournaments/:id/start
 * Admin only. Registraties sluiten en het toernooi-bracket genereren. Vereist minimaal 2 teams.
 */
router.post('/:id/start', auth, admin, validateObjectId('id'), async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id).populate('registeredTeams');
    if (!tournament) return next(new AppError('Tournament not found', 404));

    if (tournament.status !== 'registration') {
      return next(new AppError('Tournament is not in registration phase', 400));
    }
    if (tournament.registeredTeams.length < 2) {
      return next(new AppError('At least 2 teams are required to start', 400));
    }

    tournament.rounds = await buildBracket(tournament._id, tournament.registeredTeams);
    tournament.status = 'ongoing';
    await tournament.save();

    res.status(200).json({ status: 'success', data: { tournament } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;