// tests/unit/errorHandler.test.js
// Unit tests voor de globale error handler en de 404 handler in app.js
'use strict';

process.env.NODE_ENV   = 'test';
process.env.JWT_SECRET = 'unit-test-geheim';

const { describe, it } = require('node:test');
const assert   = require('node:assert/strict');
const request  = require('supertest');

const mongoose = require('mongoose');
mongoose.connect    = async () => {};
mongoose.disconnect = async () => {};

const app = require('../../app');

describe('404 handler', () => {
  it('retourneert 404 JSON voor een onbekende route', async () => {
    const res = await request(app).get('/api/bestaat-niet');

    assert.equal(res.status, 404);
    assert.equal(res.body.status, 'fail');
    assert.ok(res.body.message.includes('Cannot GET'));
  });
});

describe('Globale error handler', () => {
  it('retourneert 400 JSON voor een AppError met statusCode 400', async () => {
    // Ongeldige body op een bestaande route triggert een AppError
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'onvolledig@vives.be' });

    assert.equal(res.status, 400);
    assert.equal(res.body.status, 'fail');
    assert.ok(typeof res.body.message === 'string');
  });

  it('retourneert 401 JSON voor een AppError met statusCode 401', async () => {
    const res = await request(app).get('/api/auth/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.status, 'fail');
  });
});
