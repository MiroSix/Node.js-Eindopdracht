// tests/unit/AppError.test.js
// Unit tests voor de AppError klasse en validateObjectId middleware
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('../../errors/AppError');

// ─── AppError ─────────────────────────────────────────────────────────────────

describe('AppError', () => {
  it('slaat de statusCode correct op', () => {
    const err = new AppError('Niet gevonden', 404);
    assert.equal(err.statusCode, 404);
  });

  it('slaat het bericht correct op', () => {
    const err = new AppError('Ongeldig verzoek', 400);
    assert.equal(err.message, 'Ongeldig verzoek');
  });

  it('markeert de fout als operationeel', () => {
    const err = new AppError('Verboden', 403);
    assert.equal(err.isOperational, true);
  });

  it('is een instantie van Error', () => {
    const err = new AppError('Server fout', 500);
    assert.ok(err instanceof Error);
  });

  it('heeft een stack trace', () => {
    const err = new AppError('Test', 400);
    assert.ok(err.stack);
  });
});
