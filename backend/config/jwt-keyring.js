// Server-side JWT key ring with kid header support.
// Secrets are loaded from environment — never hardcoded or exposed in JWTs/logs.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'test') {
    return 'ci-test-jwt-secret-key-at-least-32-characters-long';
  }
  throw new Error('JWT_SECRET is required');
};

// Generate a secure random key ID (kid) for JWT tokens
const generateKid = () => crypto.randomBytes(8).toString('hex');

// Key ring: one active signing key + previous verification keys during transition period.
// Supports configured initial JWT_KEY_ID (min 16 chars) or generates a secure 16-hex kid.
const KEY_RING = {
  active: {
    kid: (process.env.JWT_KEY_ID && process.env.JWT_KEY_ID.length >= 16) ? process.env.JWT_KEY_ID : generateKid(),
    secret: getJwtSecret(),
    algorithm: 'HS256',
    rotatedAt: Date.now()
  },
  previous: []
};

// Promote a legacy key to 'previous' during rotation.
const addPreviousKey = (kid, secret) => {
  if (!kid || !secret) return;
  KEY_RING.previous.push({ kid, secret, algorithm: 'HS256', rotatedAt: Date.now() });
  // Keep max 5 previous keys to prevent unbounded growth
  if (KEY_RING.previous.length > 5) {
    KEY_RING.previous = KEY_RING.previous.slice(-5);
  }
};

// Rotate the active key during secret rotation.
// Optionally promote the old key to previous keys.
// Returns the new kid.
const setActiveKey = (newSecret, promoteOld = true) => {
  if (!newSecret) throw new Error('New secret is required for key rotation');

  // Promote current active key to previous before rotating
  if (promoteOld) {
    // Create a copy of the old active key with its current kid
    const oldActiveCopy = { ...KEY_RING.active };
    // Update active key with new secure kid and secret
    KEY_RING.active = {
      kid: generateKid(),
      secret: newSecret,
      algorithm: 'HS256',
      rotatedAt: Date.now()
    };
    // Put old active at front of previous array
    KEY_RING.previous = [oldActiveCopy, ...KEY_RING.previous.slice(-4)];
  } else {
    // Just update in place (hot-reload)
    KEY_RING.active = {
      kid: generateKid(),
      secret: newSecret,
      algorithm: 'HS256',
      rotatedAt: Date.now()
    };
  }

  return KEY_RING.active.kid;
};

// Update the active key's secret without promoting (for hot-reload)
const updateActiveSecret = (newSecret) => {
  if (!newSecret) throw new Error('New secret is required');
  KEY_RING.active.secret = newSecret;
};

// Get public key info (kid) without exposing secrets.
const getKeyInfo = () => ({
  activeKid: KEY_RING.active.kid,
  previousKIDs: KEY_RING.previous.map((k) => k.kid)
});

// Minimal decode helpers to inspect header without verification (for kid extraction).
const jwtDecode = (token) => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  try {
    const base64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    throw new Error('Invalid JWT header');
  }
};

const jwtVerify = (token, secret, options) => {
  // Use jsonwebtoken's verify with strict algorithm allowlist
  return jwt.verify(token, secret, { algorithms: ['HS256'], ...options });
};

// Verify a JWT using the key ring with strict algorithm allowlisting.
// Returns decoded payload or throws.
const verifyToken = (token) => {
  const decoded = jwtDecode(token);
  const kid = decoded?.kid || decoded?.header?.kid;
  const candidateKeys = [];
  if (kid) {
    if (KEY_RING.active.kid === kid) {
      candidateKeys.push(KEY_RING.active);
    } else {
      const match = KEY_RING.previous.find((k) => k.kid === kid);
      if (match) candidateKeys.push(match);
    }
  }
  if (!candidateKeys.includes(KEY_RING.active)) {
    candidateKeys.push(KEY_RING.active);
  }
  for (const prev of KEY_RING.previous) {
    if (!candidateKeys.includes(prev)) candidateKeys.push(prev);
  }

  let lastError = null;
  for (const key of candidateKeys) {
    try {
      const payload = jwtVerify(token, key.secret, { algorithms: ['HS256'] });
      return payload;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Token verification failed');
};

module.exports = {
  KEY_RING,
  addPreviousKey,
  setActiveKey,
  updateActiveSecret,
  getKeyInfo,
  verifyToken
};