const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEnv } = require('../config/env');

test('environment validation accepts required production configuration', () => {
  const env = loadEnv({
    NODE_ENV: 'production',
    PORT: '5000',
    MONGODB_URI: 'mongodb://db.example/app',
    JWT_SECRET: 'a'.repeat(32),
    CSRF_SECRET: 'b'.repeat(32),
    CORS_ORIGIN: 'https://app.example.com',
    PUBLIC_API_URL: 'https://api.example.com',
    REDIS_URL: 'redis://cache.example:6379'
  });
  assert.equal(env.NODE_ENV, 'production');
});

test('environment validation rejects short secrets and missing database URL', () => {
  assert.throws(() => loadEnv({
    NODE_ENV: 'production',
    JWT_SECRET: 'short',
    CSRF_SECRET: 'short',
    CORS_ORIGIN: 'https://app.example.com'
  }), /Invalid server configuration/);
});
