const test = require('node:test');
const assert = require('node:assert/strict');

const originalEnv = process.env.NODE_ENV;

test('rate limiter module exposes production status helpers', () => {
  const rateLimiter = require('../middleware/rateLimiter');
  const status = rateLimiter.redisStatus();
  assert.equal(typeof status.configured, 'boolean');
  assert.equal(typeof status.ready, 'boolean');
});

test('API-key limiter does not silently pass in production without Redis', async () => {
  process.env.NODE_ENV = 'production';
  const { enforceApiKeyRateLimit, redisStatus } = require('../middleware/rateLimiter');
  if (redisStatus().configured) return;
  const res = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json() { return this; }
  };
  let called = false;
  await enforceApiKeyRateLimit({ _id: 'test-user', apiKeyRateLimit: 1 }, {}, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 503);
  process.env.NODE_ENV = originalEnv;
});
