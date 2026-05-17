// tests/integration/teams.test.js
// Integratietests voor /api/teams — mongoose-methoden worden gemockt
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

const User = require('../../models/User');
const Team = require('../../models/Team');
const app  = require('../../app');

// ─── Hulpdata ─────────────────────────────────────────────────────────────────

const userId   = new mongoose.Types.ObjectId();
const teamId   = new mongoose.Types.ObjectId();
const otherId  = new mongoose.Types.ObjectId();

const fakeUser = {
  _id: userId, username: 'captain1', email: 'cap@vives.be', role: 'user',
  toJSON() { return { ...this }; },
};
const otherUser = {
  _id: otherId, username: 'speler2', email: 'sp2@vives.be', role: 'user',
  toJSON() { return { ...this }; },
};

const makeTeam = (overrides = {}) => ({
  _id:       teamId,
  name:      'Team Alpha',
  tag:       'ALPH',
  captain:   userId,
  members:   [{ userId, role: 'captain' }],
  isActive:  true,
  stats:     { wins: 0, losses: 0, tournamentsPlayed: 0, matchesPlayed: 0 },
  populate:  async () => {},
  save:      async function() { return this; },
  toJSON()   { return { ...this, memberCount: this.members.length }; },
  ...overrides,
});

// Genereer een token voor een gegeven user-object
const tokenFor = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET);

// ─── GET /api/teams ───────────────────────────────────────────────────────────

describe('GET /api/teams', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('retourneert een lijst van actieve teams', async () => {
    const chain = {
      populate: function() { return this; },
      skip:     function() { return this; },
      limit:    function() { return this; },
      sort:     async function() { return [makeTeam()]; },
    };
    mock.method(Team, 'find',           () => chain);
    mock.method(Team, 'countDocuments', async () => 1);

    const res = await request(app).get('/api/teams');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.teams.length, 1);
    assert.ok(res.body.pagination);
  });
});

// ─── POST /api/teams ──────────────────────────────────────────────────────────

describe('POST /api/teams', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('maakt een team aan en retourneert 201', async () => {
    mock.method(User, 'findById', async () => fakeUser);
    mock.method(Team, 'findOne',  async () => null); // geen bestaande captaincy
    mock.method(Team, 'create',   async () => makeTeam());

    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`)
      .send({ name: 'Team Alpha', tag: 'ALPH' });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.team.name, 'Team Alpha');
  });

  it('geeft 401 terug zonder authenticatie', async () => {
    const res = await request(app)
      .post('/api/teams')
      .send({ name: 'Anoniem Team', tag: 'ANON' });

    assert.equal(res.status, 401);
  });

  it('geeft 400 terug als naam of tag ontbreekt', async () => {
    mock.method(User, 'findById', async () => fakeUser);

    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`)
      .send({ name: 'Alleen naam' }); // tag ontbreekt

    assert.equal(res.status, 400);
  });

  it('geeft 409 terug als de gebruiker al captain is van een team', async () => {
    mock.method(User, 'findById', async () => fakeUser);
    mock.method(Team, 'findOne',  async () => makeTeam()); // al captain

    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`)
      .send({ name: 'Tweede Team', tag: 'SCND' });

    assert.equal(res.status, 409);
  });
});

// ─── GET /api/teams/:id ───────────────────────────────────────────────────────

describe('GET /api/teams/:id', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('retourneert het team bij een geldig ID', async () => {
    const chain = {
      populate: function() { return this; },
      // tweede populate geeft het team terug
    };
    // Maak een ketting die uiteindelijk het team retourneert
    let callCount = 0;
    const chainObj = {
      populate: function() {
        callCount++;
        if (callCount >= 2) return Promise.resolve(makeTeam());
        return this;
      },
    };
    mock.method(Team, 'findById', () => chainObj);

    const res = await request(app).get(`/api/teams/${teamId}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.team.name, 'Team Alpha');
  });

  it('geeft 400 terug bij een ongeldig ObjectId-formaat', async () => {
    const res = await request(app).get('/api/teams/GEEN_GELDIG_ID');
    assert.equal(res.status, 400);
  });

  it('geeft 404 terug als het team niet gevonden wordt', async () => {
    mock.method(Team, 'findById', () => ({
      populate: function() { return this; },
      // Blijft returnen zodat tweede populate null geeft
      then: (resolve) => resolve(null),
    }));

    // Simpeler: mock findById direct als async null via chain
    mock.restoreAll();
    let cnt = 0;
    mock.method(Team, 'findById', () => ({
      populate: function() {
        cnt++;
        if (cnt >= 2) return Promise.resolve(null);
        return this;
      },
    }));

    const fakeMongoId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/teams/${fakeMongoId}`);

    assert.equal(res.status, 404);
  });
});

// ─── DELETE /api/teams/:id ────────────────────────────────────────────────────

describe('DELETE /api/teams/:id', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('disbandt het team als de captain erom vraagt (204)', async () => {
    mock.method(User, 'findById', async () => fakeUser);
    mock.method(Team, 'findById', async () => makeTeam());

    const res = await request(app)
      .delete(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`);

    assert.equal(res.status, 204);
  });

  it('geeft 403 terug als een niet-captain het team probeert te verwijderen', async () => {
    mock.method(User, 'findById', async () => otherUser);
    mock.method(Team, 'findById', async () => makeTeam()); // captain = userId ≠ otherId

    const res = await request(app)
      .delete(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${tokenFor(otherUser)}`);

    assert.equal(res.status, 403);
  });

  it('geeft 401 terug zonder authenticatie', async () => {
    const res = await request(app).delete(`/api/teams/${teamId}`);
    assert.equal(res.status, 401);
  });
});
