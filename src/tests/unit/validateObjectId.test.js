// tests/unit/validateObjectId.test.js
// Unit tests voor de validateObjectId middleware — geen DB nodig
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const validateObjectId = require('../../middleware/validateObjectId');

// Helpers om req/res/next te simuleren zonder een echte server
const makeReq  = (params) => ({ params });
const makeNext  = () => {
  const fn = (err) => { fn.calledWith = err; fn.called = true; };
  fn.called = false;
  fn.calledWith = undefined;
  return fn;
};

describe('validateObjectId middleware', () => {
  it('roept next() aan zonder fout bij een geldig ObjectId', () => {
    const validId = new mongoose.Types.ObjectId().toString();
    const req  = makeReq({ id: validId });
    const next = makeNext();

    validateObjectId('id')(req, {}, next);

    assert.equal(next.called, true);
    assert.equal(next.calledWith, undefined);
  });

  it('roept next(AppError) aan bij een ongeldig id-formaat', () => {
    const req  = makeReq({ id: 'GEEN_GELDIG_ID' });
    const next = makeNext();

    validateObjectId('id')(req, {}, next);

    assert.equal(next.called, true);
    assert.ok(next.calledWith);
    assert.equal(next.calledWith.statusCode, 400);
    assert.ok(next.calledWith.message.includes("'id'"));
  });

  it('valideert meerdere params en faalt bij de eerste ongeldige', () => {
    const validId  = new mongoose.Types.ObjectId().toString();
    const req      = makeReq({ tournamentId: validId, matchId: 'slecht' });
    const next     = makeNext();

    validateObjectId('tournamentId', 'matchId')(req, {}, next);

    assert.equal(next.calledWith.statusCode, 400);
    assert.ok(next.calledWith.message.includes("'matchId'"));
  });

  it('valideert meerdere params correct als alles geldig is', () => {
    const id1 = new mongoose.Types.ObjectId().toString();
    const id2 = new mongoose.Types.ObjectId().toString();
    const req  = makeReq({ teamId: id1, userId: id2 });
    const next = makeNext();

    validateObjectId('teamId', 'userId')(req, {}, next);

    assert.equal(next.called, true);
    assert.equal(next.calledWith, undefined);
  });
});
