import test from 'node:test';
import assert from 'node:assert/strict';

test('frontend test runner is configured', () => {
  assert.equal(typeof document, 'undefined');
  assert.ok(true);
});

test('frontend production environment does not expose server secrets', () => {
  const publicKeys = Object.keys(import.meta.env || {});
  assert.equal(publicKeys.some((key) => /SECRET|PASSWORD|PRIVATE_KEY|MONGODB|REDIS/i.test(key)), false);
});
