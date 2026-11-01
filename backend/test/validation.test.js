const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitize, shortenSchema, listQuerySchema, codeSchema } = require('../middleware/validation');

test('validation strips markup and rejects unexpected object fields', () => {
  const input = sanitize({
    longUrl: 'https://example.com',
    ogTitle: '<script>alert(1)</script>Campaign',
    unexpected: 'ignored'
  });
  const result = shortenSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.equal(result.data.ogTitle, 'alert(1)Campaign');
  assert.equal('unexpected' in result.data, false);
});

test('query validation applies safe defaults and bounds', () => {
  const result = listQuerySchema.safeParse({ page: '2', limit: '20', order: 'desc' });
  assert.equal(result.success, true);
  assert.equal(result.data.page, 2);
  assert.equal(result.data.limit, 20);
  assert.equal(listQuerySchema.safeParse({ limit: '1000' }).success, false);
});

test('short-code validation rejects malformed values', () => {
  assert.equal(codeSchema.safeParse({ code: 'valid_code-1' }).success, true);
  assert.equal(codeSchema.safeParse({ code: '../private' }).success, false);
});
