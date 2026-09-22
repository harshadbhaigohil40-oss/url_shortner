const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  // 1. Check for JWT Bearer token
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
      req.user = await User.findById(decoded.id).select("-password");
      if (req.user) {
        return next();
      }
    } catch (error) {
      console.warn("JWT Auth failed, falling back to API Key check if present:", error.message);
    }
  }

  // 2. Check for API key (via x-api-key header)
  if (apiKey) {
    try {
      const user = await User.findOne({ apiKey }).select("-password");
      if (user) {
        req.user = user;
        // Asynchronously update API key metrics
        User.updateOne(
          { _id: user._id },
          { $set: { apiKeyLastUsed: new Date() }, $inc: { apiKeyRequestCount: 1 } }
        ).catch(err => console.error("Async API key usage update error:", err));

        return next();
      } else {
        return res.status(401).json({ message: "Not authorized, invalid API key" });
      }
    } catch (error) {
      console.error("API Key Auth failed:", error);
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
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
      req.user = await User.findById(decoded.id).select("-password");
      if (req.user) return next();
    } catch (error) {
      // Token invalid — continue as anonymous
    }
  }

  if (apiKey) {
    try {
      const user = await User.findOne({ apiKey }).select("-password");
      if (user) {
        req.user = user;
        User.updateOne(
          { _id: user._id },
          { $set: { apiKeyLastUsed: new Date() }, $inc: { apiKeyRequestCount: 1 } }
        ).catch(err => console.error("Async API key usage update error:", err));
        return next();
      }
    } catch (error) {
      // API key lookup failed — continue as anonymous
    }
  }

  // No valid auth — proceed as anonymous (req.user will be undefined)
  return next();
};

module.exports = { protect, optionalProtect };
