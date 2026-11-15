const test = require('node:test');
const assert = require('node:assert/strict');

const {
  permissions,
  hasPermission,
  isOwnerOrAdmin,
  rolePermissions,
} = require('../middleware/authorization');

test('isOwnerOrAdmin uses ownership check only (no admin bypass)', () => {
  const resource = { user: 'user-1' };

  // Regular user who owns the resource should pass
  assert.equal(isOwnerOrAdmin({ _id: 'user-1', role: 'user' }, resource), true);

  // Regular user who does NOT own the resource should fail
  assert.equal(isOwnerOrAdmin({ _id: 'user-2', role: 'user' }, resource), false);

  // Admin role should NOT bypass ownership check
  assert.equal(isOwnerOrAdmin({ _id: 'admin-1', role: 'admin' }, resource), false);
});

test('isOwnerOrAdmin with custom ownerField', () => {
  const resource = { owner: 'resource-owner' };

  assert.equal(isOwnerOrAdmin({ _id: 'resource-owner', role: 'user' }, resource, 'owner'), true);
  assert.equal(isOwnerOrAdmin({ _id: 'other-user', role: 'user' }, resource, 'owner'), false);
});

test('hasPermission checks role-based permissions', () => {
  const user = { _id: 'user-1', role: 'user' };

  assert.equal(hasPermission(user, permissions.URL_READ_OWN), true);
  assert.equal(hasPermission(user, permissions.URL_EDIT_OWN), true);
  assert.equal(hasPermission(user, permissions.ADMIN_STATS), false);
  assert.equal(hasPermission(user, permissions.ADMIN_MANAGE_USERS), false);
});

test('hasPermission with custom permissions array', () => {
  const user = { _id: 'user-1', role: 'user', permissions: [permissions.ADMIN_STATS] };

  assert.equal(hasPermission(user, permissions.ADMIN_STATS), true);
  assert.equal(hasPermission(user, permissions.ADMIN_MANAGE_USERS), false);
});

test('rolePermissions are correctly defined for each role', () => {
  assert.ok(rolePermissions.user.has(permissions.URL_CREATE));
  assert.ok(rolePermissions.user.has(permissions.URL_READ_OWN));
  assert.ok(rolePermissions.admin.has(permissions.URL_CREATE));
  assert.ok(rolePermissions.admin.has(permissions.ADMIN_STATS));
  assert.ok(rolePermissions.manager.has(permissions.URL_CREATE)); // manager extends user perms
  assert.ok(rolePermissions.guest.has(permissions.URL_CREATE));
  assert.ok(rolePermissions.guest.has(permissions.URL_READ_OWN));
});

test('guest role has minimal permissions', () => {
  const guestPerms = rolePermissions.guest;
  assert.ok(guestPerms.has(permissions.URL_CREATE));
  assert.ok(guestPerms.has(permissions.URL_READ_OWN));
  assert.ok(!guestPerms.has(permissions.URL_EDIT_OWN));
  assert.ok(!guestPerms.has(permissions.ADMIN_STATS));
});

test('manager role extends user permissions', () => {
  const managerPerms = rolePermissions.manager;
  const userPerms = rolePermissions.user;

  // Manager should have all user permissions
  for (const perm of userPerms) {
    assert.ok(managerPerms.has(perm), `Manager should have ${perm}`);
  }
});