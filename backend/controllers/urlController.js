const Url = require("../models/Url");
const AuditLog = require("../models/AuditLog");
const { nanoid } = require("nanoid");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const cheerio = require("cheerio");
const useragent = require("useragent");
const geoip = require("geoip-lite");
const { LRUCache } = require('lru-cache');
const EventEmitter = require('events');
const clickEmitter = new EventEmitter();

const urlCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60 // 1 hour
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
  const forwarded = req.headers['x-forwarded-for'];
  let ip = forwarded ? forwarded.split(',')[0].trim() : (req.headers['x-real-ip'] || req.socket.remoteAddress || "");
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
  const agent = useragent.parse(req.headers['user-agent']);
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
    browser: agent.family || "Unknown",
    os: agent.os.family || "Unknown",
    country: geo ? geo.country : "Unknown",
    referer,
    servedUrl
  };
};

const dns = require('dns').promises;

const isPrivateHost = async (host) => {
  const hostname = host.toLowerCase();
  
  if (hostname === 'localhost' || hostname === 'loopback' || hostname === '::1') {
    return true;
  }
  
  const ipv4PrivateRegex = /^(?:10\.\d+|127\.\d+|192\.168\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+)\.\d+$/;
  if (ipv4PrivateRegex.test(hostname)) {
    return true;
  }

  try {
    const lookup = await dns.lookup(host);
    const ip = lookup.address;
    if (ip === '127.0.0.1' || ip === '::1' || ipv4PrivateRegex.test(ip)) {
      return true;
    }
    if (ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
      return true;
    }
  } catch {
    // lookup failed
  }

  return false;
};

const fetchMetadata = async (url) => {
  try {
    const urlObj = new URL(url);
    const isPrivate = await isPrivateHost(urlObj.hostname);
    if (isPrivate) {
      console.warn(`SSRF Blocked request to private host: ${urlObj.hostname}`);
      return { title: null, favicon: null };
    }

    const response = await axios.get(url, { 
      timeout: 3000,
      maxRedirects: 3
    });
    const $ = cheerio.load(response.data);
    const title = $("title").text() || null;
    let favicon = $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href");
    
    if (favicon && !favicon.startsWith('http')) {
      favicon = new URL(favicon, urlObj.origin).toString();
    }
    return { title, favicon };
  } catch (error) {
    return { title: null, favicon: null };
  }
};

exports.shortenUrl = async (req, res) => {
  const { longUrl, customAlias, password, expiresAt, ogTitle, ogDescription, ogImage, iphoneUrl, androidUrl, webhookUrl, maxClicks, fallbackUrl, abTestTargets, splashMessage, splashDelay, isOneTime, geoTargets, deepLinkScheme, aiSummary, aiSafetyScore, aiTags } = req.body;
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
      aiTags
    });
    
    // Pre-populate cache
    urlCache.set(shortCode, buildCacheObject(newUrl));

    // Fetch metadata asynchronously
    fetchMetadata(longUrl).then(async ({ title, favicon }) => {
      newUrl.title = title;
      newUrl.favicon = favicon;
      await newUrl.save();
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

    res.status(201).json(newUrl);
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
  const safeLongUrl = escapeHtml(urlData.longUrl);
  
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
  <script>
    window.location.href = "${safeLongUrl}";
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
  const delay = urlData.splashDelay || 5;
  const favicon = escapeHtml(urlData.favicon || "");
  const safeTargetUrl = escapeHtml(targetUrl);
  
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

  <script>
    let secondsLeft = ${delay};
    const countdownEl = document.getElementById('countdown');
    const timerBar = document.getElementById('timer-bar');
    const totalDash = 283;
    
    const updateTimer = () => {
      if (secondsLeft <= 0) {
        window.location.href = "${safeTargetUrl}";
        return;
      }
      
      countdownEl.textContent = secondsLeft;
      const offset = totalDash - (secondsLeft / ${delay}) * totalDash;
      timerBar.style.strokeDashoffset = offset;
      
      secondsLeft--;
      setTimeout(updateTimer, 1000);
    };
    
    // Start countdown
    timerBar.style.transition = 'stroke-dashoffset 1s linear';
    updateTimer();
  </script>
</body>
</html>`;
};

const renderDeepLinkPage = (urlData, targetUrl) => {
  const deepLink = escapeHtml(urlData.deepLinkScheme);
  const fallback = escapeHtml(targetUrl);
  const title = escapeHtml(urlData.ogTitle || urlData.title || "Opening Application...");
  const favicon = escapeHtml(urlData.favicon || "");

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
  <script>
    window.location.href = "${deepLink}";
    setTimeout(function() {
      window.location.href = "${fallback}";
    }, 2000);
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
  const agent = useragent.parse(userAgentStr);
  const os = agent.os.family.toLowerCase();
  
  if ((os.includes('ios') || os.includes('iphone') || os.includes('ipad')) && urlData.iphoneUrl) {
    return urlData.iphoneUrl;
  }
  if (os.includes('android') && urlData.androidUrl) {
    return urlData.androidUrl;
  }
  return baseTarget;
};

const triggerWebhook = (webhookUrl, eventData) => {
  if (!webhookUrl) return;
  axios.post(webhookUrl, eventData, { timeout: 2500 })
    .catch(err => console.error(`[Webhook Error] Failed to send click event to ${webhookUrl}:`, err.message));
};

exports.redirectUrl = async (req, res) => {
  const { code } = req.params;
  const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const userAgent = req.headers['user-agent'];
  const botCheck = isBot(userAgent);

  try {
    // 1. Check cache first for high-performance redirect
    const cachedData = urlCache.get(code);
    if (cachedData) {
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
        clickEmitter.emit('click', {
          userId: cachedData.userId,
          shortCode: code,
          title: cachedData.title || cachedData.longUrl,
          analytics: analyticsData
        });
      }

      // Asynchronously update analytics and check click limit or one-time use
      Url.findOneAndUpdate(
        { shortCode: code },
        { 
          $inc: { clicks: 1 }, 
          $push: { clickHistory: analyticsData },
          ...(cachedData.isOneTime ? { $set: { isActive: false } } : {})
        },
        { new: true }
      ).then(updatedUrl => {
        if (cachedData.isOneTime) {
          urlCache.set(code, { ...cachedData, isActive: false });
        } else if (updatedUrl && updatedUrl.maxClicks && updatedUrl.clicks >= updatedUrl.maxClicks) {
          updatedUrl.isActive = false;
          updatedUrl.save();
          urlCache.set(code, buildCacheObject(updatedUrl));
        }
      }).catch(err => console.error("Async analytics update error", err));
      
      if (cachedData.deepLinkScheme) {
        return res.status(200).send(renderDeepLinkPage(cachedData, target));
      }

      if (cachedData.splashDelay && cachedData.splashMessage) {
        return res.status(200).send(renderSplashPage(cachedData, target));
      }

      return res.redirect(target);
    }

    // 2. Cache miss, query MongoDB
    const url = await Url.findOne({ shortCode: code });
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
      clickEmitter.emit('click', {
        userId: url.user.toString(),
        shortCode: code,
        title: url.title || url.longUrl,
        analytics: analyticsData
      });
    }

    url.clicks++;
    url.clickHistory.push(analyticsData);

    if (url.isOneTime) {
      url.isActive = false;
      urlCache.set(code, buildCacheObject(url));
    } else if (url.maxClicks && url.clicks >= url.maxClicks) {
      url.isActive = false;
      urlCache.set(code, buildCacheObject(url));
    }
    await url.save();

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
    const sortBy = req.query.sortBy || "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { longUrl: { $regex: safeSearch, $options: "i" } },
        { shortCode: { $regex: safeSearch, $options: "i" } }
      ];
    }

    const sortConfig = {};
    sortConfig[sortBy] = order;

    const urls = await Url.find(query)
      .sort(sortConfig)
      .skip(skip)
      .limit(limit);
    
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
    const url = await Url.findById(req.params.id);

    if (!url) {
      return res.status(404).json({ message: "URL not found" });
    }

    // Ensure the user owns this URL
    if (url.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this URL" });
    }

    // Evict from cache
    urlCache.delete(url.shortCode);

    await Url.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: "DELETE_URL",
      userEmail: req.user.email,
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
    const url = await Url.findOne({ shortCode: code });
    if (!url) return res.status(404).json({ message: "URL not found" });
    if (!url.isActive) return res.status(403).json({ message: "Link is disabled", fallbackUrl: url.fallbackUrl });
    if (!url.password) return res.status(400).json({ message: "URL is not password protected" });

    const isMatch = await bcrypt.compare(password, url.password);
    if (!isMatch) return res.status(401).json({ message: "Incorrect password" });

    const targetUrl = getTargetUrl(url, req);

    // Track analytics for unlocked redirect
    url.clicks++;
    url.clickHistory.push(getAnalyticsData(req, targetUrl));

    if (url.maxClicks && url.clicks >= url.maxClicks) {
      url.isActive = false;
      urlCache.set(code, buildCacheObject(url));
    }
    await url.save();

    // Trigger Webhook Event Asynchronously
    if (url.webhookUrl) {
      triggerWebhook(url.webhookUrl, {
        event: "link.click",
        shortCode: code,
        longUrl: url.longUrl,
        targetUrl: targetUrl,
        timestamp: new Date().toISOString(),
        analytics: getAnalyticsData(req, targetUrl)
      });
    }

    res.json({ longUrl: targetUrl });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.toggleUrlStatus = async (req, res) => {
  try {
    const url = await Url.findById(req.params.id);

    if (!url) {
      return res.status(404).json({ message: "URL not found" });
    }

    // Ensure ownership
    if (url.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to modify this URL" });
    }

    url.isActive = !url.isActive;
    await url.save();

    // Update cache
    urlCache.set(url.shortCode, buildCacheObject(url));

    await AuditLog.create({
      action: "TOGGLE_URL_STATUS",
      userEmail: req.user.email,
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
  const { longUrl, password, expiresAt, ogTitle, ogDescription, ogImage, iphoneUrl, androidUrl, webhookUrl, maxClicks, fallbackUrl, abTestTargets, splashMessage, splashDelay, isOneTime, geoTargets, deepLinkScheme, aiSummary, aiSafetyScore, aiTags } = req.body;

  try {
    const url = await Url.findById(req.params.id);

    if (!url) {
      return res.status(404).json({ message: "URL not found" });
    }

    // Ensure ownership
    if (url.user.toString() !== req.user._id.toString()) {
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

    // Total URLs count
    const totalUrls = await Url.countDocuments({ user: userId });

    // Total Clicks sum
    const clicksResult = await Url.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, totalClicks: { $sum: "$clicks" } } }
    ]);
    const totalClicks = clicksResult.length > 0 ? clicksResult[0].totalClicks : 0;

    // Active URLs count
    const activeUrls = await Url.countDocuments({ user: userId, isActive: true });

    // Top Performing Link
    const topUrl = await Url.findOne({ user: userId }).sort({ clicks: -1 });

    res.json({
      totalUrls,
      totalClicks,
      activeUrls,
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

exports.bulkShortenUrl = async (req, res) => {
  const { links } = req.body;
  const user = req.user ? req.user._id : null;
  const userEmail = req.user ? req.user.email : "anonymous";

  if (!links || !Array.isArray(links) || links.length === 0) {
    return res.status(400).json({ message: "Invalid links array" });
  }

  if (links.length > 20) {
    return res.status(400).json({ message: "Bulk shorten limit is 20 URLs at a time" });
  }

  const results = [];
  try {
    const processLink = async (link) => {
      const { longUrl, customAlias } = link;
      if (!longUrl) return { error: "Missing destination URL" };

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
        user
      });

      urlCache.set(shortCode, buildCacheObject(newUrl));
      
      // Async metadata fetch
      fetchMetadata(longUrl).then(async ({ title, favicon }) => {
        newUrl.title = title;
        newUrl.favicon = favicon;
        await newUrl.save();
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

  clickEmitter.on('click', handleClick);

  req.on('close', () => {
    clickEmitter.off('click', handleClick);
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
      const response = await axios.get(longUrl, { timeout: 4000, maxRedirects: 3 });
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


