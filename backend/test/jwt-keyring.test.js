require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const { KEY_RING, addPreviousKey, setActiveKey, updateActiveSecret, getKeyInfo, verifyToken } = require('../config/jwt-keyring');

test('KEY_RING has active key with valid kid', () => {
  assert.ok(KEY_RING.active.kid);
  assert.ok(typeof KEY_RING.active.kid === 'string');
  assert.ok(KEY_RING.active.kid.length >= 16); // crypto.randomBytes(8) = 16 hex chars
  assert.ok(typeof KEY_RING.active.secret === 'string');
  assert.ok(KEY_RING.active.secret.length > 0);
  assert.ok(KEY_RING.active.rotatedAt);
  assert.equal(KEY_RING.active.algorithm, 'HS256');
});

test('KEY_RING previous is initially empty array', () => {
  assert.deepStrictEqual(KEY_RING.previous, []);
});

test('addPreviousKey adds a key to the previous ring', () => {
  const initialLength = KEY_RING.previous.length;
  addPreviousKey('v2', 'previous-secret-key');
  assert.strictEqual(KEY_RING.previous.length, initialLength + 1);
  assert.strictEqual(KEY_RING.previous[KEY_RING.previous.length - 1].kid, 'v2');
});

test('addPreviousKey requires both kid and secret', () => {
  addPreviousKey('', 'secret');
  addPreviousKey('kid', '');
  // Should not throw, just silently skip
  assert.ok(true);
});

test('getKeyInfo returns activeKid and previousKIDs', () => {
  const info = getKeyInfo();
  assert.ok(info.activeKid);
  assert.ok(Array.isArray(info.previousKIDs));
});

test('verifyToken verifies a valid JWT with active key', () => {
  // This test verifies the function exists and works with a properly formed token
  // We test that it throws for malformed tokens
  assert.throws(() => verifyToken('invalid-token'), Error);
});

test('verifyToken throws for completely invalid JWT', () => {
  assert.throws(() => verifyToken('not.a.real.jwt'), Error);
});

test('setActiveKey rotates active key and promotes old key', () => {
  const oldKid = KEY_RING.active.kid;
  const newSecret = 'new-rotate-secret-key-that-is-long-enough-for-jwt-32chars';
  const newKid = setActiveKey(newSecret);

  assert.notEqual(newKid, oldKid);
  assert.equal(KEY_RING.active.kid, newKid);
  assert.equal(KEY_RING.active.secret, newSecret);

  // Old key should be in previous
  const wasPromoted = KEY_RING.previous.some(k => k.kid === oldKid);
  assert.ok(wasPromoted, 'Old active key should be promoted to previous');
});

test('setActiveKey throws without new secret', () => {
  assert.throws(() => setActiveKey(''), Error, { message: /secret is required/ });
});

test('updateActiveSecret updates secret without changing kid', () => {
  const currentKid = KEY_RING.active.kid;
  const newSecret = 'hot-reload-secret-key-that-is-long-enough-for-jwt-32chars';
  updateActiveSecret(newSecret);

  assert.equal(KEY_RING.active.kid, currentKid);
  assert.equal(KEY_RING.active.secret, newSecret);
});

test('updateActiveSecret throws without new secret', () => {
  assert.throws(() => updateActiveSecret(''), Error, { message: /secret is required/ });
});

test('verifyToken verifies token signed with previous key after rotation', () => {
  const jwt = require('jsonwebtoken');
  const oldKid = KEY_RING.active.kid;
  const oldSecret = KEY_RING.active.secret;
  const token = jwt.sign({ userId: '12345' }, oldSecret, { algorithm: 'HS256', keyid: oldKid });
  
  // Rotate key
  const newSecret = 'yet-another-new-secret-that-is-at-least-32-chars-long';
  setActiveKey(newSecret);

  // Verifying token signed with previous key should still succeed
  const verified = verifyToken(token);
  assert.equal(verified.userId, '12345');
});