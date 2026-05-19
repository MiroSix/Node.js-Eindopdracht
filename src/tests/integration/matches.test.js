// tests/integration/matches.test.js
// Integratietests voor /api/matches — mongoose-methoden worden gemockt
'use strict';

process.env.NODE_ENV   = 'test';
process.env.JWT_SECRET = 'integratietest-geheim';

const { describe, it, beforeEach, mock } = require('node:test');
const assert   = require('node:assert/strict');
const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const mongoose = require('mongoose');

mongoose.connect    = async () => {};
mongoose.disconnect = async () => {};

const User       = require('../../models/User');
const Match      = require('../../models/Match');
const Tournament = require('../../models/Tournament');
const app        = require('../../app');

// ─── Hulpdata ─────────────────────────────────────────────────────────────────

const adminId  = new mongoose.Types.ObjectId();
const teamAId  = new mongoose.Types.ObjectId();
const teamBId  = new mongoose.Types.ObjectId();
const matchId  = new mongoose.Types.ObjectId();
const tournId  = new mongoose.Types.ObjectId();

const fakeAdmin = {
  _id: adminId, username: 'admin1', email: 'admin@vives.be', role: 'admin',
  toJSON() { return { ...this }; },
};
const fakeUser = {
  _id: new mongoose.Types.ObjectId(), username: 'speler1', email: 'sp@vives.be', role: 'user',
  toJSON() { return { ...this }; },
};

const makeMatch = (overrides = {}) => ({
  _id:        matchId,
  tournament: tournId,
  round:      1,
  roundName:  'Semi Final',
  teamA:      teamAId,
  teamB:      teamBId,
  scores:     { teamAScore: 0, teamBScore: 0 },
  events:     [],
  status:     'scheduled',
  winner:     null,
  notes:      '',
  save:       async function () { return this; },
  populate:   async function () { return this; },
  toJSON()    { return { ...this }; },
  ...overrides,
});

const tokenFor = (user) => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET);

// ─── GET /api/matches ─────────────────────────────────────────────────────────

describe('GET /api/matches', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('retourneert een lijst van matches', async () => {
    const chain = {
      populate: function () { return this; },
      skip:     function () { return this; },
      limit:    function () { return this; },
      sort:     async function () { return [makeMatch()]; },
    };
    mock.method(Match, 'find',           () => chain);
    mock.method(Match, 'countDocuments', async () => 1);

    const res = await request(app).get('/api/matches');

    assert.equal(res.status, 200);
    assert.equal(res.body.data.matches.length, 1);
    assert.ok(res.body.pagination);
  });

  it('geeft 400 bij een ongeldige tournamentId in query', async () => {
    const res = await request(app).get('/api/matches?tournamentId=GEEN_GELDIG_ID');
    assert.equal(res.status, 400);
  });

  it('geeft 400 bij een ongeldige status filter', async () => {
    const res = await request(app).get('/api/matches?status=onbekend');
    assert.equal(res.status, 400);
  });
});

// ─── GET /api/matches/:id ─────────────────────────────────────────────────────

describe('GET /api/matches/:id', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('retourneert de match bij een geldig ID', async () => {
    let calls = 0;
    mock.method(Match, 'findById', () => ({
      populate: function () { calls++; return calls >= 5 ? Promise.resolve(makeMatch()) : this; },
    }));

    const res = await request(app).get(`/api/matches/${matchId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.match._id.toString(), matchId.toString());
  });

  it('geeft 400 bij ongeldig ObjectId', async () => {
    const res = await request(app).get('/api/matches/GEEN_GELDIG_ID');
    assert.equal(res.status, 400);
  });

  it('geeft 404 als de match niet bestaat', async () => {
    let calls = 0;
    mock.method(Match, 'findById', () => ({
      populate: function () { calls++; return calls >= 5 ? Promise.resolve(null) : this; },
    }));

    const res = await request(app).get(`/api/matches/${new mongoose.Types.ObjectId()}`);
    assert.equal(res.status, 404);
  });
});

// ─── PUT /api/matches/:id/result ──────────────────────────────────────────────

describe('PUT /api/matches/:id/result', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('admin registreert het resultaat van een match (200)', async () => {
    mock.method(User,       'findById', async () => fakeAdmin);
    mock.method(Match,      'findById', async () => makeMatch());
    mock.method(Tournament, 'findById', async () => ({ status: 'completed', save: async () => {} }));

    const res = await request(app)
      .put(`/api/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`)
      .send({ teamAScore: 2, teamBScore: 1, winnerId: teamAId.toString() });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.match.status, 'completed');
  });

  it('geeft 400 als scores ontbreken', async () => {
    mock.method(User,  'findById', async () => fakeAdmin);
    mock.method(Match, 'findById', async () => makeMatch());

    const res = await request(app)
      .put(`/api/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`)
      .send({ winnerId: teamAId.toString() });

    assert.equal(res.status, 400);
  });

  it('geeft 400 als de match al voltooid is', async () => {
    mock.method(User,  'findById', async () => fakeAdmin);
    mock.method(Match, 'findById', async () => makeMatch({ status: 'completed' }));

    const res = await request(app)
      .put(`/api/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`)
      .send({ teamAScore: 1, teamBScore: 0, winnerId: teamAId.toString() });

    assert.equal(res.status, 400);
  });

  it('geeft 403 als een gewone gebruiker een resultaat probeert in te stellen', async () => {
    mock.method(User, 'findById', async () => fakeUser);

    const res = await request(app)
      .put(`/api/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`)
      .send({ teamAScore: 1, teamBScore: 0, winnerId: teamAId.toString() });

    assert.equal(res.status, 403);
  });
});

// ─── PATCH /api/matches/:id/forfeit ───────────────────────────────────────────

describe('PATCH /api/matches/:id/forfeit', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('admin registreert een forfeit (200)', async () => {
    mock.method(User,       'findById', async () => fakeAdmin);
    mock.method(Match,      'findById', async () => makeMatch());
    mock.method(Tournament, 'findById', async () => ({ status: 'completed', save: async () => {} }));

    const res = await request(app)
      .patch(`/api/matches/${matchId}/forfeit`)
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`)
      .send({ forfeitingTeamId: teamAId.toString() });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.match.status, 'forfeit');
  });

  it('geeft 400 als het forfeitingTeamId ontbreekt', async () => {
    mock.method(User,  'findById', async () => fakeAdmin);
    mock.method(Match, 'findById', async () => makeMatch());

    const res = await request(app)
      .patch(`/api/matches/${matchId}/forfeit`)
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`)
      .send({});

    assert.equal(res.status, 400);
  });

  it('geeft 403 als een gewone gebruiker een forfeit probeert in te dienen', async () => {
    mock.method(User, 'findById', async () => fakeUser);

    const res = await request(app)
      .patch(`/api/matches/${matchId}/forfeit`)
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`)
      .send({ forfeitingTeamId: teamAId.toString() });

    assert.equal(res.status, 403);
  });
});
