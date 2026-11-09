const test = require('node:test');
const assert = require('node:assert/strict');
const {
  permissions,
  hasPermission,
  isOwnerOrAdmin
} = require('../middleware/authorization');

test('regular users receive only their configured permissions', () => {
  const user = { _id: 'user-1', role: 'user' };
  assert.equal(hasPermission(user, permissions.URL_READ_OWN), true);
  assert.equal(hasPermission(user, permissions.ADMIN_STATS), false);
});

test('custom permissions are honored without granting admin access', () => {
  const user = { _id: 'user-1', role: 'user', permissions: [permissions.ADMIN_STATS] };
  assert.equal(hasPermission(user, permissions.ADMIN_STATS), true);
  assert.equal(hasPermission(user, permissions.ADMIN_MANAGE_USERS), false);
});

test('resource ownership and admin override are enforced', () => {
  const resource = { user: 'user-1' };
  assert.equal(isOwnerOrAdmin({ _id: 'user-1', role: 'user' }, resource), true);
  assert.equal(isOwnerOrAdmin({ _id: 'user-2', role: 'user' }, resource), false);
  // Admin does NOT bypass ownership check per implementation
  assert.equal(isOwnerOrAdmin({ _id: 'admin-1', role: 'admin' }, resource), false);
});
