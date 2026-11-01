const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { hashApiKey } = require('../utils/security');
const { enforceApiKeyRateLimit } = require('./rateLimiter');

const apiKeyRateLimit = (req, res, next) => {
  if (req.authMethod !== 'api-key' || !req.user) return next();
  return enforceApiKeyRateLimit(req.user, req, res, next);
};

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return process.env.JWT_SECRET;
};

const protect = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 1. Check for JWT Bearer token
  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      req.user = await User.findById(decoded.id).select("-password");
      if (req.user) {
        return next();
      }
    } catch (error) {
      console.warn("JWT authentication failed; falling back to API key if present", { code: error.name });
    }
  }

  // 2. Check for API key (via x-api-key header)
  if (apiKey) {
    try {
      const user = await User.findOne({ apiKeyHash: hashApiKey(apiKey) }).select("-password +apiKeyHash");
      if (user) {
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
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      req.user = await User.findById(decoded.id).select("-password");
      if (req.user) return next();
    } catch (error) {
      // Token invalid — continue as anonymous
    }
  }

  if (apiKey) {
    try {
      const user = await User.findOne({ apiKeyHash: hashApiKey(apiKey) }).select("-password +apiKeyHash");
      if (user) {
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
