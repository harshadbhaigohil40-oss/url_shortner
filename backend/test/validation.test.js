const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitize, shortenSchema, bulkSchema, listQuerySchema, codeSchema } = require('../middleware/validation');

test('validation strips markup and rejects unexpected object fields', () => {
  const input = sanitize({
    longUrl: 'https://example.com',
    ogTitle: '<script>alert(1)</script>Campaign',
    unexpected: 'ignored',
    tags: ['<b>promo</b>', ' summer2026 ', 'marketing']
  });
  const result = shortenSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.equal(result.data.ogTitle, 'alert(1)Campaign');
  assert.equal('unexpected' in result.data, false);
  assert.deepEqual(result.data.tags, ['promo', 'summer2026', 'marketing']);
});

test('bulkSchema enforces batch limits and validates tags', () => {
  const validBulk = {
    links: [
      { longUrl: 'https://site1.com', tags: ['launch', 'v1'] },
      { longUrl: 'https://site2.com', customAlias: 'site-two' }
    ],
    defaultTags: ['bulk-batch', 'q3-campaign']
  };
  const result = bulkSchema.safeParse(sanitize(validBulk));
  assert.equal(result.success, true);
  assert.equal(result.data.links.length, 2);
  assert.deepEqual(result.data.defaultTags, ['bulk-batch', 'q3-campaign']);

  // Exceeds 20 links limit
  const tooMany = {
    links: Array.from({ length: 21 }, (_, i) => ({ longUrl: `https://test${i}.com` }))
  };
  assert.equal(bulkSchema.safeParse(tooMany).success, false);
});

test('query validation applies safe defaults and bounds', () => {
  const result = listQuerySchema.safeParse({ page: '2', limit: '20', order: 'desc', tag: 'marketing' });
  assert.equal(result.success, true);
  assert.equal(result.data.page, 2);
  assert.equal(result.data.limit, 20);
  assert.equal(result.data.tag, 'marketing');
  assert.equal(listQuerySchema.safeParse({ limit: '1000' }).success, false);
});

test('short-code validation rejects malformed values', () => {
  assert.equal(codeSchema.safeParse({ code: 'valid_code-1' }).success, true);
  assert.equal(codeSchema.safeParse({ code: '../private' }).success, false);
});

