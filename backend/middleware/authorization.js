// ── Permission Definitions ─────────────────────────────────────────────────
const permissions = Object.freeze({
  URL_CREATE: 'url:create',
  URL_READ_OWN: 'url:read:own',
  URL_EDIT_OWN: 'url:edit:own',
  URL_DELETE_OWN: 'url:delete:own',
  ANALYTICS_READ_OWN: 'analytics:read:own',
  ANALYTICS_STREAM: 'analytics:stream',
  BIO_CREATE: 'bio:create',
  BIO_READ_OWN: 'bio:read:own',
  BIO_EDIT_OWN: 'bio:edit:own',
  BIO_DELETE_OWN: 'bio:delete:own',
  ADMIN_STATS: 'admin:stats',
  ADMIN_MANAGE_USERS: 'admin:manage:users',
});

// ── Role → Permission Mapping ──────────────────────────────────────────────
const userPerms = new Set([
  permissions.URL_CREATE, permissions.URL_READ_OWN, permissions.URL_EDIT_OWN,
  permissions.URL_DELETE_OWN, permissions.ANALYTICS_READ_OWN, permissions.ANALYTICS_STREAM,
  permissions.BIO_CREATE, permissions.BIO_READ_OWN, permissions.BIO_EDIT_OWN, permissions.BIO_DELETE_OWN,
]);
const managerPerms = new Set([...userPerms]); // extend with manager-exclusive permissions here
const guestPerms = new Set([permissions.URL_CREATE, permissions.URL_READ_OWN]);
const rolePermissions = Object.freeze({
  user: userPerms,
  manager: managerPerms,
  guest: guestPerms,
  admin: new Set(Object.values(permissions)),
});

// ── Core Access Decision Functions ─────────────────────────────────────────
const hasPermission = (user, permission) => {
  if (!user || !permission) return false;
  if (rolePermissions[user.role]?.has(permission)) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes(permission)) return true;
  return false;
};

const isOwnerOrAdmin = (user, resource, ownerField = 'user') => {
  if (!user || !resource) return false;
  const owner = resource[ownerField]?._id || resource[ownerField];
  return String(owner) === String(user._id);
};

// ── Express Middleware Guards ──────────────────────────────────────────────
const requirePermission = (...requiredPermissions) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (requiredPermissions.some((p) => hasPermission(req.user, p))) return next();
  return res.status(403).json({ message: 'Forbidden — insufficient permissions' });
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (roles.includes(req.user.role)) return next();
  return res.status(403).json({ message: 'Forbidden — role not authorized' });
};

const requireOwner = (loadResource, ownerField = 'user') => async (req, res, next) => {
  try {
    const resource = await loadResource(req);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    if (!isOwnerOrAdmin(req.user, resource, ownerField)) {
      return res.status(403).json({ message: 'Forbidden — you do not own this resource' });
    }
    req.resource = resource;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { permissions, rolePermissions, hasPermission, isOwnerOrAdmin, requirePermission, requireRole, requireOwner };
