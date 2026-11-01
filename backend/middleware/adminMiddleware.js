const { requireRole } = require('./authorization');

const adminProtect = requireRole('admin');

module.exports = { adminProtect };
