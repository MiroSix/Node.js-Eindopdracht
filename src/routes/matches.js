const express = require('express');
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const AppError = require('../errors/AppError');
const admin = require('../middleware/admin');
const validateObjectId = require('../middleware/validateObjectId');
const { auth } = require('../middleware/auth');

const router = express.Router();

const advanceBracket = async (tournament, match) => {
  const currentRoundIdx = tournament.rounds.findIndex(
    (r) => r.roundNumber === match.round
  );
  if (currentRoundIdx === -1) return;

  const currentRound = tournament.rounds[currentRoundIdx];
  const matchIdx = currentRound.matches.findIndex(
    (m) => m.matchId && m.matchId.toString() === match._id.toString()
  );

  currentRound.matches[matchIdx].winner = match.winner;
  currentRound.matches[matchIdx].status = 'completed';

  const nextRound = tournament.rounds[currentRoundIdx + 1];
  if (!nextRound) {
    // Geen volgende ronde, toernooi is klaar
    tournament.champion = match.winner;
    tournament.status = 'completed';

    // Winnend team zijn stats updaten
    await Team.findByIdAndUpdate(match.winner, { $inc: { 'stats.wins': 1, 'stats.tournamentsPlayed': 1 } });
    const loser = match.teamA.toString() === match.winner.toString() ? match.teamB : match.teamA;
    await Team.findByIdAndUpdate(loser, { $inc: { 'stats.losses': 1, 'stats.tournamentsPlayed': 1 } });
  } else {
    // Winner naar volgende ronde plaatsen
    const nextMatchIdx = Math.floor(matchIdx / 2);
    const slotIsA = matchIdx % 2 === 0;

    if (slotIsA) {
      nextRound.matches[nextMatchIdx].teamA = match.winner;
    } else {
      nextRound.matches[nextMatchIdx].teamB = match.winner;
    }

    const nextMatchSlot = nextRound.matches[nextMatchIdx];
    if (nextMatchSlot.teamA && nextMatchSlot.teamB) {
      const newMatch = await Match.create({
        tournament: tournament._id,
        round: nextRound.roundNumber,
        roundName: nextRound.name,
        teamA: nextMatchSlot.teamA,
        teamB: nextMatchSlot.teamB,
        status: 'scheduled',
      });
      nextMatchSlot.matchId = newMatch._id;
    }

    // Stats updaten voor beide teams
    await Team.findByIdAndUpdate(match.winner, { $inc: { 'stats.wins': 1, 'stats.matchesPlayed': 1 } });
    const loser = match.teamA.toString() === match.winner.toString() ? match.teamB : match.teamA;
    await Team.findByIdAndUpdate(loser, { $inc: { 'stats.losses': 1, 'stats.matchesPlayed': 1 } });
  }

  tournament.markModified('rounds');
  await tournament.save();
};


// Vanaf hier alle routes
// --------------------------------------------------------------------------------------------------------

/**
 * GET /api/matches
 * Public. Geeft matches terug met optionele filters: tournamentId, teamId, status, pagination (page & limit).
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.tournamentId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.tournamentId)) {
        return next(new AppError('Invalid tournamentId format', 400));
      }
      filter.tournament = req.query.tournamentId;
    }

    if (req.query.teamId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.teamId)) {
        return next(new AppError('Invalid teamId format', 400));
      }
      filter.$or = [{ teamA: req.query.teamId }, { teamB: req.query.teamId }];
    }

    if (req.query.status) {
      const validStatuses = ['scheduled', 'ongoing', 'completed', 'forfeit'];
      if (!validStatuses.includes(req.query.status)) {
        return next(new AppError('Invalid status filter', 400));
      }
      filter.status = req.query.status;
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      Match.find(filter)
        .populate('tournament', 'name game')
        .populate('teamA', 'name tag')
        .populate('teamB', 'name tag')
        .populate('winner', 'name tag')
        .skip(skip)
        .limit(limit)
        .sort('round createdAt'),
      Match.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      results: matches.length,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      data: { matches },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/matches/:id
 * Public. Geeft match terug op basis van zijn ID.
 */
router.get('/:id', validateObjectId('id'), async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('tournament', 'name game format')
      .populate('teamA', 'name tag members')
      .populate('teamB', 'name tag members')
      .populate('winner', 'name tag')
      .populate('events.team', 'name tag');

    if (!match) return next(new AppError('Match not found', 404));

    res.status(200).json({ status: 'success', data: { match } });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/matches/:id/result
 * Admin only. Registreert het resultaat van een match en werkt het toernooi-bracket bij indien nodig.
 */

router.put('/:id/result', auth, admin, validateObjectId('id'), async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return next(new AppError('Match not found', 404));

    if (match.status === 'completed') {
      return next(new AppError('Match result has already been recorded', 400));
    }

    const { teamAScore, teamBScore, winnerId, notes } = req.body;

    if (teamAScore === undefined || teamBScore === undefined) {
      return next(new AppError('teamAScore and teamBScore are required', 400));
    }
    if (!Number.isInteger(Number(teamAScore)) || !Number.isInteger(Number(teamBScore))) {
      return next(new AppError('Scores must be integers', 400));
    }
    if (Number(teamAScore) < 0 || Number(teamBScore) < 0) {
      return next(new AppError('Scores cannot be negative', 400));
    }
    if (!winnerId) {
      return next(new AppError('winnerId is required', 400));
    }
    if (!mongoose.Types.ObjectId.isValid(winnerId)) {
      return next(new AppError('Invalid winnerId format', 400));
    }

    const winnerIdStr = String(winnerId);
    const isValidWinner =
      match.teamA.toString() === winnerIdStr || match.teamB.toString() === winnerIdStr;
    if (!isValidWinner) {
      return next(new AppError('Winner must be one of the two teams in this match', 400));
    }

    match.scores.teamAScore = Number(teamAScore);
    match.scores.teamBScore = Number(teamBScore);
    match.winner = winnerId;
    match.status = 'completed';
    match.completedAt = new Date();
    if (notes && typeof notes === 'string') match.notes = notes.trim();

    await match.save();

    // Bracket updaten als toernooi nog bezig is
    const tournament = await Tournament.findById(match.tournament);
    if (tournament && tournament.status === 'ongoing') {
      await advanceBracket(tournament, match);
    }

    await match.populate([
      { path: 'teamA', select: 'name tag' },
      { path: 'teamB', select: 'name tag' },
      { path: 'winner', select: 'name tag' },
    ]);

    res.status(200).json({ status: 'success', data: { match } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/matches/:id/events
 * Admin only. Voeg een event toe aan een match. Match moet nog niet voltooid zijn.
 */
router.post('/:id/events', auth, admin, validateObjectId('id'), async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return next(new AppError('Match not found', 404));

    if (match.status === 'completed' || match.status === 'forfeit') {
      return next(new AppError('Cannot add events to a finished match', 400));
    }

    const { type, teamId, description } = req.body;

    const validTypes = ['kill', 'objective', 'round_win', 'penalty', 'custom'];
    if (!type || !validTypes.includes(type)) {
      return next(new AppError(`Event type must be one of: ${validTypes.join(', ')}`, 400));
    }
    if (!teamId) {
      return next(new AppError('teamId is required', 400));
    }
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return next(new AppError('Invalid teamId format', 400));
    }

    const teamIdStr = String(teamId);
    if (match.teamA.toString() !== teamIdStr && match.teamB.toString() !== teamIdStr) {
      return next(new AppError('Team must be a participant in this match', 400));
    }

    match.events.push({
      type,
      team: teamId,
      description: description ? String(description).trim() : '',
      timestamp: new Date(),
    });

    if (match.status === 'scheduled') {
      match.status = 'ongoing';
      match.startedAt = new Date();
    }

    await match.save();
    await match.populate('events.team', 'name tag');

    res.status(201).json({
      status: 'success',
      data: { events: match.events },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/matches/:id/forfeit
 * Admin only. Dient om forfeits te registreren.
 */
router.patch('/:id/forfeit', auth, admin, validateObjectId('id'), async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return next(new AppError('Match not found', 404));

    if (match.status === 'completed' || match.status === 'forfeit') {
      return next(new AppError('Match is already finished', 400));
    }

    const { forfeitingTeamId } = req.body;
    if (!forfeitingTeamId || !mongoose.Types.ObjectId.isValid(forfeitingTeamId)) {
      return next(new AppError('Valid forfeitingTeamId is required', 400));
    }

    const forfeitStr = String(forfeitingTeamId);
    if (match.teamA.toString() !== forfeitStr && match.teamB.toString() !== forfeitStr) {
      return next(new AppError('Forfeiting team must be a participant in this match', 400));
    }

    const winner =
      match.teamA.toString() === forfeitStr ? match.teamB : match.teamA;

    match.winner = winner;
    match.status = 'forfeit';
    match.completedAt = new Date();
    match.notes = `Forfeit by team ${forfeitingTeamId}`;

    await match.save();

    const tournament = await Tournament.findById(match.tournament);
    if (tournament && tournament.status === 'ongoing') {
      await advanceBracket(tournament, match);
    }

    res.status(200).json({ status: 'success', data: { match } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
