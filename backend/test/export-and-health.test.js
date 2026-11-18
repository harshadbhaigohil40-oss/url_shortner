const test = require('node:test');
const assert = require('node:assert/strict');
const { exportQuerySchema } = require('../middleware/validation');
const { isPrivateHost } = require('../controllers/urlController');

test('exportQuerySchema validates format and accepts valid optional urlId', () => {
  const defaultExport = exportQuerySchema.safeParse({});
  assert.equal(defaultExport.success, true);
  assert.equal(defaultExport.data.format, 'csv');

  const jsonExport = exportQuerySchema.safeParse({ format: 'json' });
  assert.equal(jsonExport.success, true);
  assert.equal(jsonExport.data.format, 'json');

  const validUrlId = exportQuerySchema.safeParse({ format: 'csv', urlId: '65b2962c4a46bfc0c34df2fc' });
  assert.equal(validUrlId.success, true);
  assert.equal(validUrlId.data.urlId, '65b2962c4a46bfc0c34df2fc');

  const invalidFormat = exportQuerySchema.safeParse({ format: 'xml' });
  assert.equal(invalidFormat.success, false);

  const invalidUrlId = exportQuerySchema.safeParse({ urlId: 'not-an-objectid' });
  assert.equal(invalidUrlId.success, false);
});

test('health check SSRF protections block private IP ranges and localhost', async () => {
  assert.equal(await isPrivateHost('localhost'), true);
  assert.equal(await isPrivateHost('127.0.0.1'), true);
  assert.equal(await isPrivateHost('10.0.0.1'), true);
  assert.equal(await isPrivateHost('192.168.1.1'), true);
  assert.equal(await isPrivateHost('169.254.169.254'), true);
  assert.equal(await isPrivateHost('::1'), true);
});
