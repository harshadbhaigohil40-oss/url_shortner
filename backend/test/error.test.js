const test = require('node:test');
const assert = require('node:assert/strict');
const { errorHandler, notFoundHandler } = require('../middleware/errorMiddleware');

const response = () => ({
  headersSent: false,
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; }
});

test('internal errors return a generic message and request id', () => {
  const res = response();
  errorHandler(new Error('database password leaked'), { id: 'req-1', method: 'GET', originalUrl: '/secret', ip: '127.0.0.1' }, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.error.message, 'An unexpected error occurred');
  assert.equal(res.payload.error.requestId, 'req-1');
  assert.equal(JSON.stringify(res.payload).includes('database password leaked'), false);
});

test('not found responses are structured and non-sensitive', () => {
  const res = response();
  notFoundHandler({ id: 'req-2' }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.payload.error.code, 'NOT_FOUND');
  assert.equal(res.payload.error.requestId, 'req-2');
});
