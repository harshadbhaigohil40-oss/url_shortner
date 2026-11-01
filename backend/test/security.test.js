const test = require('node:test');
const assert = require('node:assert/strict');
const { hashApiKey, isSafeAvatarFilename } = require('../utils/security');
const { shortenSchema } = require('../middleware/validation');

test('API key hashing is deterministic and does not expose the original key', () => {
  const key = 'sk_test_example_key';
  const hash = hashApiKey(key);
  assert.equal(hash, hashApiKey(key));
  assert.notEqual(hash, key);
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('avatar filename validation accepts generated image filenames', () => {
  assert.equal(isSafeAvatarFilename('550e8400-e29b-41d4-a716-446655440000.jpg'), true);
  assert.equal(isSafeAvatarFilename('550e8400-e29b-41d4-a716-446655440000.png'), true);
  assert.equal(isSafeAvatarFilename('550e8400-e29b-41d4-a716-446655440000.webp'), true);
});

test('avatar filename validation blocks traversal and unsupported files', () => {
  const invalid = [
    '../secret.jpg',
    '..\\secret.jpg',
    '/etc/passwd',
    'avatar.svg',
    'avatar.jpg.exe',
    'avatar.jpg',
    '',
    null
  ];
  for (const filename of invalid) assert.equal(isSafeAvatarFilename(filename), false, filename);
});

test('shorten validation rejects unsupported protocols', () => {
  const result = shortenSchema.safeParse({ longUrl: 'javascript:alert(1)' });
  assert.equal(result.success, false);
});

test('shorten validation accepts HTTPS URLs', () => {
  const result = shortenSchema.safeParse({ longUrl: 'https://example.com/path' });
  assert.equal(result.success, true);
});
