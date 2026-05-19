// tests/integration/tournaments.test.js
// Integratietests voor /api/tournaments — mongoose-methoden worden gemockt
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
const Tournament = require('../../models/Tournament');
const app        = require('../../app');

// ─── Hulpdata ─────────────────────────────────────────────────────────────────

const adminId  = new mongoose.Types.ObjectId();
const tournId  = new mongoose.Types.ObjectId();

const fakeAdmin = {
  _id: adminId, username: 'admin1', email: 'admin@vives.be', role: 'admin',
  toJSON() { return { ...this }; },
};
const fakeUser = {
  _id: new mongoose.Types.ObjectId(), username: 'speler1', email: 'sp@vives.be', role: 'user',
  toJSON() { return { ...this }; },
};

const makeTournament = (overrides = {}) => ({
  _id:             tournId,
  name:            'VIVES Cup',
  game:            'League of Legends',
  format:          'single_elimination',
  status:          'registration',
  admin:           adminId,
  registeredTeams: [],
  settings:        { maxTeams: 8, prizePool: 'No prize', startDate: new Date('2026-09-01'), description: '' },
  rounds:          [],
  champion:        null,
  save:            async function () { return this; },
  populate:        async function () { return this; },
  toJSON()         { return { ...this }; },
  ...overrides,
});

const tokenFor = (user) => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET);

// ─── GET /api/tournaments ─────────────────────────────────────────────────────

describe('GET /api/tournaments', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('retourneert een lijst van toernooien', async () => {
    const chain = {
      populate: function () { return this; },
      skip:     function () { return this; },
      limit:    function () { return this; },
      sort:     async function () { return [makeTournament()]; },
    };
    mock.method(Tournament, 'find',           () => chain);
    mock.method(Tournament, 'countDocuments', async () => 1);

    const res = await request(app).get('/api/tournaments');

    assert.equal(res.status, 200);
    assert.equal(res.body.data.tournaments.length, 1);
    assert.ok(res.body.pagination);
  });

  it('geeft 400 bij een ongeldige status filter', async () => {
    const res = await request(app).get('/api/tournaments?status=onbekend');
    assert.equal(res.status, 400);
  });
});

// ─── POST /api/tournaments ────────────────────────────────────────────────────

describe('POST /api/tournaments', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('admin maakt een toernooi aan en krijgt 201', async () => {
    mock.method(User,       'findById', async () => fakeAdmin);
    mock.method(Tournament, 'create',   async () => makeTournament());

    const res = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`)
      .send({ name: 'VIVES Cup', game: 'League of Legends', settings: { maxTeams: 8, startDate: '2026-09-01' } });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.tournament.name, 'VIVES Cup');
  });

  it('geeft 403 als een gewone gebruiker een toernooi probeert aan te maken', async () => {
    mock.method(User, 'findById', async () => fakeUser);

    const res = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`)
      .send({ name: 'Fake Cup', game: 'CS2', settings: { maxTeams: 4, startDate: '2026-09-01' } });

    assert.equal(res.status, 403);
  });

  it('geeft 400 als verplichte velden ontbreken', async () => {
    mock.method(User, 'findById', async () => fakeAdmin);

    const res = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`)
      .send({ name: 'Onvolledig' });

    assert.equal(res.status, 400);
  });

  it('geeft 401 zonder authenticatie', async () => {
    const res = await request(app)
      .post('/api/tournaments')
      .send({ name: 'Anoniem Cup', game: 'Valorant', settings: { maxTeams: 4, startDate: '2026-09-01' } });

    assert.equal(res.status, 401);
  });
});

// ─── GET /api/tournaments/:id ─────────────────────────────────────────────────

describe('GET /api/tournaments/:id', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('retourneert het toernooi bij een geldig ID', async () => {
    let calls = 0;
    mock.method(Tournament, 'findById', () => ({
      populate: function () { calls++; return calls >= 6 ? Promise.resolve(makeTournament()) : this; },
    }));

    const res = await request(app).get(`/api/tournaments/${tournId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.tournament.name, 'VIVES Cup');
  });

  it('geeft 400 bij ongeldig ObjectId', async () => {
    const res = await request(app).get('/api/tournaments/GEEN_GELDIG_ID');
    assert.equal(res.status, 400);
  });

  it('geeft 404 als het toernooi niet bestaat', async () => {
    let calls = 0;
    mock.method(Tournament, 'findById', () => ({
      populate: function () { calls++; return calls >= 6 ? Promise.resolve(null) : this; },
    }));

    const res = await request(app).get(`/api/tournaments/${new mongoose.Types.ObjectId()}`);
    assert.equal(res.status, 404);
  });
});

// ─── DELETE /api/tournaments/:id ──────────────────────────────────────────────

describe('DELETE /api/tournaments/:id', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('admin verwijdert een toernooi met status registration (204)', async () => {
    mock.method(User,       'findById',    async () => fakeAdmin);
    mock.method(Tournament, 'findById',    async () => makeTournament());
    mock.method(Tournament, 'findByIdAndDelete', async () => ({}));

    const Match = require('../../models/Match');
    mock.method(Match, 'deleteMany', async () => ({}));

    const res = await request(app)
      .delete(`/api/tournaments/${tournId}`)
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`);

    assert.equal(res.status, 204);
  });

  it('geeft 400 als het toernooi nog bezig is', async () => {
    mock.method(User,       'findById', async () => fakeAdmin);
    mock.method(Tournament, 'findById', async () => makeTournament({ status: 'ongoing' }));

    const res = await request(app)
      .delete(`/api/tournaments/${tournId}`)
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`);

    assert.equal(res.status, 400);
  });
});

// ─── PATCH /api/tournaments/:id/cancel ───────────────────────────────────────

describe('PATCH /api/tournaments/:id/cancel', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('admin kan een lopend toernooi annuleren (200)', async () => {
    mock.method(User,       'findById', async () => fakeAdmin);
    mock.method(Tournament, 'findById', async () => makeTournament({ status: 'ongoing' }));

    const res = await request(app)
      .patch(`/api/tournaments/${tournId}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.tournament.status, 'cancelled');
  });

  it('geeft 400 als het toernooi al voltooid is', async () => {
    mock.method(User,       'findById', async () => fakeAdmin);
    mock.method(Tournament, 'findById', async () => makeTournament({ status: 'completed' }));

    const res = await request(app)
      .patch(`/api/tournaments/${tournId}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`);

    assert.equal(res.status, 400);
  });

  it('geeft 403 als een gewone gebruiker probeert te annuleren', async () => {
    mock.method(User, 'findById', async () => fakeUser);

    const res = await request(app)
      .patch(`/api/tournaments/${tournId}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`);

    assert.equal(res.status, 403);
  });
});
