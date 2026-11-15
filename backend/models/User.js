const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: false
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'manager', 'guest'],
    default: 'user'
  },
  permissions: [{ type: String, trim: true }],
  otp: {
    type: String
  },
  otpExpires: {
    type: Date
  },
  refreshTokens: [String],
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  passwordResetTokenHash: { type: String, default: null, select: false },
  passwordResetExpires: { type: Date, default: null, select: false },
  apiKey: {
    type: String,
    select: false
  },
  apiKeyHash: {
    type: String,
    select: false,
    index: true
  },
  apiKeyPrefix: {
    type: String,
    index: true
  },
  apiKeyCreatedAt: {
    type: Date,
    default: null
  },
  apiKeyLastUsed: {
    type: Date,
    default: null
  },
  apiKeyRequestCount: {
    type: Number,
    default: 0
  },
  apiKeyRateLimit: {
    type: Number,
    default: 1000
  },
  createdAt: { type: Date, default: Date.now }
});

// Index for querying active reset tokens (NOT TTL - TTL on User would delete the entire user account!)
userSchema.index({ passwordResetTokenHash: 1, passwordResetExpires: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.passwordNeedsRehash = function() {
  return Boolean(this.password && this.password.startsWith('$2') && Number.parseInt(this.password.slice(4, 6), 10) < 12);
};

module.exports = mongoose.model("User", userSchema);
