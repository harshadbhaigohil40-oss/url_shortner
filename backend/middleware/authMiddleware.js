const User = require("../models/User");
const { hashApiKey } = require('../utils/security');
const { enforceApiKeyRateLimit } = require('./rateLimiter');
const { verifyToken: verifyJwt } = require('../config/jwt-keyring');

const apiKeyRateLimit = (req, res, next) => {
  if (req.authMethod !== 'api-key' || !req.user) return next();
  return enforceApiKeyRateLimit(req.user, req, res, next);
};

const protect = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query && typeof req.query.token === 'string') {
    // Support EventSource / SSE streams where browser cannot set custom headers
    token = req.query.token;
  }

  // 1. Check for JWT Bearer token first (takes priority if present)
  if (token) {
    try {
      const decoded = verifyJwt(token);
      if (!decoded || decoded.type !== 'active') {
        return res.status(401).json({ message: "Not authorized, invalid token type" });
      }
      req.user = await User.findById(decoded.id).select("-password");
      if (!req.user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
      }
      if (req.user.lockUntil && req.user.lockUntil > new Date()) {
        return res.status(423).json({ message: "Account is temporarily locked. Please try again later or unlock your account." });
      }
      req.authMethod = 'jwt';
      return next();
    } catch (error) {
      // JWT verification failed
      // SECURITY: Do NOT fall through to API key - this prevents brute-force attacks
      // from using failed JWT attempts to probe API key authentication
      return res.status(401).json({ message: "Not authorized, invalid or expired token" });
    }
  }

  // 2. Check for API key (only if no Bearer token was provided)
  if (apiKey) {
    try {
      const user = await User.findOne({ apiKeyHash: hashApiKey(apiKey) }).select("-password +apiKeyHash");
      if (user) {
        if (user.lockUntil && user.lockUntil > new Date()) {
          return res.status(423).json({ message: "Account is temporarily locked. Please try again later." });
        }
        req.user = user;
        req.authMethod = 'api-key';
        // Asynchronously update API key metrics
        User.updateOne(
          { _id: user._id },
          { $set: { apiKeyLastUsed: new Date() }, $inc: { apiKeyRequestCount: 1 } }
        ).catch(err => console.error("Async API key usage update error:", err));

        return apiKeyRateLimit(req, res, next);
      } else {
        return res.status(401).json({ message: "Not authorized, invalid API key" });
      }
    } catch (error) {
      console.error("API key authentication failed", { code: error.name });
      return res.status(500).json({ message: "Server error during authentication" });
    }
  }

  return res.status(401).json({ message: "Not authorized, no valid token or API key provided" });
};

const optionalProtect = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query && typeof req.query.token === 'string') {
    // Support EventSource / SSE streams where browser cannot set custom headers
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = verifyJwt(token);
      if (decoded && decoded.type === 'active') {
        const user = await User.findById(decoded.id).select("-password");
        if (user && (!user.lockUntil || user.lockUntil <= new Date())) {
          req.user = user;
          req.authMethod = 'jwt';
          return next();
        }
      }
    } catch (error) {
      // Token invalid — continue as anonymous
    }
  }

  if (apiKey) {
    try {
      const user = await User.findOne({ apiKeyHash: hashApiKey(apiKey) }).select("-password +apiKeyHash");
      if (user && (!user.lockUntil || user.lockUntil <= new Date())) {
        req.user = user;
        req.authMethod = 'api-key';
        User.updateOne(
          { _id: user._id },
          { $set: { apiKeyLastUsed: new Date() }, $inc: { apiKeyRequestCount: 1 } }
        ).catch(err => console.error("Async API key usage update error:", err));
        return apiKeyRateLimit(req, res, next);
      }
    } catch (error) {
      // API key lookup failed — continue as anonymous
    }
  }

  // No valid auth — proceed as anonymous (req.user will be undefined)
  return next();
};

module.exports = { protect, optionalProtect, apiKeyRateLimit };
