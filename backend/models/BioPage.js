const mongoose = require("mongoose");

const bioLinkSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  icon: { type: String, default: "link" },
  isHighlighted: { type: Boolean, default: false },
  clicks: { type: Number, default: 0 }
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
  createdAt: { type: Date, default: Date.now, index: -1 }
});

module.exports = mongoose.model("BioPage", bioPageSchema);
