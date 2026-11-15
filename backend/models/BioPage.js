const mongoose = require("mongoose");

// Maximum click history entries per bio link to prevent document bloat
const MAX_BIO_LINK_CLICK_HISTORY = 100;

const bioClickHistorySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  referer: { type: String, default: "Direct / Email" },
  country: { type: String, default: "Unknown" }
}, { _id: false });

const bioLinkSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  icon: { type: String, default: "link" },
  isHighlighted: { type: Boolean, default: false },
  clicks: { type: Number, default: 0 },
  // Click history for analytics (limited to prevent bloat)
  clickHistory: {
    type: [bioClickHistorySchema],
    default: [],
    validate: {
      validator: (v) => !v || v.length <= MAX_BIO_LINK_CLICK_HISTORY,
      message: `Bio link click history cannot exceed ${MAX_BIO_LINK_CLICK_HISTORY} entries`
    }
  }
});

const bioPageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true
  },
  title: { type: String, required: true, default: "My Bio Page" },
  bio: { type: String, default: "" },
  avatarUrl: { type: String, default: "" },
  avatarStoragePath: { type: String, default: "", select: false },
  theme: {
    type: String,
    enum: ["glassmorphism", "dark-neon", "minimal-light", "cyberpunk", "sunset"],
    default: "glassmorphism"
  },
  socialLinks: {
    twitter: { type: String, default: "" },
    github: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    instagram: { type: String, default: "" },
    youtube: { type: String, default: "" },
    website: { type: String, default: "" }
  },
  links: [bioLinkSchema],
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete ret.avatarStoragePath;
      return ret;
    }
  },
  toObject: {
    transform: (doc, ret) => {
      delete ret.avatarStoragePath;
      return ret;
    }
  }
});

bioPageSchema.index({ createdAt: -1 });
bioPageSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("BioPage", bioPageSchema);
