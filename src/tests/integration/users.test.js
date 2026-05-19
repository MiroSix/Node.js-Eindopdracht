// tests/integration/users.test.js
// Integratietests voor /api/users — mongoose-methoden worden gemockt
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
const app  = require('../../app');

// ─── Hulpdata ─────────────────────────────────────────────────────────────────

const userId  = new mongoose.Types.ObjectId();
const otherId = new mongoose.Types.ObjectId();

const fakeAdmin = {
  _id: new mongoose.Types.ObjectId(), username: 'adminUser', email: 'admin@vives.be', role: 'admin',
  toJSON() { return { ...this }; },
};
const fakeUser = {
  _id: userId, username: 'speler1', email: 'sp@vives.be', role: 'user',
  toJSON() { return { ...this }; },
};
const otherUser = {
  _id: otherId, username: 'speler2', email: 'sp2@vives.be', role: 'user',
  toJSON() { return { ...this }; },
};

const tokenFor = (user) => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET);

// ─── GET /api/users ───────────────────────────────────────────────────────────

describe('GET /api/users', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('admin krijgt alle gebruikers (200)', async () => {
    const chain = {
      skip:  function () { return this; },
      limit: function () { return this; },
      sort:  async function () { return [fakeUser, fakeAdmin]; },
    };
    mock.method(User, 'find',           () => chain);
    mock.method(User, 'countDocuments', async () => 2);
    mock.method(User, 'findById',       async () => fakeAdmin);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.users.length, 2);
  });

  it('geeft 403 als een gewone gebruiker de lijst opvraagt', async () => {
    mock.method(User, 'findById', async () => fakeUser);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`);

    assert.equal(res.status, 403);
  });

  it('geeft 401 zonder authenticatie', async () => {
    const res = await request(app).get('/api/users');
    assert.equal(res.status, 401);
  });
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────

describe('GET /api/users/:id', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('retourneert een gebruiker bij geldig ID en authenticatie', async () => {
    // auth middleware + route handler: twee findById calls
    mock.method(User, 'findById', async (id) => {
      if (id.toString() === fakeUser._id.toString()) return fakeUser;
      return fakeUser; // eerste call (auth) + tweede call (route)
    });

    const res = await request(app)
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.username, 'speler1');
  });

  it('geeft 400 bij ongeldig ObjectId', async () => {
    mock.method(User, 'findById', async () => fakeUser);

    const res = await request(app)
      .get('/api/users/GEEN_GELDIG_ID')
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`);

    assert.equal(res.status, 400);
  });

  it('geeft 404 als de gebruiker niet bestaat', async () => {
    let calls = 0;
    mock.method(User, 'findById', async () => {
      calls++;
      return calls === 1 ? fakeUser : null; // eerste call = auth, tweede = route
    });

    const res = await request(app)
      .get(`/api/users/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`);

    assert.equal(res.status, 404);
  });
});

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────

describe('PUT /api/users/:id', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('gebruiker kan zijn eigen profiel updaten (200)', async () => {
    const updatedUser = { ...fakeUser, username: 'nieuweNaam' };
    mock.method(User, 'findById',        async () => fakeUser);
    mock.method(User, 'findByIdAndUpdate', async () => updatedUser);

    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`)
      .send({ username: 'nieuweNaam' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.username, 'nieuweNaam');
  });

  it('geeft 400 als het wachtwoord via dit endpoint wordt gewijzigd', async () => {
    mock.method(User, 'findById', async () => fakeUser);

    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`)
      .send({ password: 'nieuwWW123' });

    assert.equal(res.status, 400);
  });

  it('geeft 403 als een gebruiker een ander profiel probeert te updaten', async () => {
    mock.method(User, 'findById', async () => otherUser);

    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${tokenFor(otherUser)}`)
      .send({ username: 'gehackt' });

    assert.equal(res.status, 403);
  });
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────

describe('DELETE /api/users/:id', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('admin verwijdert een gebruiker (204)', async () => {
    mock.method(User, 'findById',    async () => fakeAdmin);
    mock.method(User, 'findByIdAndDelete', async () => fakeUser);

    const res = await request(app)
      .delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${tokenFor(fakeAdmin)}`);

    assert.equal(res.status, 204);
  });

  it('geeft 403 als een gewone gebruiker een account probeert te verwijderen', async () => {
    mock.method(User, 'findById', async () => fakeUser);

    const res = await request(app)
      .delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${tokenFor(fakeUser)}`);

    assert.equal(res.status, 403);
  });
});
