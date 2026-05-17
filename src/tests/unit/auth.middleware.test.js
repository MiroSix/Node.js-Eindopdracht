// tests/unit/auth.middleware.test.js
// Unit tests voor de auth-middleware — User.findById wordt gemockt
'use strict';

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const jwt    = require('jsonwebtoken');

// Zorg dat JWT_SECRET beschikbaar is vooraleer de module geladen wordt
process.env.JWT_SECRET = 'test-secret-voor-unit-tests';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeReq  = (authHeader) => ({ headers: { authorization: authHeader } });
const makeNext = () => {
  const fn = (err) => { fn.calledWith = err; fn.called = true; };
  fn.called = false; fn.calledWith = undefined;
  return fn;
};

// Genereer een geldig token voor testdoeleinden
const fakeUser = { _id: '507f1f77bcf86cd799439011', role: 'user' };
const validToken = jwt.sign({ id: fakeUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('auth middleware', () => {
  // We vervangen User.findById via de module-cache
  let authMiddleware;
  let userFindByIdMock;

  beforeEach(() => {
    // Reset module-cache zodat de mock telkens opnieuw ingesteld kan worden
    delete require.cache[require.resolve('../../middleware/auth')];
    delete require.cache[require.resolve('../../models/User')];

    // Simpele mock: vervang User.findById
    userFindByIdMock = mock.fn(async () => fakeUser);
    require.cache[require.resolve('../../models/User')] = {
      id: require.resolve('../../models/User'),
      filename: require.resolve('../../models/User'),
      exports: { findById: userFindByIdMock },
    };

    authMiddleware = require('../../middleware/auth').auth;
  });

  it('geeft 401 terug als er geen Authorization-header is', async () => {
    const req  = makeReq(undefined);
    const next = makeNext();
    await authMiddleware(req, {}, next);

    assert.equal(next.calledWith.statusCode, 401);
    assert.ok(next.calledWith.message.includes('Authentication required'));
  });

  it('geeft 401 terug als de header geen Bearer-prefix heeft', async () => {
    const req  = makeReq('Basic sometoken');
    const next = makeNext();
    await authMiddleware(req, {}, next);

    assert.equal(next.calledWith.statusCode, 401);
  });

  it('geeft 401 terug bij een ongeldig token', async () => {
    const req  = makeReq('Bearer ditisgeengeldigtoken');
    const next = makeNext();
    await authMiddleware(req, {}, next);

    assert.equal(next.calledWith.statusCode, 401);
    assert.ok(next.calledWith.message.toLowerCase().includes('invalid token'));
  });

  it('zet req.user bij een geldig token en gekende gebruiker', async () => {
    const req  = { headers: { authorization: `Bearer ${validToken}` } };
    const next = makeNext();
    await authMiddleware(req, {}, next);

    assert.equal(next.called, true);
    assert.equal(next.calledWith, undefined); // geen fout
    assert.deepEqual(req.user, fakeUser);
  });

  it('geeft 401 terug als de gebruiker niet meer bestaat in de DB', async () => {
    userFindByIdMock = mock.fn(async () => null);
    // herinstalleer de mock
    require.cache[require.resolve('../../models/User')].exports.findById = userFindByIdMock;

    const req  = { headers: { authorization: `Bearer ${validToken}` } };
    const next = makeNext();
    await authMiddleware(req, {}, next);

    assert.equal(next.calledWith.statusCode, 401);
    assert.ok(next.calledWith.message.includes('no longer exists'));
  });
});
