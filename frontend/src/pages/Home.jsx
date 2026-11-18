import { useState, useContext, useEffect, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { apiFetch, API_URL } from "../utils/api";
import ShaderBackground from "../components/ShaderBackground";
import Button from "../components/ui/Button";
import TiltCard from "../components/ui/TiltCard";
import { useToast } from "../context/ToastContextInstance";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState("single");
  const [bulkInput, setBulkInput] = useState("");
  const [bulkResults, setBulkResults] = useState([]);
  const [longUrl, setLongUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customAlias, setCustomAlias] = useState("");
  const [tags, setTags] = useState("");
  const [bulkDefaultTags, setBulkDefaultTags] = useState("");
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [error, setError] = useState("");
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [iphoneUrl, setIphoneUrl] = useState("");
  const [androidUrl, setAndroidUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [splashMessage, setSplashMessage] = useState("");
  const [splashDelay, setSplashDelay] = useState("");
  const [isOneTime, setIsOneTime] = useState(false);
  const [abTestTargets, setAbTestTargets] = useState([]);
  const [geoTargets, setGeoTargets] = useState([]);
  const urlInputRef = useRef(null);
  const { user, login, logout } = useContext(AuthContext);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        urlInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLongUrl(text.trim());
        addToast("Link pasted from clipboard", "success");
      }
    } catch {
      addToast("Clipboard access was blocked. Paste the link manually.", "error");
    }
  };

  const useExampleUrl = () => {
    setLongUrl("https://www.producthunt.com/posts/shortyurl");
    setShortUrl("");
    setError("");
    urlInputRef.current?.focus();
  };

  // Typing animation effect
  useEffect(() => {
    const text = "Make it Short.";
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setTypedText(text.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!longUrl) return;

    setLoading(true);
    setShortUrl("");
    setError("");

    try {
      let finalLongUrl = longUrl;
      try {
        if (utmSource || utmMedium || utmCampaign) {
          const urlObj = new URL(longUrl);
          if (utmSource) urlObj.searchParams.set("utm_source", utmSource);
          if (utmMedium) urlObj.searchParams.set("utm_medium", utmMedium);
          if (utmCampaign) urlObj.searchParams.set("utm_campaign", utmCampaign);
          finalLongUrl = urlObj.toString();
        }
      } catch (err) {
        console.error("UTM URL building failed:", err);
        throw new Error("Invalid URL format for UTM building");
      }

      const payload = { longUrl: finalLongUrl.trim() };
      if (customAlias) payload.customAlias = customAlias.trim();
      if (tags) {
        const parsedTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        if (parsedTags.length > 0) payload.tags = parsedTags;
      }
      if (password) payload.password = password;
      if (expiresAt) payload.expiresAt = new Date(expiresAt).toISOString();
      if (ogTitle) payload.ogTitle = ogTitle;
      if (ogDescription) payload.ogDescription = ogDescription;
      if (ogImage) payload.ogImage = ogImage;
      if (iphoneUrl) payload.iphoneUrl = iphoneUrl;
      if (androidUrl) payload.androidUrl = androidUrl;
      if (webhookUrl) payload.webhookUrl = webhookUrl;
      if (maxClicks) payload.maxClicks = parseInt(maxClicks, 10);
      if (fallbackUrl) payload.fallbackUrl = fallbackUrl;
      if (splashMessage) payload.splashMessage = splashMessage;
      if (splashDelay) payload.splashDelay = parseInt(splashDelay, 10);
      if (isOneTime) payload.isOneTime = isOneTime;
      if (abTestTargets && abTestTargets.length > 0) {
        const cleanTargets = abTestTargets
          .filter(t => t.url.trim() !== "")
          .map(t => ({ url: t.url.trim(), weight: parseInt(t.weight, 10) || 0 }));
        if (cleanTargets.length > 0) payload.abTestTargets = cleanTargets;
      }
      if (geoTargets && geoTargets.length > 0) {
        const cleanGeo = geoTargets
          .filter(t => t.country.trim() !== "" && t.url.trim() !== "")
          .map(t => ({ country: t.country.trim().toUpperCase(), url: t.url.trim() }));
        if (cleanGeo.length > 0) payload.geoTargets = cleanGeo;
      }

      const res = await apiFetch(`${API_URL}/api/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, user, login, logout);

      const data = await res.json();

      if (!res.ok) {
        let errorMsg = data.message || "Failed to shorten URL";
        if (data.errors && data.errors.length > 0) {
          const fieldError = data.errors[0];
          const field = Array.isArray(fieldError.path)
            ? fieldError.path.join('.')
            : (fieldError.field || 'Request');
          errorMsg = `${field}: ${fieldError.message}`;
        }
        throw new Error(errorMsg);
      }

      const fullShortUrl = `${API_URL || window.location.origin}/${data.shortCode}`;
      setShortUrl(fullShortUrl);
      // Reset form
      setCustomAlias("");
      setTags("");
      setPassword("");
      setExpiresAt("");
      setUtmSource("");
      setUtmMedium("");
      setUtmCampaign("");
      setOgTitle("");
      setOgDescription("");
      setOgImage("");
      setIphoneUrl("");
      setAndroidUrl("");
      setWebhookUrl("");
      setMaxClicks("");
      setFallbackUrl("");
      setSplashMessage("");
      setSplashDelay("");
      setIsOneTime(false);
      setAbTestTargets([]);
      setGeoTargets([]);
      setShowAdvanced(false);
    } catch (err) {
      console.error("Error shortening URL:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      addToast("Please log in to shorten URLs", "error");
      navigate("/login");
      return;
    }

    if (!bulkInput.trim()) return;

    setLoading(true);
    setBulkResults([]);
    setError("");

    try {
      const lines = bulkInput.split("\n").map(l => l.trim()).filter(l => l !== "");
      const links = lines.map(line => {
        const lastCommaIndex = line.lastIndexOf(",");
        let longUrl = line.trim();
        let customAlias = undefined;
        if (lastCommaIndex !== -1) {
          const possibleAlias = line.slice(lastCommaIndex + 1).trim();
          if (possibleAlias && !possibleAlias.includes('/') && !possibleAlias.includes(':')) {
            customAlias = possibleAlias;
            longUrl = line.slice(0, lastCommaIndex).trim();
          }
        }
        return { longUrl, customAlias };
      });

      const payload = { links };
      if (bulkDefaultTags) {
        const parsedTags = bulkDefaultTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        if (parsedTags.length > 0) payload.defaultTags = parsedTags;
      }

      const res = await apiFetch(`${API_URL}/api/shorten/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, user, login, logout);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to shorten bulk URLs");
      }

      setBulkResults(data.results || []);
      setBulkInput("");
      setBulkDefaultTags("");
      addToast("Bulk links shortened successfully!", "success");
    } catch (err) {
      console.error("Bulk shorten error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
      addToast("Shortened URL copied to clipboard!", "success");
    } catch {
      addToast("Unable to copy the URL. Please copy it manually.", "error");
    }
  };

  return (
    <>
      {/* Background Decoration */}
      <ShaderBackground />

      <main className="relative min-h-screen flex flex-col items-center pt-16 px-gutter">
        {/* Hero Section */}
        <section className="max-w-4xl w-full text-center py-section-gap flex flex-col items-center mt-12 relative z-10">
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-gradient premium-glow-text mb-4 min-h-[1.2em] leading-tight break-words">
            {typedText}
            <span className="animate-pulse-slow text-tertiary">|</span>
          </h1>
          <p className="font-body-lg text-body-lg text-text-muted max-w-2xl mb-12 animate-fade-in-up [animation-delay:200ms]">
            The premium URL shortener that gives you full control over your links with advanced analytics and brand customization.
          </p>

          {/* Mode Selector Tab */}
          <div className="flex bg-surface-container-high/40 border border-border-glass/40 p-1 rounded-full mb-6 relative z-10 animate-fade-in-up [animation-delay:300ms]">
            <button
              onClick={() => { setMode('single'); setShortUrl(''); setBulkResults([]); setError(''); }}
              className={`px-6 py-2 rounded-full font-label-sm text-label-sm font-semibold transition-all duration-300 cursor-pointer ${mode === 'single' ? 'bg-primary text-on-primary shadow-lg' : 'text-text-muted hover:text-on-surface'}`}
            >
              Single Link
            </button>
            <button
              onClick={() => { setMode('bulk'); setShortUrl(''); setBulkResults([]); setError(''); }}
              className={`px-6 py-2 rounded-full font-label-sm text-label-sm font-semibold transition-all duration-300 cursor-pointer ${mode === 'bulk' ? 'bg-primary text-on-primary shadow-lg' : 'text-text-muted hover:text-on-surface'}`}
            >
              Bulk Links
            </button>
          </div>

          {/* Shorten Input Box */}
          <div className="w-full max-w-3xl glass-panel p-2 rounded-3xl mb-10 shadow-2xl transition-all card-hover-lift animate-fade-in-up [animation-delay:400ms]">
            {mode === 'single' ? (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2 p-1">
                <input
                  className="bg-transparent border-none focus:ring-0 flex-grow px-6 py-4 w-full text-on-surface placeholder:text-outline/50 font-body-md text-body-md"
                  id="url-input"
                  ref={urlInputRef}
                  placeholder="Paste your long link here..."
                  aria-label="Long URL to shorten"
                  type="url"
                  required
                  value={longUrl}
                  onChange={(e) => setLongUrl(e.target.value)}
                />
                <div className="flex gap-2 w-full sm:w-auto px-2 sm:px-0 pb-2 sm:pb-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={pasteFromClipboard}
                    icon="content_paste"
                    className="!px-4 h-12 hidden sm:flex"
                    title="Paste from clipboard"
                    aria-label="Paste from clipboard"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    icon={showAdvanced ? "expand_less" : "tune"}
                    className="!px-4 h-12"
                    title="Advanced Options"
                  />
                  <Button
                    type="submit"
                    variant="gradient"
                    loading={loading}
                    icon="arrow_forward"
                    iconPosition="right"
                    className="px-8 !rounded-full w-full sm:w-auto h-12 shine-effect"
                  >
                    Shorten
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleBulkSubmit} className="flex flex-col gap-4 p-4 text-left">
                <textarea
                  className="w-full bg-transparent border border-border-glass/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 rounded-2xl p-4 text-on-surface placeholder:text-outline/50 font-body-sm text-body-sm resize-none focus:outline-none"
                  rows="6"
                  placeholder="Enter one link per line, optionally with a custom alias after a comma. E.g.&#10;https://google.com, google&#10;https://github.com"
                  required
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                />
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">label</span>
                  <input
                    type="text"
                    placeholder="Batch tags (comma-separated, e.g. campaign, twitter, launch)"
                    value={bulkDefaultTags}
                    onChange={(e) => setBulkDefaultTags(e.target.value)}
                    className="w-full bg-surface-container-lowest/50 border border-border-glass/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 rounded-xl py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 font-body-sm text-body-sm focus:outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-2">
                  <span className="text-[11px] text-text-muted">Max 20 links at once</span>
                  <Button
                    type="submit"
                    variant="gradient"
                    loading={loading}
                    icon="bolt"
                    iconPosition="right"
                    className="px-8 !rounded-full h-12 w-full sm:w-auto"
                  >
                    Shorten All
                  </Button>
                </div>
              </form>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 mb-8 text-xs text-text-muted animate-fade-in-up [animation-delay:450ms]">
            <span className="inline-flex items-center gap-2"><kbd className="shortcut-key">/</kbd> Focus input</span>
            <span className="h-3 w-px bg-border-glass hidden sm:block" />
            <button type="button" onClick={useExampleUrl} className="quick-action">Try an example <span aria-hidden="true">-&gt;</span></button>
          </div>

          {/* Advanced Options Accordion */}
            <div className={`overflow-hidden transition-all duration-700 ease-in-out ${showAdvanced ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-6 pt-2 border-t border-border-glass/50 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">

                <div className="space-y-1">
                  <label className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase">Custom Alias</label>
                  <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-body-md">/</span>
                    <input
                      type="text"
                      placeholder="my-brand"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-8 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase">Password Protection</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">lock</span>
                    <input
                      type="password"
                      placeholder="Optional password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase">Expiration Date</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">event</span>
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase">Click Limit</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">pin</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="Max clicks allowed (optional)"
                      value={maxClicks}
                      onChange={(e) => setMaxClicks(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase">Fallback URL</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">shortcut</span>
                    <input
                      type="url"
                      placeholder="Redirect fallback on expire/disable"
                      value={fallbackUrl}
                      onChange={(e) => setFallbackUrl(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase">Tags / Categories</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">label</span>
                    <input
                      type="text"
                      placeholder="e.g. promo, summer, v1"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase">Security Mode</label>
                  <div className="flex items-center gap-2 bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 px-3 h-[38px]">
                    <input
                      type="checkbox"
                      id="is-one-time"
                      checked={isOneTime}
                      onChange={(e) => setIsOneTime(e.target.checked)}
                      className="rounded border-border-glass bg-transparent text-primary focus:ring-primary cursor-pointer w-4 h-4"
                    />
                    <label htmlFor="is-one-time" className="text-body-sm text-on-surface cursor-pointer flex items-center gap-1.5 font-semibold">
                      <span className="material-symbols-outlined text-[16px] text-error animate-heartbeat">local_fire_department</span> Burn after reading
                    </label>
                  </div>
                </div>

                <div className="md:col-span-3 mt-4 mb-2">
                  <h4 className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">campaign</span> UTM Builder
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="utm_source (e.g. google)"
                        value={utmSource}
                        onChange={(e) => setUtmSource(e.target.value)}
                        className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 px-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="utm_medium (e.g. cpc)"
                        value={utmMedium}
                        onChange={(e) => setUtmMedium(e.target.value)}
                        className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 px-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="utm_campaign (e.g. summer_sale)"
                        value={utmCampaign}
                        onChange={(e) => setUtmCampaign(e.target.value)}
                        className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 px-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3 mt-4 border-t border-border-glass/30 pt-4">
                  <h4 className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">share</span> Custom Social Previews (Open Graph)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Preview Title (e.g. My Website)"
                        value={ogTitle}
                        onChange={(e) => setOgTitle(e.target.value)}
                        className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 px-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Preview Image URL"
                        value={ogImage}
                        onChange={(e) => setOgImage(e.target.value)}
                        className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 px-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                      />
                    </div>
                    <div className="relative md:col-span-3">
                      <textarea
                        placeholder="Preview Description (e.g. Description of page content)"
                        value={ogDescription}
                        onChange={(e) => setOgDescription(e.target.value)}
                        rows="2"
                        className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 px-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3 mt-4 border-t border-border-glass/30 pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h4 className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">devices</span> Smart App Deep Linking Presets
                    </h4>
                    <span className="text-[11px] text-tertiary">Quick autofill for popular apps</span>
                  </div>

                  {/* 1-Click Platform Presets */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { name: "YouTube", ios: "vnd.youtube://", android: "https://play.google.com/store/apps/details?id=com.google.android.youtube", icon: "smart_display" },
                      { name: "Instagram", ios: "instagram://", android: "https://play.google.com/store/apps/details?id=com.instagram.android", icon: "photo_camera" },
                      { name: "WhatsApp", ios: "whatsapp://", android: "https://play.google.com/store/apps/details?id=com.whatsapp", icon: "chat" },
                      { name: "Spotify", ios: "spotify://", android: "https://play.google.com/store/apps/details?id=com.spotify.music", icon: "music_note" },
                      { name: "Telegram", ios: "tg://", android: "https://play.google.com/store/apps/details?id=org.telegram.messenger", icon: "send" }
                    ].map((app) => (
                      <button
                        key={app.name}
                        type="button"
                        onClick={() => {
                          setIphoneUrl(app.ios);
                          setAndroidUrl(app.android);
                          addToast(`${app.name} deep link preset applied`, "info");
                        }}
                        className="px-3 py-1.5 rounded-lg border border-border-glass/60 bg-surface-container-high/40 hover:bg-surface-glass text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px] text-primary">{app.icon}</span>
                        <span>{app.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">phone_iphone</span>
                      <input
                        type="url"
                        placeholder="iOS Redirect URL (e.g. appstore link)"
                        value={iphoneUrl}
                        onChange={(e) => setIphoneUrl(e.target.value)}
                        className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                      />
                    </div>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">phone_android</span>
                      <input
                        type="url"
                        placeholder="Android Redirect URL (e.g. playstore link)"
                        value={androidUrl}
                        onChange={(e) => setAndroidUrl(e.target.value)}
                        className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3 mt-4 border-t border-border-glass/30 pt-4">
                  <h4 className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">api</span> Real-time Webhooks
                  </h4>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">link</span>
                    <input
                      type="url"
                      placeholder="Webhook URL (POST payload triggered on link clicks)"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                    />
                  </div>
                </div>

                <div className="md:col-span-3 mt-4 border-t border-border-glass/30 pt-4">
                  <h4 className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">hourglass_empty</span> Redirection Splash Screen (Interstitial Branding)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative md:col-span-2">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">chat_bubble</span>
                      <input
                        type="text"
                        placeholder="Splash Message (e.g. Thanks for visiting! Check out our summer sale.)"
                        value={splashMessage}
                        onChange={(e) => setSplashMessage(e.target.value)}
                        className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                      />
                    </div>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">timer</span>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        placeholder="Countdown (seconds)"
                        value={splashDelay}
                        onChange={(e) => setSplashDelay(e.target.value)}
                        className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3 mt-4 border-t border-border-glass/30 pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">call_split</span> A/B Split Testing (Rotational Routing)
                    </h4>
                    <Button
                      type="button"
                      variant="outline"
                      className="!py-1 !px-3 text-[12px] h-auto"
                      onClick={() => setAbTestTargets(prev => [...prev, { url: "", weight: 50 }])}
                    >
                      + Add Target
                    </Button>
                  </div>

                  {abTestTargets.length === 0 ? (
                    <p className="text-text-muted text-xs ml-1">No split targets configured. All clicks go to the main destination link.</p>
                  ) : (
                    <div className="space-y-3">
                      {abTestTargets.map((target, index) => (
                        <div key={index} className="flex flex-col md:flex-row items-center gap-3">
                          <div className="relative flex-grow w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">link</span>
                            <input
                              type="url"
                              placeholder="Split Destination URL (e.g. https://variant-a.com)"
                              value={target.url}
                              onChange={(e) => {
                                const newTargets = [...abTestTargets];
                                newTargets[index].url = e.target.value;
                                setAbTestTargets(newTargets);
                              }}
                              className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                              required
                            />
                          </div>
                          <div className="relative w-full md:w-32 flex-shrink-0">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">percent</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="Weight"
                              value={target.weight}
                              onChange={(e) => {
                                const newTargets = [...abTestTargets];
                                newTargets[index].weight = e.target.value;
                                setAbTestTargets(newTargets);
                              }}
                              className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setAbTestTargets(prev => prev.filter((_, i) => i !== index))}
                            className="material-symbols-outlined text-error hover:text-red-400 active:scale-95 transition-colors p-2"
                            title="Remove Target"
                          >
                            delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-3 mt-4 border-t border-border-glass/30 pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-label-sm font-label-sm text-on-surface-variant ml-1 uppercase flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">public</span> Geo-Targeting (Location-Based Redirection)
                    </h4>
                    <Button
                      type="button"
                      variant="outline"
                      className="!py-1 !px-3 text-[12px] h-auto"
                      onClick={() => setGeoTargets(prev => [...prev, { country: "", url: "" }])}
                    >
                      + Add Country Target
                    </Button>
                  </div>

                  {geoTargets.length === 0 ? (
                    <p className="text-text-muted text-xs ml-1">No location targets configured. All clicks go to the main destination link.</p>
                  ) : (
                    <div className="space-y-3">
                      {geoTargets.map((target, index) => (
                        <div key={index} className="flex flex-col md:flex-row items-center gap-3">
                          <div className="relative w-full md:w-48 flex-shrink-0">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">flag</span>
                            <input
                              type="text"
                              maxLength="2"
                              placeholder="Country Code (e.g. US, GB, IN)"
                              value={target.country}
                              onChange={(e) => {
                                const newGeo = [...geoTargets];
                                newGeo[index].country = e.target.value;
                                setGeoTargets(newGeo);
                              }}
                              className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm uppercase"
                              required
                            />
                          </div>
                          <div className="relative flex-grow w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">link</span>
                            <input
                              type="url"
                              placeholder="Destination URL for this country"
                              value={target.url}
                              onChange={(e) => {
                                const newGeo = [...geoTargets];
                                newGeo[index].url = e.target.value;
                                setGeoTargets(newGeo);
                              }}
                              className="w-full bg-surface-container-lowest/50 border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setGeoTargets(prev => prev.filter((_, i) => i !== index))}
                            className="material-symbols-outlined text-error hover:text-red-400 active:scale-95 transition-colors p-2"
                            title="Remove Target"
                          >
                            delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 animate-fade-in-up">
              <div className="bg-error-container text-on-error-container border border-error/20 px-4 py-3 rounded-xl flex items-center gap-3">
                <span className="material-symbols-outlined">error</span>
                <p className="font-label-sm text-sm font-bold">{error}</p>
              </div>
            </div>
          )}

          {/* Result Card */}
          {shortUrl && (
            <div className="w-full max-w-md glass-panel p-6 rounded-xl card-hover-lift animate-fade-in-up" id="result-card">
              <div className="flex justify-between items-center">
                <div className="text-left overflow-hidden min-w-0 w-full">
                  <span className="text-label-sm font-label-sm text-primary uppercase tracking-wider block mb-1">Your new link is ready</span>
                  <span className="font-display-lg text-headline-md sm:text-display-sm text-on-surface truncate block min-w-0 break-all sm:break-normal">{shortUrl}</span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="w-12 h-12 flex-shrink-0 ml-4 flex items-center justify-center rounded-lg bg-surface-glass border border-border-glass hover:bg-surface-container-high transition-colors active:scale-90"
                  title="Copy to clipboard"
                >
                  <span className="material-symbols-outlined text-primary">content_copy</span>
                </button>
              </div>
              <div className="mt-4 flex items-center gap-4 text-label-sm font-label-sm text-text-muted">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">visibility</span> 0 clicks</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span> Expires in 30 days</span>
              </div>
            </div>
          )}

          {/* Bulk Results Card */}
          {bulkResults.length > 0 && (
            <div className="w-full max-w-3xl glass-panel p-6 rounded-2xl card-hover-lift animate-fade-in-up text-left">
              <h3 className="text-headline-sm text-on-surface font-semibold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">done_all</span> Shortened Links ({bulkResults.filter(r => !r.error).length})
              </h3>
              <div className="divide-y divide-border-glass max-h-80 overflow-y-auto pr-2">
                {bulkResults.map((result, idx) => (
                  <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="overflow-hidden flex-grow max-w-lg min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap sm:flex-nowrap">
                        {result.favicon && (
                          <img src={result.favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" onError={(e) => e.target.style.display='none'} />
                        )}
                        <span className="text-body-md text-on-surface font-semibold truncate block w-full min-w-0">
                          {result.title || result.longUrl}
                        </span>
                      </div>
                      <span className="text-body-sm text-text-muted truncate block w-full min-w-0">{result.longUrl}</span>
                      {Array.isArray(result.tags) && result.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {result.tags.map((t, tIdx) => (
                            <span key={tIdx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {result.error ? (
                      <span className="text-xs text-error font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">error</span> {result.error}
                      </span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <a
                          href={`${API_URL || window.location.origin}/${result.shortCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-semibold hover:underline"
                        >
                          /{result.shortCode}
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${API_URL || window.location.origin}/${result.shortCode}`)
                              .then(() => addToast("Copied to clipboard!", "success"))
                              .catch(() => addToast("Unable to copy the URL.", "error"));
                          }}
                          className="w-8 h-8 rounded bg-surface-container-high hover:bg-primary/20 hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
                          title="Copy Link"
                        >
                          <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Bento Grid Stats */}
        <section className="max-w-container-max w-full pb-20 grid grid-cols-1 md:grid-cols-3 gap-stack-md animate-fade-in-up [animation-delay:600ms]">
          <TiltCard className="md:col-span-2">
            <div className="glass-panel p-8 rounded-2xl relative overflow-hidden group h-full">
              <div className="relative z-10">
                <h3 className="font-display-lg text-headline-md text-on-surface mb-2">Advanced Analytics</h3>
                <p className="text-text-muted max-w-md mb-6">Deep dive into your link performance with geographic, device, and referral data in real-time.</p>

                <div className="h-32 w-full flex items-end gap-2 px-2">
                  <div className="flex-1 bg-primary/20 h-[40%] rounded-t-sm group-hover:bg-primary/40 transition-all duration-500"></div>
                  <div className="flex-1 bg-primary/20 h-[60%] rounded-t-sm group-hover:bg-primary/40 transition-all duration-500 delay-75"></div>
                  <div className="flex-1 bg-primary/20 h-[30%] rounded-t-sm group-hover:bg-primary/40 transition-all duration-500 delay-100"></div>
                  <div className="flex-1 bg-primary/20 h-[80%] rounded-t-sm group-hover:bg-primary/40 transition-all duration-500 delay-150"></div>
                  <div className="flex-1 bg-primary/20 h-[55%] rounded-t-sm group-hover:bg-primary/40 transition-all duration-500 delay-200"></div>
                  <div className="flex-1 bg-primary/20 h-[90%] rounded-t-sm group-hover:bg-primary/40 transition-all duration-500 delay-300"></div>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-primary/20 transition-all duration-1000"></div>
            </div>
          </TiltCard>

          <TiltCard>
            <div className="glass-panel p-8 rounded-2xl flex flex-col justify-between h-full group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-tertiary/0 group-hover:bg-tertiary/5 transition-all duration-500 pointer-events-none"></div>
              <div>
                <span className="material-symbols-outlined text-tertiary text-[40px] mb-4 group-hover:scale-110 transition-transform duration-500" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
                <h3 className="font-display-lg text-headline-md text-on-surface mb-2">Secure Links</h3>
              </div>
              <p className="text-text-muted">Password protection, link expiration, and HTTPS by default for all your redirects.</p>
            </div>
          </TiltCard>

          <TiltCard>
            <div className="glass-panel p-8 rounded-2xl flex flex-col justify-between h-full group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-secondary/0 group-hover:bg-secondary/5 transition-all duration-500 pointer-events-none"></div>
              <div>
                <span className="material-symbols-outlined text-secondary text-[40px] mb-4 group-hover:scale-110 transition-transform duration-500" style={{ fontVariationSettings: "'FILL' 1" }}>branding_watermark</span>
                <h3 className="font-display-lg text-headline-md text-on-surface mb-2">Custom Domains</h3>
              </div>
              <p className="text-text-muted">Connect your own brand domain and create custom backhalves for higher CTR.</p>
            </div>
          </TiltCard>

          <TiltCard className="md:col-span-2">
            <div className="glass-panel p-8 rounded-2xl flex flex-col md:flex-row items-center gap-8 h-full group relative overflow-hidden">
              <div className="w-24 h-24 shrink-0 rounded-full bg-accent-gradient p-1 group-hover:scale-105 transition-transform duration-500">
                <div className="w-full h-full rounded-full bg-surface-dim flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[32px]">bolt</span>
                </div>
              </div>
              <div>
                <h3 className="font-display-lg text-headline-md text-on-surface mb-2">Lightning Fast Redirects</h3>
                <p className="text-text-muted">Built on a global edge network, your links redirect in under 50ms anywhere in the world.</p>
              </div>
            </div>
          </TiltCard>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 bg-surface-dim border-t border-border-glass relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-stack-md px-gutter max-w-container-max mx-auto">
          <div className="font-display-lg text-headline-md text-primary">ShortyURL</div>
          <div className="flex gap-6">
            <a className="font-label-sm text-label-sm text-text-muted hover:text-on-surface transition-colors underline" href="#">Terms</a>
            <a className="font-label-sm text-label-sm text-text-muted hover:text-on-surface transition-colors" href="#">Privacy</a>
            <a className="font-label-sm text-label-sm text-text-muted hover:text-on-surface transition-colors" href="#">Status</a>
            <a className="font-label-sm text-label-sm text-text-muted hover:text-on-surface transition-colors" href="#">Support</a>
          </div>
          <p className="font-label-sm text-label-sm text-text-muted">(c) {new Date().getFullYear()} ShortyURL. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
};

export default Home;
