const mongoose = require("mongoose");

// Maximum click history entries to prevent document bloat (16MB BSON limit)
const MAX_CLICK_HISTORY = 500;

const clickHistoryEntrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  browser: { type: String, default: "Unknown" },
  os: { type: String, default: "Unknown" },
  country: { type: String, default: "Unknown" },
  referer: { type: String, default: "Direct / Email" },
  servedUrl: { type: String, default: null }
}, { _id: false });

const urlSchema = new mongoose.Schema({
  longUrl: { type: String, required: true },
  shortCode: { type: String, required: true, unique: true, index: true },
  title: { type: String, default: null },
  favicon: { type: String, default: null },
  clicks: { type: Number, default: 0 },
  clickHistory: {
    type: [clickHistoryEntrySchema],
    default: [],
    validate: {
      validator: (v) => !v || v.length <= MAX_CLICK_HISTORY,
      message: `Click history cannot exceed ${MAX_CLICK_HISTORY} entries`
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  password: { type: String, default: null }, // Hashed password for protected links
  isOneTime: { type: Boolean, default: false }, // Burn-after-reading setting (one-time redirection)
  isActive: { type: Boolean, default: true }, // Ability to disable links
  ogTitle: { type: String, default: null }, // Customized social preview title
  ogDescription: { type: String, default: null }, // Customized social preview description
  ogImage: { type: String, default: null }, // Customized social preview image URL
  iphoneUrl: { type: String, default: null }, // Device targeting: iOS redirect link
  androidUrl: { type: String, default: null }, // Device targeting: Android redirect link
  webhookUrl: { type: String, default: null }, // Real-time click notification webhook URL
  maxClicks: { type: Number, default: null }, // Maximum clicks allowed before link deactivation
  fallbackUrl: { type: String, default: null }, // Redirect destination if link is expired, disabled, or limit reached
  splashMessage: { type: String, default: null }, // Interstitial custom brand splash message
  splashDelay: { type: Number, default: null }, // Interstitial custom brand redirect delay in seconds
  abTestTargets: [{
    url: { type: String, required: true },
    weight: { type: Number, required: true, min: 0, max: 100 }
  }],
  geoTargets: [{
    country: { type: String, required: true }, // Country code, e.g. US, GB, IN
    url: { type: String, required: true } // Redirect URL for this country
  }],
  deepLinkScheme: { type: String, default: null }, // Custom mobile app URI scheme e.g. myapp://product/123
  aiSummary: { type: String, default: null }, // AI-generated content summary
  aiSafetyScore: { type: Number, default: null }, // AI safety score (0-100)
  aiTags: [{ type: String }], // AI content topic tags
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: { expires: 0 } } // TTL index for auto-deletion of expired links
});

urlSchema.index({ createdAt: -1 });
urlSchema.index({ user: 1, createdAt: -1 });
urlSchema.index({ user: 1, clicks: -1 });
// Composite index for dashboard queries
urlSchema.index({ user: 1, isActive: 1, createdAt: -1 });
// Fast-path index for redirect lookup
urlSchema.index({ shortCode: 1, isActive: 1 });

module.exports = mongoose.model("Url", urlSchema);
