// tests/integration/auth.test.js
// Integratietests voor /api/auth — mongoose-methoden worden gemockt
// zodat geen echte MongoDB-verbinding nodig is.
'use strict';

process.env.NODE_ENV   = 'test';
process.env.JWT_SECRET = 'integratietest-geheim';

const { describe, it, beforeEach, mock } = require('node:test');
const assert   = require('node:assert/strict');
const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const mongoose = require('mongoose');

// Voorkom dat Mongoose echt probeert te verbinden
mongoose.connect    = async () => {};
mongoose.disconnect = async () => {};

const User = require('../../models/User');
const app  = require('../../app');

// ─── Hulpdata ─────────────────────────────────────────────────────────────────

const fakeId   = new mongoose.Types.ObjectId();
const fakeUser = {
  _id:             fakeId,
  username:        'testspeler',
  email:           'test@vives.be',
  role:            'user',
  stats:           { wins: 0, losses: 0, tournamentsPlayed: 0 },
  comparePassword: async (pw) => pw === 'veiligWW123',
  toJSON() { const o = { ...this }; delete o.password; return o; },
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('registreert een nieuwe gebruiker en retourneert 201 + token', async () => {
    mock.method(User, 'create', async () => fakeUser);

    const res = await request(app).post('/api/auth/register').send({
      username: 'testspeler',
      email:    'test@vives.be',
      password: 'veiligWW123',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'success');
    assert.ok(res.body.token);
    assert.equal(res.body.data.user.password, undefined);
  });

  it('geeft 400 terug als het wachtwoord te kort is (< 8 tekens)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'testspeler',
      email:    'test@vives.be',
      password: 'kort',
    });

    assert.equal(res.status, 400);
  });

  it('geeft 400 terug als verplichte velden ontbreken', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'onvolledig@vives.be' });

    assert.equal(res.status, 400);
  });

  it('geeft 409 terug bij een duplicate e-mail (Mongo code 11000)', async () => {
    const dupErr = Object.assign(new Error('duplicate'), {
      code: 11000,
      keyPattern: { email: 1 },
    });
    mock.method(User, 'create', async () => { throw dupErr; });

    const res = await request(app).post('/api/auth/register').send({
      username: 'anderspeler',
      email:    'test@vives.be',
      password: 'veiligWW123',
    });

    // Enkel status controleren: er is geen globale error-handler in app.js
    // die AppError naar JSON omzet, dus body-inhoud is Express-default
    assert.equal(res.status, 409);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('logt in met correcte gegevens en retourneert een JWT', async () => {
    mock.method(User, 'findOne', () => ({ select: async () => fakeUser }));

    const res = await request(app).post('/api/auth/login').send({
      email:    'test@vives.be',
      password: 'veiligWW123',
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it('geeft 401 terug bij een fout wachtwoord', async () => {
    const badUser = { ...fakeUser, comparePassword: async () => false };
    mock.method(User, 'findOne', () => ({ select: async () => badUser }));

    const res = await request(app).post('/api/auth/login').send({
      email:    'test@vives.be',
      password: 'foutWW999',
    });

    assert.equal(res.status, 401);
  });

  it('geeft 401 terug als de gebruiker niet bestaat', async () => {
    mock.method(User, 'findOne', () => ({ select: async () => null }));

    const res = await request(app).post('/api/auth/login').send({
      email:    'onbekend@vives.be',
      password: 'veiligWW123',
    });

    assert.equal(res.status, 401);
  });

  it('geeft 400 terug als het wachtwoord ontbreekt in de body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@vives.be' });

    assert.equal(res.status, 400);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  beforeEach(() => { mock.restoreAll(); });

  it('retourneert de eigen gebruiker bij een geldig token', async () => {
    const token = jwt.sign({ id: fakeId.toString() }, process.env.JWT_SECRET);
    mock.method(User, 'findById', async () => fakeUser);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, fakeUser.email);
  });

  it('geeft 401 terug zonder Authorization-header', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  it('geeft 401 terug met een ongeldig token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ditisgeengeldigtoken');

    assert.equal(res.status, 401);
  });
});
