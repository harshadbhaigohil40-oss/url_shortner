// Server-side JWT key ring with kid header support.
// Secrets are loaded from environment — never hardcoded or exposed in JWTs/logs.
const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return process.env.JWT_SECRET;
}

// Key ring: one active signing key + previous verification keys during transition period.
const KEY_RING = {
  active: { kid: 'v1', secret: getJwtSecret(), algorithm: 'HS256' },
  previous: []
};

// Promote a legacy key to 'previous' during rotation.
const addPreviousKey = (kid, secret) => {
  if (!kid || !secret) return;
  KEY_RING.previous.push({ kid, secret, algorithm: 'HS256' });
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
  const kid = decoded?.header?.kid;
  const candidateKeys = [];
  if (kid) {
    const match = KEY_RING.previous.find((k) => k.kid === kid);
    if (match) candidateKeys.push(match);
  }
  candidateKeys.push(KEY_RING.active);
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
  getKeyInfo,
  verifyToken
};