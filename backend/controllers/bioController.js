const BioPage = require("../models/BioPage");
const AuditLog = require("../models/AuditLog");
const { LRUCache } = require("lru-cache");

const bioCacheMetrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  get size() {
    return bioCache.size;
  },
  get hitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : Number((this.hits / total).toFixed(4));
  }
};

const bioCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 30, // 30 minutes
  dispose: (value, key, reason) => {
    if (reason === 'evict') {
      bioCacheMetrics.evictions++;
    }
  }
});

const RESERVED_BIO_SLUGS = new Set(['admin', 'api', 'dashboard', 'settings', 'create', 'edit', 'delete', 'my', 'public']);

// Create BioPage
exports.createBioPage = async (req, res) => {
  try {
    const { slug, title, bio, avatarUrl, theme, socialLinks, links } = req.body;
    const userId = req.user._id;

    if (!slug || !title) {
      return res.status(400).json({ message: "Slug and title are required." });
    }

    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
    
    if (RESERVED_BIO_SLUGS.has(cleanSlug)) {
      return res.status(400).json({ message: `The bio handle '${cleanSlug}' is a reserved system keyword.` });
    }
    
    const existing = await BioPage.findOne({ slug: cleanSlug });
    if (existing) {
      return res.status(400).json({ message: "This bio page URL handle is already taken." });
    }

    const newBioPage = await BioPage.create({
      user: userId,
      slug: cleanSlug,
      title,
      bio: bio || "",
      avatarUrl: avatarUrl || "",
      theme: theme || "glassmorphism",
      socialLinks: socialLinks || {},
      links: links || []
    });

    bioCache.set(cleanSlug, newBioPage.toObject());

    await AuditLog.create({
      action: "CREATE_BIOPAGE",
      userEmail: req.user.email,
      status: "success",
      ipAddress: req.ip,
      details: `Created bio page slug: ${cleanSlug}`
    });

    res.status(201).json(newBioPage);
  } catch (error) {
    console.error("Create BioPage Error:", error);
    res.status(500).json({ message: "Server error creating bio page" });
  }
};

// Get User BioPages
exports.getUserBioPages = async (req, res) => {
  try {
    const userId = req.user._id;
    const bioPages = await BioPage.find({ user: userId }).sort({ createdAt: -1 });
    res.json(bioPages);
  } catch (error) {
    res.status(500).json({ message: "Server error fetching bio pages" });
  }
};

// Get Public BioPage by Slug
exports.getPublicBioPage = async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = slug.toLowerCase().trim();

    // Check LRU Cache
    const cached = bioCache.get(cleanSlug);
    if (cached) {
      bioCacheMetrics.hits++;
      // Async view increment in DB & memory cache sync
      BioPage.updateOne({ slug: cleanSlug }, { $inc: { views: 1 } }).catch(() => {});
      cached.views = (cached.views || 0) + 1;
      bioCache.set(cleanSlug, cached);
      return res.json(cached);
    }

    bioCacheMetrics.misses++;

    const bioPage = await BioPage.findOne({ slug: cleanSlug });
    if (!bioPage) {
      return res.status(404).json({ message: "Bio page not found" });
    }

    bioPage.views += 1;
    await bioPage.save();

    bioCache.set(cleanSlug, bioPage.toObject());

    res.json(bioPage);
  } catch (error) {
    res.status(500).json({ message: "Server error loading bio page" });
  }
};

// Update BioPage
exports.updateBioPage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, bio, avatarUrl, theme, socialLinks, links, slug } = req.body;
    const userId = req.user._id;

    const bioPage = await BioPage.findOne({ _id: id, user: userId });
    if (!bioPage) {
      return res.status(404).json({ message: "Bio page not found or unauthorized" });
    }

    if (slug && slug !== bioPage.slug) {
      const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
      if (RESERVED_BIO_SLUGS.has(cleanSlug)) {
        return res.status(400).json({ message: `The bio handle '${cleanSlug}' is a reserved system keyword.` });
      }
      const existing = await BioPage.findOne({ slug: cleanSlug, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ message: "This bio page handle is already taken." });
      }
      bioCache.delete(bioPage.slug);
      bioPage.slug = cleanSlug;
    }

    if (title !== undefined) bioPage.title = title;
    if (bio !== undefined) bioPage.bio = bio;
    if (avatarUrl !== undefined) bioPage.avatarUrl = avatarUrl;
    if (theme !== undefined) bioPage.theme = theme;
    if (socialLinks !== undefined) bioPage.socialLinks = socialLinks;
    if (links !== undefined) bioPage.links = links;

    await bioPage.save();
    bioCache.set(bioPage.slug, bioPage.toObject());

    res.json(bioPage);
  } catch (error) {
    console.error("Update BioPage Error:", error);
    res.status(500).json({ message: "Server error updating bio page" });
  }
};

// Delete BioPage
exports.deleteBioPage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const bioPage = await BioPage.findOneAndDelete({ _id: id, user: userId });
    if (!bioPage) {
      return res.status(404).json({ message: "Bio page not found or unauthorized" });
    }

    bioCache.delete(bioPage.slug);

    res.json({ message: "Bio page deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error deleting bio page" });
  }
};

// Track Sub-link Click
exports.trackLinkClick = async (req, res) => {
  try {
    const { slug, linkId } = req.params;
    const cleanSlug = slug.toLowerCase().trim();

    // Get referer and country for analytics
    let referer = "Direct / Email";
    const rawReferer = req.headers['referer'] || req.headers['referrer'];
    if (rawReferer) {
      try {
        const urlObj = new URL(rawReferer);
        referer = urlObj.hostname.replace('www.', '');
      } catch {
        referer = rawReferer;
      }
    }

    // Get client IP for geo lookup
    let country = "Unknown";
    const geoip = require("geoip-lite");
    let ip = req.ip || req.socket.remoteAddress || "";
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
    const geo = geoip.lookup(ip);
    if (geo) country = geo.country;

    // Increment click count and add to click history (with slice to limit)
    const clickHistoryEntry = {
      timestamp: new Date(),
      referer,
      country
    };

    await BioPage.updateOne(
      { slug: cleanSlug, "links._id": linkId },
      {
        $inc: { "links.$.clicks": 1 },
        $push: { "links.$.clickHistory": { $each: [clickHistoryEntry], $slice: -100 } }
      }
    );

    bioCache.delete(cleanSlug);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error tracking link click" });
  }
};

exports.getBioCacheMetrics = () => ({
  size: bioCacheMetrics.size,
  hits: bioCacheMetrics.hits,
  misses: bioCacheMetrics.misses,
  evictions: bioCacheMetrics.evictions,
  hitRate: bioCacheMetrics.hitRate
});
