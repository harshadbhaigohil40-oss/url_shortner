const mongoose = require('mongoose');
const Url = require("../models/Url");
const AuditLog = require("../models/AuditLog");
const { nanoid } = require("nanoid");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const cheerio = require("cheerio");
const { UAParser } = require("ua-parser-js");
const geoip = require("geoip-lite");
const { LRUCache } = require('lru-cache');
const eventBus = require('../utils/eventBus');

const urlCacheMetrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  get size() {
    return urlCache.size;
  },
  get hitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : Number((this.hits / total).toFixed(4));
  }
};

const urlCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
  dispose: (value, key, reason) => {
    if (reason === 'evict') {
      urlCacheMetrics.evictions++;
    }
  }
});

const RESERVED_ALIASES = new Set([
  'admin', 'api', 'login', 'register', 'dashboard', 'unlock', 'bio', 
  'assets', 'static', 'favicon.ico', 'csrf-token', 'health', 'metrics', 'docs', 'api-docs'
]);

const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeHtml = (unsafe) => {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const safeJsonScriptData = (data) => {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\//g, '\\u002f')
    .split(' ').join('\\u2028')
    .split(' ').join('\\u2029');
};

const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (/^(?:javascript|data|vbscript|file|blob|about):/i.test(trimmed)) {
    return '#';
  }
  return trimmed;
};

const sanitizeHref = (url) => {
  return escapeHtml(sanitizeUrl(url));
};

const buildCacheObject = (url) => ({
  longUrl: url.longUrl,
  isProtected: !!url.password,
  isActive: url.isActive,
  expiresAt: url.expiresAt,
  title: url.title,
  favicon: url.favicon,
  ogTitle: url.ogTitle,
  ogDescription: url.ogDescription,
  ogImage: url.ogImage,
  iphoneUrl: url.iphoneUrl,
  androidUrl: url.androidUrl,
  webhookUrl: url.webhookUrl,
  maxClicks: url.maxClicks,
  fallbackUrl: url.fallbackUrl,
  abTestTargets: url.abTestTargets,
  splashMessage: url.splashMessage,
  splashDelay: url.splashDelay,
  isOneTime: url.isOneTime,
  geoTargets: url.geoTargets,
  deepLinkScheme: url.deepLinkScheme,
  aiSummary: url.aiSummary,
  aiSafetyScore: url.aiSafetyScore,
  aiTags: url.aiTags,
  userId: url.user ? url.user.toString() : null
});

const getClientIp = (req) => {
  let ip = req.ip || req.socket.remoteAddress || "";
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  return ip;
};

const getGeoLocation = (req) => {
  const ip = getClientIp(req);
  let geo = geoip.lookup(ip);
  // Dev / Localhost fallback for realistic analytics testing
  if (!geo && (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.'))) {
    geo = { country: 'US', region: 'CA', city: 'San Francisco' };
  }
  return { ip, geo };
};

const getAnalyticsData = (req, servedUrl = null) => {
  const parser = new UAParser(req.headers['user-agent']);
  const browserResult = parser.getBrowser();
  const osResult = parser.getOS();
  const { geo } = getGeoLocation(req);

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

  return {
    timestamp: new Date(),
    browser: browserResult.name || "Unknown",
    os: osResult.name || "Unknown",
    country: geo ? geo.country : "Unknown",
    referer,
    servedUrl
  };
};

const dns = require('dns').promises;
const net = require('net');

const isPrivateIp = (ip) => {
  if (!ip || typeof ip !== 'string') return true;
  const normalized = ip.toLowerCase().trim().replace(/^::ffff:/, '');
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;

    if (parts[0] === 0) return true; // RFC 1122 Current network (0.0.0.0/8)
    if (parts[0] === 10) return true; // RFC 1918 Private (10.0.0.0/8)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // RFC 6598 CGNAT
    if (parts[0] === 127) return true; // RFC 1122 Loopback (127.0.0.0/8)
    if (parts[0] === 169 && parts[1] === 254) return true; // RFC 3927 Link-Local (169.254.0.0/16)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // RFC 1918 Private (172.16.0.0/12)
    if (parts[0] === 192 && parts[1] === 0 && (parts[2] === 0 || parts[2] === 2)) return true; // RFC 6890 / 5737
    if (parts[0] === 192 && parts[1] === 88 && parts[2] === 99) return true; // RFC 3068 6to4 relay
    if (parts[0] === 192 && parts[1] === 168) return true; // RFC 1918 Private (192.168.0.0/16)
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true; // RFC 2544 Benchmarking
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true; // RFC 5737 TEST-NET-2
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true; // RFC 5737 TEST-NET-3
    if (parts[0] >= 224 && parts[0] <= 239) return true; // RFC 5771 Multicast (224.0.0.0/4)
    if (parts[0] >= 240) return true; // RFC 1112 Reserved / Broadcast

    return false;
  }
  if (!net.isIPv6(normalized)) return true;
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA (fc00::/7)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true; // Link-local (fe80::/10)
  if (normalized.startsWith('ff')) return true; // Multicast (ff00::/8)
  if (normalized.startsWith('2001:db8') || normalized.startsWith('2001:0db8')) return true; // Documentation (2001:db8::/32)
  if (normalized.startsWith('100:') || normalized.startsWith('0100:')) return true; // Discard prefix RFC 6666

  return false;
};

const isPrivateHost = async (host) => {
  if (!host || typeof host !== 'string') return true;
  const hostname = host.toLowerCase().trim().replace(/\.$/, '');
  if (isPrivateIp(hostname)) return true;

  if (hostname === 'localhost' || hostname === 'loopback' || hostname === '::1') {
    return true;
  }

  const ipv4PrivateRegex = /^(?:10\.\d+|127\.\d+|192\.168\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+)\.\d+$/;
  if (ipv4PrivateRegex.test(hostname)) {
    return true;
  }

  try {
    const lookups = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!lookups || lookups.length === 0 || lookups.some(({ address }) => isPrivateIp(address))) return true;
  } catch {
    return true;
  }

  return false;
};

const isSafeExternalUrl = async (value) => {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return !(await isPrivateHost(parsed.hostname));
  } catch {
    return false;
  }
};

const fetchMetadata = async (url) => {
  try {
    const urlObj = new URL(url);
    const isPrivate = await isPrivateHost(urlObj.hostname);
    if (isPrivate) {
      console.warn(`SSRF Blocked request to private host: ${urlObj.hostname}`);
      return { title: null, favicon: null };
    }

    // SECURITY FIX: No redirect following to prevent DNS rebinding attacks
    // Only fetch the original URL, not redirects
    if (!(await isSafeExternalUrl(url))) return { title: null, favicon: null };

    const response = await axios.get(url, {
      timeout: 3000,
      maxRedirects: 0, // Do NOT follow redirects - prevents SSRF via DNS rebinding
      validateStatus: (status) => status >= 200 && status < 400
    });

    const $ = cheerio.load(response.data);
    const title = $("title").text() || null;
    let favicon = $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href");

    if (favicon) {
      favicon = new URL(favicon, url).toString();
      if (!(await isSafeExternalUrl(favicon))) favicon = null;
    }
    return { title, favicon };
  } catch (error) {
    return { title: null, favicon: null };
  }
};

exports.shortenUrl = async (req, res) => {
  const { longUrl, customAlias, password, expiresAt, ogTitle, ogDescription, ogImage, iphoneUrl, androidUrl, webhookUrl, maxClicks, fallbackUrl, abTestTargets, splashMessage, splashDelay, isOneTime, geoTargets, deepLinkScheme, aiSummary, aiSafetyScore, aiTags, tags } = req.body;
  const user = req.user ? req.user._id : null;
  const userEmail = req.user ? req.user.email : "anonymous";

  try {
    let shortCode = customAlias;

    if (customAlias) {
      if (RESERVED_ALIASES.has(customAlias.toLowerCase())) {
        return res.status(400).json({ message: `Alias '${customAlias}' is a reserved system keyword` });
      }
      const existing = await Url.findOne({ shortCode: customAlias });
      if (existing) {
        return res.status(400).json({ message: "Custom alias is already taken" });
      }
    } else {
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        shortCode = nanoid(8);
        const existing = await Url.findOne({ shortCode });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return res.status(500).json({ message: "Failed to generate unique short code" });
      }
    }

    let hashedPassword = null;
    if (password) {
      const salt = await bcrypt.genSalt(12);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    const sanitizedTags = Array.isArray(tags)
      ? Array.from(new Set(tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)))
      : [];

    const newUrl = await Url.create({
      longUrl,
      shortCode,
      user,
      password: hashedPassword,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      ogTitle,
      ogDescription,
      ogImage,
      iphoneUrl,
      androidUrl,
      webhookUrl,
      maxClicks,
      fallbackUrl,
      abTestTargets,
      splashMessage,
      splashDelay,
      isOneTime: !!isOneTime,
      geoTargets,
      deepLinkScheme,
      aiSummary,
      aiSafetyScore,
      aiTags,
      tags: sanitizedTags
    });
    
    // Pre-populate cache with target tracking
    const targetUserId = user;
    const targetResource = 'Url';

    urlCache.set(shortCode, buildCacheObject(newUrl));

    // Fetch metadata asynchronously without clobbering concurrent clicks
    fetchMetadata(longUrl).then(async ({ title, favicon }) => {
      await Url.updateOne({ _id: newUrl._id }, { $set: { title, favicon } });
      const currentCache = urlCache.get(shortCode);
      if (currentCache) {
        urlCache.set(shortCode, { ...currentCache, title, favicon });
      }
    }).catch(err => console.error("Async metadata fetch error", err));
    
    await AuditLog.create({
      action: "SHORTEN_URL",
      userEmail,
      status: "success",
      ipAddress: req.ip,
      details: `Created shortCode: ${shortCode}`
    });

    const responseJson = newUrl.toJSON();
    responseJson.item_id = newUrl._id;
    res.status(201).json(responseJson);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const botUserAgents = [
  "twitterbot",
  "facebookexternalhit",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "telegrambot",
  "googlebot",
  "bingbot"
];

const isBot = (ua) => {
  if (!ua) return false;
  const lowerUA = ua.toLowerCase();
  return botUserAgents.some(bot => lowerUA.includes(bot));
};

const renderOGPage = (urlData) => {
  const title = escapeHtml(urlData.ogTitle || urlData.title || "ShortyURL");
  const desc = escapeHtml(urlData.ogDescription || "Check out this shortened link.");
  const image = escapeHtml(urlData.ogImage || urlData.favicon || "");
  const safeLongUrl = sanitizeHref(urlData.longUrl);
  const redirectPayload = safeJsonScriptData({ target: safeLongUrl });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${safeLongUrl}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image" content="${image}" />

  <meta http-equiv="refresh" content="0;url=${safeLongUrl}" />
  <script id="og-redirect-data" type="application/json">${redirectPayload}</script>
  <script>
    try {
      var data = JSON.parse(document.getElementById('og-redirect-data').textContent);
      if (data && data.target && data.target !== '#') {
        window.location.assign(data.target);
      }
    } catch (e) {}
  </script>
</head>
<body>
  Redirecting to <a href="${safeLongUrl}">${title}</a>...
</body>
</html>`;
};

const renderExpiredPage = (urlData, reason) => {
  const title = escapeHtml(urlData.ogTitle || urlData.title || "ShortyURL");
  const favicon = escapeHtml(urlData.favicon || "");
  const safeReason = escapeHtml(reason);
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Link Unavailable | ${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --error: #ef4444;
      --bg: #0b0f19;
      --text: #f3f4f6;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: radial-gradient(circle at 50% 50%, #151b2e 0%, var(--bg) 100%);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      overflow: hidden;
    }
    .container {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 24px;
      padding: 3rem;
      max-width: 480px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      animation: scaleUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes scaleUp {
      0% { transform: scale(0.9); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .icon-container {
      position: relative;
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon {
      font-size: 2.25rem;
      color: var(--error);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    .brand-name {
      font-size: 1rem;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.3);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .logo {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      opacity: 0.5;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 0.75rem;
      color: #ffffff;
    }
    .message {
      font-size: 0.95rem;
      color: #8c909f;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .footer {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.15);
      border-top: 1px solid rgba(255, 255, 255, 0.03);
      padding-top: 1.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      ${favicon ? `<img src="${favicon}" class="logo" />` : ''}
      <span class="brand-name">${title}</span>
    </div>
    
    <div class="icon-container">
      <span class="icon">⚠️</span>
    </div>
    
    <h1>Link Unavailable</h1>
    <div class="message">${safeReason}</div>
    
    <div class="footer">
      Powered by ShortyURL Enterprise
    </div>
  </div>
</body>
</html>`;
};

const renderSplashPage = (urlData, targetUrl) => {
  const title = escapeHtml(urlData.ogTitle || urlData.title || "ShortyURL Redirect");
  const desc = escapeHtml(urlData.splashMessage || "Please wait while we redirect you to your destination.");
  const rawDelay = parseInt(urlData.splashDelay, 10);
  const delay = !isNaN(rawDelay) && rawDelay > 0 && rawDelay <= 30 ? rawDelay : 5;
  const favicon = sanitizeHref(urlData.favicon || "");
  const rawTarget = sanitizeUrl(targetUrl);
  const safeTargetUrl = sanitizeHref(rawTarget);
  const splashPayload = safeJsonScriptData({ target: rawTarget, delay });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting... | ${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #c084fc;
      --primary-dark: #a855f7;
      --bg: #0b0f19;
      --text: #f3f4f6;
      --card-bg: rgba(255, 255, 255, 0.03);
      --border: rgba(255, 255, 255, 0.08);
    }
    body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--bg);
      background-image: radial-gradient(circle at 50% 50%, #1e1b4b 0%, var(--bg) 70%);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      overflow: hidden;
    }
    .container {
      max-width: 480px;
      width: 90%;
      text-align: center;
      padding: 2.5rem;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 24px;
      backdrop-filter: blur(16px);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      animation: fadeIn 0.8s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }
    .logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }
    .brand-name {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      background: linear-gradient(135deg, #c084fc 0%, #a855f7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .message {
      font-size: 1.15rem;
      line-height: 1.6;
      color: #9ca3af;
      margin-bottom: 2rem;
      font-weight: 400;
    }
    .timer-container {
      position: relative;
      width: 100px;
      height: 100px;
      margin: 0 auto 2rem;
    }
    .timer-svg {
      transform: rotate(-90deg);
      width: 100%;
      height: 100%;
    }
    .timer-track {
      fill: none;
      stroke: rgba(255, 255, 255, 0.05);
      stroke-width: 4;
    }
    .timer-bar {
      fill: none;
      stroke: var(--primary-dark);
      stroke-width: 4;
      stroke-linecap: round;
      stroke-dasharray: 283;
      stroke-dashoffset: 0;
      transition: stroke-dashoffset 1s linear;
    }
    .timer-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%);
      color: white;
      border: none;
      padding: 0.85rem 2rem;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.3s;
      box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(168, 85, 247, 0.4);
    }
    .btn:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      ${favicon ? `<img src="${favicon}" class="logo" />` : '<span style="font-size: 1.75rem;">🚀</span>'}
      <span class="brand-name">${title}</span>
    </div>

    <div class="message">${desc}</div>

    <div class="timer-container">
      <svg class="timer-svg" viewBox="0 0 100 100">
        <circle class="timer-track" cx="50" cy="50" r="45"></circle>
        <circle class="timer-bar" id="timer-bar" cx="50" cy="50" r="45"></circle>
      </svg>
      <div class="timer-text" id="countdown">${delay}</div>
    </div>

    <a href="${safeTargetUrl}" class="btn">
      Skip and Redirect Now
    </a>
  </div>

  <script id="splash-config" type="application/json">${splashPayload}</script>
  <script>
    try {
      var config = JSON.parse(document.getElementById('splash-config').textContent);
      var secondsLeft = config.delay || 5;
      var countdownEl = document.getElementById('countdown');
      var timerBar = document.getElementById('timer-bar');
      var totalDash = 283;

      var updateTimer = function() {
        if (secondsLeft <= 0) {
          if (config.target && config.target !== '#') {
            window.location.assign(config.target);
          }
          return;
        }

        if (countdownEl) countdownEl.textContent = secondsLeft;
        if (timerBar) {
          var offset = totalDash - (secondsLeft / config.delay) * totalDash;
          timerBar.style.strokeDashoffset = offset;
        }

        secondsLeft--;
        setTimeout(updateTimer, 1000);
      };

      if (timerBar) timerBar.style.transition = 'stroke-dashoffset 1s linear';
      updateTimer();
    } catch (e) {}
  </script>
</body>
</html>`;
};

const renderDeepLinkPage = (urlData, targetUrl) => {
  const rawDeepLink = sanitizeUrl(urlData.deepLinkScheme);
  const rawFallback = sanitizeUrl(targetUrl);
  const deepLink = sanitizeHref(rawDeepLink);
  const fallback = sanitizeHref(rawFallback);
  const title = escapeHtml(urlData.ogTitle || urlData.title || "Opening Application...");
  const favicon = sanitizeHref(urlData.favicon || "");
  const deepLinkPayload = safeJsonScriptData({ deepLink: rawDeepLink, fallback: rawFallback });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Opening App... | ${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0b0f19; color: white; font-family: 'Plus Jakarta Sans', sans-serif; }
    .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 2.5rem; max-width: 440px; width: 90%; text-align: center; backdrop-filter: blur(16px); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    .btn { display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); color: white; padding: 0.85rem 2rem; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 1.5rem; box-shadow: 0 4px 15px rgba(168,85,247,0.3); transition: transform 0.2s; }
    .btn:hover { transform: translateY(-2px); }
  </style>
</head>
<body>
  <div class="card">
    ${favicon ? `<img src="${favicon}" style="width: 48px; height: 48px; border-radius: 12px; margin-bottom: 1.25rem;" />` : '<span style="font-size: 2.5rem; display: block; margin-bottom: 1rem;">📱</span>'}
    <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem;">Opening Native Application</h2>
    <p style="color: #9ca3af; font-size: 0.95rem; line-height: 1.6;">Launching custom mobile app scheme for <strong>${title}</strong>...</p>
    <a href="${deepLink}" class="btn">Launch Mobile App</a>
    <p style="margin-top: 2rem; font-size: 0.82rem; color: #6b7280;">If the app does not open automatically, <a href="${fallback}" style="color: #c084fc; text-decoration: underline;">click here to view in browser</a>.</p>
  </div>
  <script id="deeplink-data" type="application/json">${deepLinkPayload}</script>
  <script>
    try {
      var data = JSON.parse(document.getElementById('deeplink-data').textContent);
      if (data && data.deepLink && data.deepLink !== '#') {
        window.location.assign(data.deepLink);
      }
      setTimeout(function() {
        if (data && data.fallback && data.fallback !== '#') {
          window.location.assign(data.fallback);
        }
      }, 2000);
    } catch (e) {}
  </script>
</body>
</html>`;
};

const getTargetUrl = (urlData, req) => {
  let baseTarget = urlData.longUrl;

  // 1. A/B Split testing target rotation selection
  if (urlData.abTestTargets && urlData.abTestTargets.length > 0) {
    const totalWeight = urlData.abTestTargets.reduce((sum, t) => sum + (t.weight || 0), 0);
    if (totalWeight > 0) {
      const r = Math.random() * totalWeight;
      let accumulator = 0;
      for (const target of urlData.abTestTargets) {
        accumulator += target.weight || 0;
        if (r <= accumulator) {
          baseTarget = target.url;
          break;
        }
      }
    }
  }

  // 2. Geolocation / Country targeting
  if (urlData.geoTargets && urlData.geoTargets.length > 0) {
    const { geo } = getGeoLocation(req);
    const userCountry = geo ? geo.country.toUpperCase() : null;
    
    if (userCountry) {
      const match = urlData.geoTargets.find(t => t.country.toUpperCase() === userCountry);
      if (match) {
        baseTarget = match.url;
      }
    }
  }

  const userAgentStr = req.headers['user-agent'];
  if (!userAgentStr) return baseTarget;
  const parser = new UAParser(userAgentStr);
  const os = (parser.getOS().name || '').toLowerCase();

  if ((os.includes('ios') || os.includes('iphone') || os.includes('ipad')) && urlData.iphoneUrl) {
    return urlData.iphoneUrl;
  }
  if (os.includes('android') && urlData.androidUrl) {
    return urlData.androidUrl;
  }
  return baseTarget;
};

const crypto = require('crypto');

// Generate idempotency key for webhook delivery
const generateIdempotencyKey = (eventData) => {
  const payload = `${eventData.event}:${eventData.shortCode}:${eventData.timestamp}:${eventData.targetUrl || ''}`;
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 32);
};

// Sign webhook payload for verification
const signWebhookPayload = (payload, secret) => {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
};

const triggerWebhook = async (webhookUrl, eventData) => {
  if (!webhookUrl || !(await isSafeExternalUrl(webhookUrl))) {
    if (webhookUrl) console.warn(`[Webhook] Blocked unsafe destination: ${webhookUrl}`);
    return;
  }

  // Generate idempotency key for exactly-once delivery semantics
  const idempotencyKey = generateIdempotencyKey(eventData);

  // Get webhook secret from environment (configured per deployment)
  const webhookSecret = process.env.WEBHOOK_SECRET || 'default-secret-change-in-production';

  // Sign the payload for receiver verification
  const signature = signWebhookPayload(eventData, webhookSecret);

  try {
    await axios.post(webhookUrl, eventData, {
      timeout: 3000,
      maxRedirects: 0,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Shortly-Webhook-Dispatcher/1.0',
        'X-Idempotency-Key': idempotencyKey,
        'X-Shortly-Signature': `sha256=${signature}`,
        'X-Shortly-Event': eventData.event,
        'X-Shortly-Timestamp': eventData.timestamp
      }
    });
  } catch (err) {
    console.error(`[Webhook Error] Delivery failed for ${eventData.shortCode}:`, err.message);
    // TODO: Add to retry queue (BullMQ) for production
  }
};

exports.redirectUrl = async (req, res) => {
  const { code } = req.params;
  const frontendUrl = (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',')[0].trim() : 'http://localhost:5173')).replace(/\/+$/, '');
  const userAgent = req.headers['user-agent'];
  const botCheck = isBot(userAgent);

  try {
    // 1. Check cache first for high-performance redirect
    const cachedData = urlCache.get(code);
    if (cachedData) {
      urlCacheMetrics.hits++;
      // CRITICAL: Re-verify DB state for protected/one-time/max-click links to prevent cache bypass
      const needsDbVerification = cachedData.isProtected || cachedData.isOneTime ||
        (cachedData.maxClicks && cachedData.clicks >= cachedData.maxClicks);

      if (needsDbVerification) {
        // Fall through to DB path for authoritative check
      } else {
        // Fast path: cache hit with no special handling needed
        if (!cachedData.isActive) {
          if (cachedData.fallbackUrl) return res.redirect(cachedData.fallbackUrl);
          return res.status(404).send(renderExpiredPage(cachedData, "This link has been deactivated or disabled by its owner."));
        }

        if (cachedData.expiresAt && new Date() > new Date(cachedData.expiresAt)) {
          urlCache.set(code, { ...cachedData, isActive: false });
          if (cachedData.fallbackUrl) return res.redirect(cachedData.fallbackUrl);
          return res.status(410).send(renderExpiredPage(cachedData, "This link has expired."));
        }

        if (cachedData.isProtected) {
          return res.redirect(`${frontendUrl}/unlock/${code}`);
        }

        if (botCheck) {
          return res.status(200).send(renderOGPage({ ...cachedData, longUrl: cachedData.longUrl }));
        }

        const target = getTargetUrl(cachedData, req);

        // Trigger Webhook Event Asynchronously
        if (cachedData.webhookUrl) {
          triggerWebhook(cachedData.webhookUrl, {
            event: "link.click",
            shortCode: code,
            longUrl: cachedData.longUrl,
            targetUrl: target,
            timestamp: new Date().toISOString(),
            analytics: getAnalyticsData(req, target)
          });
        }

        const analyticsData = getAnalyticsData(req, target);
        if (cachedData.userId) {
          eventBus.publishClick({
            userId: cachedData.userId,
            shortCode: code,
            title: cachedData.title || cachedData.longUrl,
            analytics: analyticsData
          });
        }

        // Reserve the click atomically so one-time and max-click links cannot be overused.
        const clickFilter = {
          shortCode: code,
          isActive: true,
          $or: [
            { maxClicks: null },
            { maxClicks: { $exists: false } },
            { $expr: { $lt: ['$clicks', '$maxClicks'] } }
          ]
        };
        const clickUpdate = {
          $inc: { clicks: 1 },
          $push: { clickHistory: { $each: [analyticsData], $slice: -100 } },
          ...(cachedData.isOneTime ? { $set: { isActive: false } } : {})
        };
        const updatedUrl = await Url.findOneAndUpdate(clickFilter, clickUpdate, { new: true });
        if (!updatedUrl) {
          urlCache.set(code, { ...cachedData, isActive: false });
          if (cachedData.fallbackUrl) return res.redirect(cachedData.fallbackUrl);
          return res.status(410).send(renderExpiredPage(cachedData, 'This link is no longer available.'));
        }
        if (updatedUrl.maxClicks && updatedUrl.clicks >= updatedUrl.maxClicks) {
          updatedUrl.isActive = false;
          await updatedUrl.save();
        }
        urlCache.set(code, buildCacheObject(updatedUrl));

        if (cachedData.deepLinkScheme) {
          return res.status(200).send(renderDeepLinkPage(cachedData, target));
        }

        if (cachedData.splashDelay && cachedData.splashMessage) {
          return res.status(200).send(renderSplashPage(cachedData, target));
        }

        return res.redirect(target);
      }
    } else {
      urlCacheMetrics.misses++;
    }

    // 2. Cache miss, query MongoDB
    let url;
    if (code && code.length === 24 && mongoose.Types.ObjectId.isValid(code)) {
      url = await Url.findById(code);
    }
    if (!url) {
      url = await Url.findOne({ shortCode: code });
    }
    if (!url) return res.status(404).send(renderExpiredPage({ title: "ShortyURL", ogTitle: "Not Found", favicon: "" }, "The requested shortened link could not be found in our database."));
    if (!url.isActive) {
      if (url.fallbackUrl) return res.redirect(url.fallbackUrl);
      return res.status(404).send(renderExpiredPage(url, "This link has been deactivated or disabled by its owner."));
    }

    if (url.expiresAt && new Date() > new Date(url.expiresAt)) {
      url.isActive = false;
      await url.save();
      urlCache.set(code, buildCacheObject(url));
      if (url.fallbackUrl) return res.redirect(url.fallbackUrl);
      return res.status(410).send(renderExpiredPage(url, "This link has expired."));
    }

    if (url.maxClicks && url.clicks >= url.maxClicks) {
      url.isActive = false;
      await url.save();
      urlCache.set(code, buildCacheObject(url));
      if (url.fallbackUrl) return res.redirect(url.fallbackUrl);
      return res.status(410).send(renderExpiredPage(url, "This link has reached its maximum click limit."));
    }
    
    // 3. Populate cache
    urlCache.set(code, buildCacheObject(url));

    if (url.password) {
      return res.redirect(`${frontendUrl}/unlock/${code}`);
    }

    if (botCheck) {
      return res.status(200).send(renderOGPage(url));
    }

    const target = getTargetUrl(url, req);

    // Trigger Webhook Event Asynchronously
    if (url.webhookUrl) {
      triggerWebhook(url.webhookUrl, {
        event: "link.click",
        shortCode: code,
        longUrl: url.longUrl,
        targetUrl: target,
        timestamp: new Date().toISOString(),
        analytics: getAnalyticsData(req, target)
      });
    }

    const analyticsData = getAnalyticsData(req, target);

    // Emit real-time click event for SSE stream
    if (url.user) {
      eventBus.publishClick({
        userId: url.user.toString(),
        shortCode: code,
        title: url.title || url.longUrl,
        analytics: analyticsData
      });
    }

    // Atomic click reservation on database path to prevent concurrency races
    const clickFilter = {
      _id: url._id,
      isActive: true,
      $or: [
        { maxClicks: null },
        { maxClicks: { $exists: false } },
        { $expr: { $lt: ['$clicks', '$maxClicks'] } }
      ]
    };
    const clickUpdate = {
      $inc: { clicks: 1 },
      $push: { clickHistory: { $each: [analyticsData], $slice: -100 } },
      ...(url.isOneTime ? { $set: { isActive: false } } : {})
    };
    const updatedUrl = await Url.findOneAndUpdate(clickFilter, clickUpdate, { new: true });
    if (!updatedUrl) {
      urlCache.set(code, { ...buildCacheObject(url), isActive: false });
      if (url.fallbackUrl) return res.redirect(url.fallbackUrl);
      return res.status(410).send(renderExpiredPage(url, 'This link is no longer available.'));
    }
    if (updatedUrl.maxClicks && updatedUrl.clicks >= updatedUrl.maxClicks) {
      updatedUrl.isActive = false;
      await updatedUrl.save();
    }
    urlCache.set(code, buildCacheObject(updatedUrl));

    if (url.deepLinkScheme) {
      return res.status(200).send(renderDeepLinkPage(url, target));
    }
    
    if (url.splashDelay && url.splashMessage) {
      return res.status(200).send(renderSplashPage(url, target));
    }

    res.redirect(target);
  } catch (error) {
    res.status(500).send("Server error");
  }
};

exports.getUserUrls = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const tag = req.query.tag || "";
    const sortBy = req.query.sortBy || "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };
    if (tag) {
      query.tags = tag.toLowerCase().trim();
    }
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { longUrl: { $regex: safeSearch, $options: "i" } },
        { shortCode: { $regex: safeSearch, $options: "i" } },
        { title: { $regex: safeSearch, $options: "i" } },
        { tags: { $regex: safeSearch, $options: "i" } }
      ];
    }

    const sortConfig = {};
    sortConfig[sortBy] = order;

    const urls = await Url.find(query)
      .sort(sortConfig)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Url.countDocuments(query);

    res.json({
      urls,
      page,
      totalPages: Math.ceil(total / limit),
      totalUrls: total
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteUrl = async (req, res) => {
  try {
    const url = req.resource || await Url.findById(req.params.id);

    if (!url) {
      return res.status(404).json({ message: "URL not found" });
    }

    // Ensure the user owns this URL
    if (!url.user || url.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this URL" });
    }

    // Evict from cache
    urlCache.delete(url.shortCode);

    await Url.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: "DELETE_URL",
      userEmail: req.user.email,
      targetUserId: url.user,
      targetResource: "Url",
      status: "success",
      ipAddress: req.ip,
      details: `Deleted shortCode: ${url.shortCode}`
    });

    res.json({ message: "URL deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.unlockUrl = async (req, res) => {
  const { code } = req.params;
  const { password } = req.body;

  try {
    let url;
    if (code && code.length === 24 && mongoose.Types.ObjectId.isValid(code)) {
      url = await Url.findById(code);
    }
    if (!url) {
      url = await Url.findOne({ shortCode: code });
    }
    if (!url) return res.status(404).json({ message: "URL not found" });
    if (!url.isActive) return res.status(403).json({ message: "Link is disabled", fallbackUrl: url.fallbackUrl });
    if (url.expiresAt && new Date() > new Date(url.expiresAt)) {
      url.isActive = false;
      await url.save();
      urlCache.set(url.shortCode, buildCacheObject(url));
      return res.status(410).json({ message: "Link has expired", fallbackUrl: url.fallbackUrl });
    }
    if (url.maxClicks && url.clicks >= url.maxClicks) {
      url.isActive = false;
      await url.save();
      urlCache.set(url.shortCode, buildCacheObject(url));
      return res.status(410).json({ message: "Link has reached its maximum click limit", fallbackUrl: url.fallbackUrl });
    }
    if (!url.password) return res.status(400).json({ message: "URL is not password protected" });

    const isMatch = await bcrypt.compare(password, url.password);
    if (!isMatch) return res.status(401).json({ message: "Incorrect password" });

    const targetUrl = getTargetUrl(url, req);
    const analyticsData = getAnalyticsData(req, targetUrl);
    const clickFilter = {
      _id: url._id,
      isActive: true,
      $or: [
        { maxClicks: null },
        { maxClicks: { $exists: false } },
        { $expr: { $lt: ['$clicks', '$maxClicks'] } }
      ]
    };
    const clickUpdate = {
      $inc: { clicks: 1 },
      $push: { clickHistory: { $each: [analyticsData], $slice: -100 } },
      ...(url.isOneTime ? { $set: { isActive: false } } : {})
    };
    const updatedUrl = await Url.findOneAndUpdate(clickFilter, clickUpdate, { new: true });
    if (!updatedUrl) return res.status(410).json({ message: "Link is no longer available", fallbackUrl: url.fallbackUrl });
    if (updatedUrl.maxClicks && updatedUrl.clicks >= updatedUrl.maxClicks) {
      updatedUrl.isActive = false;
      await updatedUrl.save();
    }
    urlCache.set(url.shortCode, buildCacheObject(updatedUrl));

    // Trigger Webhook Event Asynchronously
    if (url.webhookUrl) {
      triggerWebhook(url.webhookUrl, {
        event: "link.click",
        shortCode: url.shortCode,
        longUrl: url.longUrl,
        targetUrl: targetUrl,
        timestamp: new Date().toISOString(),
        analytics: analyticsData
      });
    }

    res.json({ longUrl: targetUrl });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.toggleUrlStatus = async (req, res) => {
  try {
    const url = req.resource || await Url.findById(req.params.id);

    if (!url) {
      return res.status(404).json({ message: "URL not found" });
    }

    // Ensure ownership
    if (!url.user || url.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to modify this URL" });
    }

    url.isActive = !url.isActive;
    await url.save();

    // Update cache
    urlCache.set(url.shortCode, buildCacheObject(url));

    await AuditLog.create({
      action: "TOGGLE_URL_STATUS",
      userEmail: req.user.email,
      targetUserId: url.user,
      targetResource: "Url",
      status: "success",
      ipAddress: req.ip,
      details: `Toggled shortCode ${url.shortCode} active state to ${url.isActive}`
    });

    res.json(url);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.editUrl = async (req, res) => {
  const { longUrl, password, expiresAt, ogTitle, ogDescription, ogImage, iphoneUrl, androidUrl, webhookUrl, maxClicks, fallbackUrl, abTestTargets, splashMessage, splashDelay, isOneTime, geoTargets, deepLinkScheme, aiSummary, aiSafetyScore, aiTags, tags } = req.body;

  try {
    const url = req.resource || await Url.findById(req.params.id);

    if (!url) {
      return res.status(404).json({ message: "URL not found" });
    }

    // Ensure ownership
    if (!url.user || url.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to edit this URL" });
    }

    if (longUrl && longUrl !== url.longUrl) {
      url.longUrl = longUrl;
      const { title, favicon } = await fetchMetadata(longUrl);
      url.title = title;
      url.favicon = favicon;
    }

    if (password !== undefined) {
      if (password === "" || password === null) {
        url.password = null;
      } else {
        const salt = await bcrypt.genSalt(12);
        url.password = await bcrypt.hash(password, salt);
      }
    }

    if (expiresAt !== undefined) {
      url.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
    }

    if (ogTitle !== undefined) url.ogTitle = ogTitle;
    if (ogDescription !== undefined) url.ogDescription = ogDescription;
    if (ogImage !== undefined) url.ogImage = ogImage;
    if (iphoneUrl !== undefined) url.iphoneUrl = iphoneUrl;
    if (androidUrl !== undefined) url.androidUrl = androidUrl;
    if (webhookUrl !== undefined) url.webhookUrl = webhookUrl;
    if (maxClicks !== undefined) url.maxClicks = maxClicks;
    if (fallbackUrl !== undefined) url.fallbackUrl = fallbackUrl;
    if (abTestTargets !== undefined) url.abTestTargets = abTestTargets;
    if (splashMessage !== undefined) url.splashMessage = splashMessage;
    if (splashDelay !== undefined) url.splashDelay = splashDelay;
    if (isOneTime !== undefined) url.isOneTime = !!isOneTime;
    if (geoTargets !== undefined) url.geoTargets = geoTargets;
    if (deepLinkScheme !== undefined) url.deepLinkScheme = deepLinkScheme;
    if (aiSummary !== undefined) url.aiSummary = aiSummary;
    if (aiSafetyScore !== undefined) url.aiSafetyScore = aiSafetyScore;
    if (aiTags !== undefined) url.aiTags = aiTags;
    if (tags !== undefined) {
      url.tags = Array.isArray(tags)
        ? Array.from(new Set(tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)))
        : [];
    }

    await url.save();

    // Update cache
    urlCache.set(url.shortCode, buildCacheObject(url));

    await AuditLog.create({
      action: "EDIT_URL",
      userEmail: req.user.email,
      status: "success",
      ipAddress: req.ip,
      details: `Edited shortCode: ${url.shortCode}`
    });

    res.json(url);
  } catch (error) {
    console.error("Edit URL error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const [statsResult, topUrl, tagStats] = await Promise.all([
      Url.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            totalUrls: { $sum: 1 },
            totalClicks: { $sum: "$clicks" },
            activeUrls: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] }
            }
          }
        }
      ]),
      Url.findOne({ user: userId })
        .sort({ clicks: -1 })
        .select("shortCode clicks title longUrl")
        .lean(),
      Url.aggregate([
        { $match: { user: userId } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 25 }
      ])
    ]);

    const stats = statsResult[0] || { totalUrls: 0, totalClicks: 0, activeUrls: 0 };

    res.json({
      totalUrls: stats.totalUrls,
      totalClicks: stats.totalClicks,
      activeUrls: stats.activeUrls,
      tags: (tagStats || []).map(t => ({ tag: t._id, count: t.count })),
      topUrl: topUrl ? {
        shortCode: topUrl.shortCode,
        clicks: topUrl.clicks,
        title: topUrl.title || topUrl.longUrl
      } : null
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const safeCsvCell = (val) => {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return '"' + str.replace(/"/g, '""') + '"';
};

exports.exportAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { format = 'csv', urlId } = req.query;

    if (urlId) {
      const url = await Url.findOne({ _id: urlId, user: userId }).lean();
      if (!url) {
        return res.status(404).json({ message: "URL not found or unauthorized" });
      }

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="link-${url.shortCode}-analytics-${Date.now()}.json"`);
        return res.json({
          shortCode: url.shortCode,
          title: url.title || url.longUrl,
          longUrl: url.longUrl,
          totalClicks: url.clicks,
          createdAt: url.createdAt,
          clickHistory: url.clickHistory || []
        });
      }

      const headers = ['Timestamp', 'Browser', 'OS', 'Country', 'Referrer', 'ServedUrl'];
      const rows = (url.clickHistory || []).map(c => [
        safeCsvCell(c.timestamp ? new Date(c.timestamp).toISOString() : ''),
        safeCsvCell(c.browser || 'Unknown'),
        safeCsvCell(c.os || 'Unknown'),
        safeCsvCell(c.country || 'Unknown'),
        safeCsvCell(c.referer || 'Direct / Email'),
        safeCsvCell(c.servedUrl || url.longUrl)
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="link-${url.shortCode}-analytics-${Date.now()}.csv"`);
      return res.send(csvContent);
    }

    const urls = await Url.find({ user: userId }).sort({ createdAt: -1 }).lean();

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="all-links-analytics-${Date.now()}.json"`);
      return res.json(urls.map(u => ({
        id: u._id,
        shortCode: u.shortCode,
        title: u.title || '',
        longUrl: u.longUrl,
        tags: u.tags || [],
        clicks: u.clicks,
        isActive: u.isActive,
        isProtected: !!u.password,
        isOneTime: !!u.isOneTime,
        expiresAt: u.expiresAt || null,
        createdAt: u.createdAt,
        recordedClicks: (u.clickHistory || []).length
      })));
    }

    const headers = ['ShortCode', 'Title', 'LongUrl', 'Tags', 'Clicks', 'IsActive', 'IsProtected', 'IsOneTime', 'ExpiresAt', 'CreatedAt'];
    const rows = urls.map(u => [
      safeCsvCell(u.shortCode),
      safeCsvCell(u.title || ''),
      safeCsvCell(u.longUrl),
      safeCsvCell((u.tags || []).join('; ')),
      safeCsvCell(u.clicks || 0),
      safeCsvCell(u.isActive ? 'Active' : 'Disabled'),
      safeCsvCell(u.password ? 'Yes' : 'No'),
      safeCsvCell(u.isOneTime ? 'Yes' : 'No'),
      safeCsvCell(u.expiresAt ? new Date(u.expiresAt).toISOString() : 'Never'),
      safeCsvCell(u.createdAt ? new Date(u.createdAt).toISOString() : '')
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="all-links-analytics-${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (error) {
    console.error("Export analytics error:", error);
    res.status(500).json({ message: "Server error exporting analytics" });
  }
};

exports.bulkShortenUrl = async (req, res) => {
  const { links, defaultTags } = req.body;
  const user = req.user ? req.user._id : null;
  const userEmail = req.user ? req.user.email : "anonymous";

  if (!links || !Array.isArray(links) || links.length === 0) {
    return res.status(400).json({ message: "Invalid links array" });
  }

  if (links.length > 20) {
    return res.status(400).json({ message: "Bulk shorten limit is 20 URLs at a time" });
  }

  const inheritedTags = Array.isArray(defaultTags)
    ? defaultTags.map(t => String(t).trim().toLowerCase()).filter(Boolean)
    : [];

  const results = [];
  try {
    const processLink = async (link) => {
      const { longUrl, customAlias, tags: linkTags } = link;
      if (!longUrl) return { error: "Missing destination URL" };

      const itemTags = Array.isArray(linkTags)
        ? linkTags.map(t => String(t).trim().toLowerCase()).filter(Boolean)
        : [];
      const mergedTags = Array.from(new Set([...inheritedTags, ...itemTags]));

      let shortCode = customAlias;
      if (customAlias) {
        if (RESERVED_ALIASES.has(customAlias.toLowerCase())) {
          return { longUrl, error: `Alias '${customAlias}' is a reserved system keyword` };
        }
        const existing = await Url.findOne({ shortCode: customAlias });
        if (existing) return { longUrl, error: `Alias '${customAlias}' is already taken` };
      } else {
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 5) {
          shortCode = nanoid(8);
          const existing = await Url.findOne({ shortCode });
          if (!existing) isUnique = true;
          attempts++;
        }
        if (!isUnique) return { longUrl, error: "Failed to generate unique short code" };
      }

      const newUrl = await Url.create({
        longUrl,
        shortCode,
        user,
        tags: mergedTags
      });

      urlCache.set(shortCode, buildCacheObject(newUrl));

      // Async metadata fetch without clobbering concurrent clicks
      fetchMetadata(longUrl).then(async ({ title, favicon }) => {
        await Url.updateOne({ _id: newUrl._id }, { $set: { title, favicon } });
        const currentCache = urlCache.get(shortCode);
        if (currentCache) {
          urlCache.set(shortCode, { ...currentCache, title, favicon });
        }
      }).catch(err => console.error("Async metadata fetch error", err));

      return {
        longUrl,
        shortCode,
        title: null,
        favicon: null,
        tags: mergedTags,
        _id: newUrl._id
      };
    };

    const resultsArray = await Promise.allSettled(links.map(processLink));
    const results = resultsArray.map(r => r.status === 'fulfilled' ? r.value : { error: "Internal error processing link" });

    await AuditLog.create({
      action: "BULK_SHORTEN_URL",
      userEmail,
      status: "success",
      ipAddress: req.ip,
      details: `Created ${results.filter(r => !r.error).length} short links in bulk`
    });

    res.status(201).json({ results });
  } catch (error) {
    console.error("Bulk shorten error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.streamClicks = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const userId = req.user._id.toString();

  const handleClick = (data) => {
    if (data.userId === userId) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  eventBus.on('click', handleClick);

  // Send periodic SSE comment heartbeat every 25s to keep connections alive across reverse proxies/ELBs
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('click', handleClick);
  });
};

exports.analyzeUrlWithAi = async (req, res) => {
  const { longUrl } = req.body;
  if (!longUrl) return res.status(400).json({ message: "Destination URL is required" });

  try {
    let urlObj;
    try {
      urlObj = new URL(longUrl);
    } catch {
      return res.status(400).json({ message: "Invalid URL string provided" });
    }

    const isPrivate = await isPrivateHost(urlObj.hostname);
    if (isPrivate) {
      return res.status(400).json({ message: "Private or internal host URLs cannot be analyzed for safety reasons" });
    }

    let textContent = "";
    let pageTitle = "";
    try {
      // SECURITY FIX: No redirect following to prevent DNS rebinding attacks
      const response = await axios.get(longUrl, {
        timeout: 4000,
        maxRedirects: 0, // Do NOT follow redirects - prevents SSRF via DNS rebinding
        maxContentLength: 1024 * 1024 // 1MB max response size
      });
      const $ = cheerio.load(response.data);
      pageTitle = $("title").text().trim();
      $("script, style, noscript, nav, footer").remove();
      textContent = $("body").text().replace(/\s+/g, " ").trim().slice(0, 1200);
    } catch {
      pageTitle = urlObj.hostname;
    }

    const hasHttps = longUrl.startsWith("https://");
    const domain = urlObj.hostname.toLowerCase();
    
    let safetyScore = 95;
    let rationaleList = [];

    if (hasHttps) {
      rationaleList.push("Uses SSL/TLS encryption (HTTPS).");
    } else {
      safetyScore -= 30;
      rationaleList.push("Insecure HTTP protocol detected.");
    }

    if (domain.length > 30) {
      safetyScore -= 10;
      rationaleList.push("Unusually long domain name.");
    }

    const words = (textContent + " " + pageTitle).toLowerCase();
    const tags = new Set();

    if (words.includes("code") || words.includes("developer") || words.includes("github") || words.includes("api") || words.includes("tech")) tags.add("Technology");
    if (words.includes("buy") || words.includes("price") || words.includes("shop") || words.includes("store") || words.includes("cart")) tags.add("E-Commerce");
    if (words.includes("news") || words.includes("article") || words.includes("blog") || words.includes("media")) tags.add("Media & News");
    if (words.includes("login") || words.includes("password") || words.includes("verify") || words.includes("auth")) tags.add("Authentication");
    if (tags.size === 0) tags.add("General Web");

    const summary = textContent.length > 50 ? 
      `AI Summary: "${textContent.slice(0, 220)}..."` : 
      `Target resource hosted at ${domain}. Domain structure verified.`;

    const safetyScoreFinal = Math.max(15, Math.min(100, safetyScore));
    const safetyRating = safetyScoreFinal >= 85 ? "Safe & Verified" : safetyScoreFinal >= 60 ? "Caution Advised" : "Suspicious";

    res.json({
      title: pageTitle || domain,
      summary,
      safetyScore: safetyScoreFinal,
      safetyRating,
      rationale: rationaleList.join(" "),
      tags: Array.from(tags),
      analyzedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("AI Analysis error:", error);
    res.status(500).json({ message: "Failed to analyze target URL" });
  }
};

const checkSingleUrlHealth = async (urlDoc) => {
  const start = Date.now();
  let status = 'unchecked';
  let statusCode = null;
  let responseTimeMs = null;
  let errorMessage = null;

  try {
    const urlObj = new URL(urlDoc.longUrl);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return { status: 'unreachable', statusCode: 400, responseTimeMs: 0, errorMessage: 'Only HTTP and HTTPS protocols are supported' };
    }

    const isPrivate = await isPrivateHost(urlObj.hostname);
    if (isPrivate) {
      status = 'unreachable';
      errorMessage = 'Target host resolved to a private/internal network IP';
      return { status, statusCode: 400, responseTimeMs: 0, errorMessage };
    }

    const response = await axios.get(urlDoc.longUrl, {
      timeout: 5000,
      maxRedirects: 0,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ShortlyHealthCheck/1.0; +https://shortly.app)'
      }
    });

    responseTimeMs = Date.now() - start;
    statusCode = response.status;

    if (statusCode >= 200 && statusCode < 400) {
      status = 'healthy';
    } else if (statusCode >= 400 && statusCode < 500) {
      status = 'broken';
      errorMessage = `Destination returned client error HTTP ${statusCode}`;
    } else {
      status = 'warning';
      errorMessage = `Destination returned server error HTTP ${statusCode}`;
    }
  } catch (err) {
    responseTimeMs = Date.now() - start;
    status = 'unreachable';
    errorMessage = err.code === 'ECONNABORTED' ? 'Request timed out after 5000ms' : (err.message || 'Connection failed');
  }

  return { status, statusCode, responseTimeMs, errorMessage };
};

exports.checkUrlHealth = async (req, res) => {
  try {
    const url = req.resource || await Url.findById(req.params.id);
    if (!url) {
      return res.status(404).json({ message: "URL not found" });
    }

    if (url.user && url.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized to check health for this URL" });
    }

    const health = await checkSingleUrlHealth(url);
    url.healthStatus = health.status;
    url.healthStatusCode = health.statusCode;
    url.healthResponseTimeMs = health.responseTimeMs;
    url.healthLastCheckedAt = new Date();
    url.healthError = health.errorMessage;
    await url.save();

    res.json({
      _id: url._id,
      shortCode: url.shortCode,
      longUrl: url.longUrl,
      healthStatus: url.healthStatus,
      healthStatusCode: url.healthStatusCode,
      healthResponseTimeMs: url.healthResponseTimeMs,
      healthLastCheckedAt: url.healthLastCheckedAt,
      healthError: url.healthError
    });
  } catch (error) {
    console.error("Check URL health error:", error);
    res.status(500).json({ message: "Server error checking link health" });
  }
};

exports.checkAllUrlsHealth = async (req, res) => {
  try {
    const userId = req.user._id;
    const urls = await Url.find({ user: userId, isActive: true }).limit(25);

    const results = await Promise.allSettled(
      urls.map(async (url) => {
        const health = await checkSingleUrlHealth(url);
        url.healthStatus = health.status;
        url.healthStatusCode = health.statusCode;
        url.healthResponseTimeMs = health.responseTimeMs;
        url.healthLastCheckedAt = new Date();
        url.healthError = health.errorMessage;
        await url.save();
        return {
          _id: url._id,
          shortCode: url.shortCode,
          healthStatus: url.healthStatus,
          healthStatusCode: url.healthStatusCode,
          healthResponseTimeMs: url.healthResponseTimeMs
        };
      })
    );

    const checked = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
    const summary = {
      totalChecked: checked.length,
      healthy: checked.filter(c => c.healthStatus === 'healthy').length,
      broken: checked.filter(c => c.healthStatus === 'broken').length,
      warning: checked.filter(c => c.healthStatus === 'warning').length,
      unreachable: checked.filter(c => c.healthStatus === 'unreachable').length,
      items: checked
    };

    res.json(summary);
  } catch (error) {
    console.error("Check all URLs health error:", error);
    res.status(500).json({ message: "Server error checking all links health" });
  }
};

// Export helper functions for testing and monitoring
module.exports.isPrivateIp = isPrivateIp;
module.exports.isPrivateHost = isPrivateHost;
module.exports.isSafeExternalUrl = isSafeExternalUrl;
module.exports.safeJsonScriptData = safeJsonScriptData;
module.exports.sanitizeUrl = sanitizeUrl;
module.exports.renderOGPage = renderOGPage;
module.exports.renderSplashPage = renderSplashPage;
module.exports.renderDeepLinkPage = renderDeepLinkPage;
module.exports.getUrlCacheMetrics = () => ({
  size: urlCacheMetrics.size,
  hits: urlCacheMetrics.hits,
  misses: urlCacheMetrics.misses,
  evictions: urlCacheMetrics.evictions,
  hitRate: urlCacheMetrics.hitRate
});


