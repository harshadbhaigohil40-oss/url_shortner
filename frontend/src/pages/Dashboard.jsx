import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { apiFetch, API_URL } from "../utils/api";
import { useToast } from "../context/ToastContextInstance";
import GlassCard from "../components/ui/GlassCard";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { SkeletonRow, MobileSkeletonCard } from "../components/ui/Skeleton";
import ShaderBackground from "../components/ShaderBackground";
import BioPageList from "../components/BioPageList";
import BioBuilder from "./BioBuilder";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import WorldMapAnalytics from "../components/ui/WorldMapAnalytics";

const Dashboard = () => {
  const { user, login, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [generatingKey, setGeneratingKey] = useState(false);
  const [activeTab, setActiveTab] = useState("links"); // 'links' | 'biopages'
  const [isBuildingBio, setIsBuildingBio] = useState(false);
  const [editingBioPage, setEditingBioPage] = useState(null);
  const [stats, setStats] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: "", message: "", onConfirm: null, confirmText: "Confirm" });
  
  // Pagination & Search & Sort
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [analyticsDays, setAnalyticsDays] = useState(7);
  
  // Expanded row state for Analytics & QR
  const [expandedId, setExpandedId] = useState(null);

  // Edit & Toggle Link State
  const [editingUrl, setEditingUrl] = useState(null);
  const [editLongUrl, setEditLongUrl] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [updatingUrl, setUpdatingUrl] = useState(false);
  const [editOgTitle, setEditOgTitle] = useState("");
  const [editOgDescription, setEditOgDescription] = useState("");
  const [editOgImage, setEditOgImage] = useState("");
  const [editIphoneUrl, setEditIphoneUrl] = useState("");
  const [editAndroidUrl, setEditAndroidUrl] = useState("");
  const [editWebhookUrl, setEditWebhookUrl] = useState("");
  const [editMaxClicks, setEditMaxClicks] = useState("");
  const [editFallbackUrl, setEditFallbackUrl] = useState("");
  const [editSplashMessage, setEditSplashMessage] = useState("");
  const [editSplashDelay, setEditSplashDelay] = useState("");
  const [editIsOneTime, setEditIsOneTime] = useState(false);
  const [editAbTestTargets, setEditAbTestTargets] = useState([]);
  const [editGeoTargets, setEditGeoTargets] = useState([]);

  // Custom QR Designer State
  const [qrFgColor, setQrFgColor] = useState("#060e20");
  const [qrBgColor, setQrBgColor] = useState("#ffffff");
  const [qrIncludeLogo, setQrIncludeLogo] = useState(false);

  // Developer API Key Management State
  const [apiKeyInfo, setApiKeyInfo] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [revokingKey, setRevokingKey] = useState(false);
  const [codeSnippetLang, setCodeSnippetLang] = useState("curl");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (!user) return;

    const fetchApiKeyDetails = async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/auth/api-key`, {}, user, login, logout);
        if (res.ok) {
          const data = await res.json();
          setApiKeyInfo(data);
          if (data.apiKey) setApiKey(data.apiKey);
        }
      } catch (err) {
        console.error("API Key info fetch error:", err);
      }
    };

    fetchApiKeyDetails();
  }, [user, login, logout]);

  useEffect(() => {
    if (!user) return;

    const fetchUrls = async () => {
      setLoading(true);
      try {
        const [res, statsRes] = await Promise.all([
          apiFetch(`${API_URL}/api/myurls?page=${page}&limit=10&search=${encodeURIComponent(debouncedSearch)}&sortBy=${sortBy}&order=${order}`, {}, user, login, logout),
          apiFetch(`${API_URL}/api/myurls/stats`, {}, user, login, logout)
        ]);
        
        if (res.ok) {
          const data = await res.json();
          setUrls(data.urls || []);
          setTotalPages(data.totalPages || 1);
        }
        
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error("Error fetching urls:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUrls();
  }, [user, navigate, page, debouncedSearch, sortBy, order, login, logout]);

  const { addToast } = useToast();

  const downloadQR = (shortCode) => {
    const canvas = document.getElementById(`qr-${shortCode}`);
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
      let downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `qr-${shortCode}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      addToast('QR Code downloaded', 'success');
    } else {
      addToast('Failed to download QR code', 'error');
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const copyToClipboard = (shortUrl) => {
    navigator.clipboard.writeText(shortUrl);
    addToast('Copied to clipboard!', 'success');
  };

  const deleteUrl = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete URL",
      message: "Are you sure you want to delete this URL? This cannot be undone.",
      confirmText: "Delete",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await apiFetch(`${API_URL}/api/urls/${id}`, {
            method: 'DELETE',
          }, user, login, logout);
          if (res.ok) {
            setUrls(prev => prev.filter(u => u._id !== id));
            addToast('URL deleted successfully', 'success');
          } else {
            const data = await res.json();
            addToast(data.message || 'Failed to delete URL', 'error');
          }
        } catch (err) {
          console.error("URL delete error:", err);
          addToast('Error deleting URL', 'error');
        }
      }
    });
  };

  const toggleUrlStatus = async (id, currentStatus) => {
    try {
      const res = await apiFetch(`${API_URL}/api/urls/${id}/toggle`, {
        method: 'PUT',
      }, user, login, logout);
      if (res.ok) {
        setUrls(prev => prev.map(u => u._id === id ? { ...u, isActive: !currentStatus } : u));
        addToast(`Link ${currentStatus ? 'paused' : 'activated'} successfully`, 'success');
      } else {
        const data = await res.json();
        addToast(data.message || 'Failed to toggle URL status', 'error');
      }
    } catch (err) {
      console.error("URL toggle status error:", err);
      addToast('Error toggling URL status', 'error');
    }
  };

  const openEditModal = (url) => {
    setEditingUrl(url);
    setEditLongUrl(url.longUrl);
    setEditPassword("");
    setEditExpiresAt(url.expiresAt ? new Date(url.expiresAt).toISOString().slice(0, 16) : "");
    setRemovePassword(false);
    setEditOgTitle(url.ogTitle || "");
    setEditOgDescription(url.ogDescription || "");
    setEditOgImage(url.ogImage || "");
    setEditIphoneUrl(url.iphoneUrl || "");
    setEditAndroidUrl(url.androidUrl || "");
    setEditWebhookUrl(url.webhookUrl || "");
    setEditMaxClicks(url.maxClicks || "");
    setEditFallbackUrl(url.fallbackUrl || "");
    setEditSplashMessage(url.splashMessage || "");
    setEditSplashDelay(url.splashDelay || "");
    setEditIsOneTime(url.isOneTime || false);
    setEditAbTestTargets(url.abTestTargets || []);
    setEditGeoTargets(url.geoTargets || []);
  };

  const closeEditModal = () => {
    setEditingUrl(null);
    setEditLongUrl("");
    setEditPassword("");
    setEditExpiresAt("");
    setRemovePassword(false);
    setEditOgTitle("");
    setEditOgDescription("");
    setEditOgImage("");
    setEditIphoneUrl("");
    setEditAndroidUrl("");
    setEditWebhookUrl("");
    setEditMaxClicks("");
    setEditFallbackUrl("");
    setEditSplashMessage("");
    setEditSplashDelay("");
    setEditIsOneTime(false);
    setEditAbTestTargets([]);
    setEditGeoTargets([]);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editLongUrl) return;
    setUpdatingUrl(true);
    try {
      const payload = {
        longUrl: editLongUrl,
        expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
        ogTitle: editOgTitle || null,
        ogDescription: editOgDescription || null,
        ogImage: editOgImage || null,
        iphoneUrl: editIphoneUrl || null,
        androidUrl: editAndroidUrl || null,
        webhookUrl: editWebhookUrl || null,
        maxClicks: editMaxClicks ? parseInt(editMaxClicks, 10) : null,
        fallbackUrl: editFallbackUrl || null,
        splashMessage: editSplashMessage || null,
        splashDelay: editSplashDelay ? parseInt(editSplashDelay, 10) : null,
        isOneTime: !!editIsOneTime,
        abTestTargets: editAbTestTargets && editAbTestTargets.length > 0
          ? editAbTestTargets
              .filter(t => t.url.trim() !== "")
              .map(t => ({ url: t.url.trim(), weight: parseInt(t.weight, 10) || 0 }))
          : [],
        geoTargets: editGeoTargets && editGeoTargets.length > 0
          ? editGeoTargets
              .filter(t => t.country.trim() !== "" && t.url.trim() !== "")
              .map(t => ({ country: t.country.trim().toUpperCase(), url: t.url.trim() }))
          : []
      };

      if (editPassword !== "") {
        payload.password = editPassword;
      }

      if (removePassword) {
        payload.password = "";
      }

      const res = await apiFetch(`${API_URL}/api/urls/${editingUrl._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, user, login, logout);

      if (res.ok) {
        const updatedUrl = await res.json();
        setUrls(prev => prev.map(u => u._id === editingUrl._id ? updatedUrl : u));
        addToast('URL settings updated successfully', 'success');
        closeEditModal();
      } else {
        const data = await res.json();
        addToast(data.message || 'Failed to update URL settings', 'error');
      }
    } catch (err) {
      console.error("URL edit error:", err);
      addToast('Error updating URL settings', 'error');
    } finally {
      setUpdatingUrl(false);
    }
  };

  const handleGenerateApiKey = () => {
    setConfirmDialog({
      isOpen: true,
      title: apiKey ? "Regenerate API Key" : "Generate API Key",
      message: apiKey 
        ? "Are you sure? Regenerating will immediately invalidate your previous key and any active integrations will lose access."
        : "Generate a personal access token for programmatic REST API access?",
      confirmText: apiKey ? "Regenerate Key" : "Generate Key",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setGeneratingKey(true);
        try {
          const res = await apiFetch(`${API_URL}/api/auth/generate-api-key`, {
            method: 'POST'
          }, user, login, logout);
          if (res.ok) {
            const data = await res.json();
            setApiKey(data.apiKey);
            setApiKeyInfo(data);
            addToast('Developer API Key generated successfully', 'success');
          } else {
            addToast('Failed to generate API Key', 'error');
          }
        } catch (err) {
          console.error("API Key generation error:", err);
          addToast('Error generating API Key', 'error');
        } finally {
          setGeneratingKey(false);
        }
      }
    });
  };

  const handleRevokeApiKey = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Revoke API Key",
      message: "Are you sure you want to revoke your API key? All applications using this token will lose access immediately.",
      confirmText: "Revoke Key",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setRevokingKey(true);
        try {
          const res = await apiFetch(`${API_URL}/api/auth/api-key`, {
            method: 'DELETE'
          }, user, login, logout);
          if (res.ok) {
            setApiKey(null);
            setApiKeyInfo(null);
            addToast('API Key revoked successfully', 'success');
          } else {
            addToast('Failed to revoke API Key', 'error');
          }
        } catch (err) {
          console.error("API Key revocation error:", err);
          addToast('Error revoking API Key', 'error');
        } finally {
          setRevokingKey(false);
        }
      }
    });
  };

  const exportToCSV = () => {
    if (urls.length === 0) return addToast('No URLs to export', 'error');
    
    const headers = ['Original URL', 'Short URL', 'Clicks', 'Title', 'Created At'];
    const csvRows = [headers.join(',')];
    
    urls.forEach(url => {
      const row = [
        `"${url.longUrl}"`,
        `"${API_URL}/${url.shortCode}"`,
        url.clicks,
        `"${url.title || ''}"`,
        `"${new Date(url.createdAt).toLocaleDateString()}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `shortyurl-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
    addToast('Exported successfully', 'success');
  };

  // Helper to process click history into chart data
  const getChartData = (clickHistory) => {
    if (!clickHistory || clickHistory.length === 0) return [];
    
    // Group by date
    const counts = {};
    clickHistory.forEach(click => {
      const date = new Date(click.timestamp).toLocaleDateString();
      counts[date] = (counts[date] || 0) + 1;
    });

    // Convert to array
    return Object.keys(counts).map(date => ({
      date,
      clicks: counts[date]
    })).slice(-analyticsDays); // Last 7 or 30 days of activity
  };

  const getPieData = (clickHistory, field) => {
    if (!clickHistory || clickHistory.length === 0) return [];
    const counts = {};
    clickHistory.forEach(click => {
      const val = click[field] || "Unknown";
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.keys(counts).map(name => ({
      name,
      value: counts[name]
    })).sort((a, b) => b.value - a.value).slice(0, 5); // top 5
  };

  const COLORS = ['#ddb7ff', '#b388eb', '#8a5cda', '#6134c4', '#411c9c'];

  const shareOnSocial = (platform, url) => {
    const text = "Check out this link!";
    let shareUrl = "";
    if (platform === 'twitter') shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    if (platform === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    if (platform === 'linkedin') shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  if (isBuildingBio) {
    return (
      <BioBuilder
        bioPage={editingBioPage}
        onBack={() => {
          setIsBuildingBio(false);
          setEditingBioPage(null);
        }}
        onSaveSuccess={() => {
          setIsBuildingBio(false);
          setEditingBioPage(null);
          setActiveTab("biopages");
        }}
      />
    );
  }

  return (
    <>
      <ShaderBackground />
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen} 
        title={confirmDialog.title} 
        message={confirmDialog.message} 
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm} 
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} 
      />
      <main className="relative pt-24 pb-12 px-gutter max-w-container-max mx-auto min-h-[calc(100vh-64px)] z-10">
        
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <GlassCard className="p-6">
              <div className="text-on-surface-variant font-label-sm uppercase tracking-wider mb-2">Total URLs</div>
              <div className="font-display-lg text-display-md text-on-surface">{stats.totalUrls}</div>
            </GlassCard>
            <GlassCard className="p-6">
              <div className="text-on-surface-variant font-label-sm uppercase tracking-wider mb-2">Total Clicks</div>
              <div className="font-display-lg text-display-md text-on-surface">{stats.totalClicks}</div>
            </GlassCard>
            <GlassCard className="p-6">
              <div className="text-on-surface-variant font-label-sm uppercase tracking-wider mb-2">Active URLs</div>
              <div className="font-display-lg text-display-md text-on-surface">{stats.activeUrls}</div>
            </GlassCard>
            <GlassCard className="p-6">
              <div className="text-on-surface-variant font-label-sm uppercase tracking-wider mb-2">Top URL Clicks</div>
              <div className="font-display-lg text-display-md text-tertiary">
                {stats.topUrl ? stats.topUrl.clicks : 0}
              </div>
            </GlassCard>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 mb-6 p-1.5 bg-surface-container-low border border-border-glass rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("links")}
            className={`px-5 py-2 rounded-lg font-headline-sm text-body-md transition-all flex items-center gap-2 ${
              activeTab === "links"
                ? "bg-primary text-on-primary shadow-md font-bold"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Shortened Links
          </button>
          <button
            onClick={() => setActiveTab("biopages")}
            className={`px-5 py-2 rounded-lg font-headline-sm text-body-md transition-all flex items-center gap-2 ${
              activeTab === "biopages"
                ? "bg-primary text-on-primary shadow-md font-bold"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">style</span>
            BioPages Builder
          </button>
        </div>

        {activeTab === "biopages" ? (
          <BioPageList
            onCreateNew={() => {
              setEditingBioPage(null);
              setIsBuildingBio(true);
            }}
            onEdit={(page) => {
              setEditingBioPage(page);
              setIsBuildingBio(true);
            }}
          />
        ) : (
          <>
            {/* Header Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-stack-md mb-8 animate-fade-in-up">
              <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg bg-clip-text text-transparent bg-accent-gradient">Your URLs</h1>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {/* Search Bar */}
            <Input 
              icon="search"
              placeholder="Search links..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              wrapperClassName="w-full sm:w-64"
            />
            
            {/* Sort Dropdown */}
            <div className="relative w-full sm:w-auto">
              <select 
                className="appearance-none w-full bg-surface-container-low border border-border-glass rounded-lg pl-4 pr-10 py-2 text-body-md focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all text-on-surface"
                value={`${sortBy}-${order}`}
                onChange={(e) => {
                  const [newSortBy, newOrder] = e.target.value.split('-');
                  setSortBy(newSortBy);
                  setOrder(newOrder);
                }}
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="clicks-desc">Most Clicks</option>
                <option value="clicks-asc">Least Clicks</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
            </div>
            
            {/* Export CSV Button */}
            <Button 
              variant="outline"
              icon="download"
              onClick={exportToCSV}
              className="w-full sm:w-auto"
            >
              Export CSV
            </Button>
            
            {/* New Link Button */}
            <Button 
              variant="gradient"
              icon="add"
              onClick={() => navigate('/')}
              className="w-full sm:w-auto"
            >
              New Link
            </Button>
          </div>
        </div>

        {/* Enterprise Developer API Management Dashboard */}
        <GlassCard className="mb-8 p-6 shadow-2xl card-hover-lift animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border-glass">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary">api</span> Developer API & Access Tokens
                </h2>
                {apiKey ? (
                  <span className="px-2.5 py-1 rounded-full text-label-sm font-label-sm font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Active Token
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-label-sm font-label-sm font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    No Key Generated
                  </span>
                )}
              </div>
              <p className="text-body-sm text-text-muted mt-1">Authenticate REST API requests programmatically via the <code className="font-mono text-tertiary">x-api-key</code> HTTP header.</p>
            </div>

            <div className="flex items-center gap-3">
              {apiKey && (
                <Button 
                  variant="outline" 
                  icon="delete_forever"
                  onClick={handleRevokeApiKey}
                  loading={revokingKey}
                  className="text-error hover:text-red-400 border-error/30"
                >
                  Revoke Key
                </Button>
              )}
              <Button 
                variant={apiKey ? "outline" : "gradient"}
                icon="key"
                onClick={handleGenerateApiKey}
                loading={generatingKey}
              >
                {apiKey ? "Rotate / Regenerate Key" : "Generate API Key"}
              </Button>
            </div>
          </div>

          {/* Key Overview & Rate Limits */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
            {/* Left Box: Key & Metrics */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 bg-surface-container-high rounded-2xl border border-border-glass space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant">Personal API Access Token</span>
                  {apiKey && (
                    <button 
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-body-sm font-body-sm text-tertiary hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">{showApiKey ? 'visibility_off' : 'visibility'}</span>
                      {showApiKey ? 'Hide Secret' : 'Show Secret'}
                    </button>
                  )}
                </div>

                {apiKey ? (
                  <div className="flex items-center gap-2 bg-surface-container-lowest p-3 rounded-xl border border-border-glass">
                    <code className="text-body-md font-mono text-primary flex-grow truncate">
                      {showApiKey ? apiKey : `${apiKey.substring(0, 7)}............................`}
                    </code>
                    <button 
                      onClick={() => copyToClipboard(apiKey)}
                      className="p-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 text-label-sm"
                      title="Copy Key"
                    >
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 text-center rounded-xl bg-surface-container-lowest/50 border border-dashed border-border-glass text-text-muted text-body-sm">
                    No active API key. Click "Generate API Key" to enable programmatic API access.
                  </div>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-surface-container-low rounded-xl border border-border-glass text-center">
                  <div className="text-label-sm text-text-muted uppercase mb-1 font-label-sm">Daily Requests</div>
                  <div className="font-display-lg text-headline-sm text-on-surface">
                    {apiKeyInfo?.requestCount || 0} <span className="text-body-sm text-text-muted font-normal">/ {apiKeyInfo?.rateLimit || 1000}</span>
                  </div>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl border border-border-glass text-center">
                  <div className="text-label-sm text-text-muted uppercase mb-1 font-label-sm">Created Date</div>
                  <div className="text-body-sm font-bold text-on-surface truncate">
                    {apiKeyInfo?.createdAt ? new Date(apiKeyInfo.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl border border-border-glass text-center">
                  <div className="text-label-sm text-text-muted uppercase mb-1 font-label-sm">Last Used</div>
                  <div className="text-body-sm font-bold text-tertiary truncate">
                    {apiKeyInfo?.lastUsed ? new Date(apiKeyInfo.lastUsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Box: Code Snippet Generator */}
            <div className="lg:col-span-6 flex flex-col justify-between p-4 bg-surface-container-high rounded-2xl border border-border-glass">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-tertiary">code</span> Code Snippets
                  </span>
                  
                  {/* Language Selector Tabs */}
                  <div className="flex gap-1 p-1 bg-surface-container-lowest rounded-lg border border-border-glass">
                    {['curl', 'javascript', 'python'].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setCodeSnippetLang(lang)}
                        className={`px-2.5 py-1 rounded-md text-label-sm font-bold uppercase transition-all ${
                          codeSnippetLang === lang 
                            ? 'bg-primary text-on-primary shadow-sm' 
                            : 'text-text-muted hover:text-on-surface'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative bg-surface-container-lowest p-3.5 rounded-xl border border-border-glass font-mono text-body-sm text-purple-300 overflow-x-auto max-h-36">
                  <pre className="whitespace-pre-wrap break-all text-[12px] leading-relaxed">
                    {codeSnippetLang === 'curl' && `curl -X POST "${API_URL}/api/shorten" \\\n  -H "x-api-key: ${apiKey || 'YOUR_API_KEY'}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"longUrl": "https://example.com"}'`}
                    {codeSnippetLang === 'javascript' && `const res = await fetch('${API_URL}/api/shorten', {\n  method: 'POST',\n  headers: {\n    'x-api-key': '${apiKey || 'YOUR_API_KEY'}',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({ longUrl: 'https://example.com' })\n});\nconst data = await res.json();`}
                    {codeSnippetLang === 'python' && `import requests\n\nres = requests.post('${API_URL}/api/shorten',\n  headers={'x-api-key': '${apiKey || 'YOUR_API_KEY'}'},\n  json={'longUrl': 'https://example.com'}\n)\nprint(res.json())`}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  onClick={() => {
                    const snippet = codeSnippetLang === 'curl' 
                      ? `curl -X POST "${API_URL}/api/shorten" -H "x-api-key: ${apiKey || 'YOUR_API_KEY'}" -H "Content-Type: application/json" -d '{"longUrl": "https://example.com"}'`
                      : codeSnippetLang === 'javascript'
                      ? `fetch('${API_URL}/api/shorten', { method: 'POST', headers: { 'x-api-key': '${apiKey || 'YOUR_API_KEY'}', 'Content-Type': 'application/json' }, body: JSON.stringify({ longUrl: 'https://example.com' }) });`
                      : `import requests\nres = requests.post('${API_URL}/api/shorten', headers={'x-api-key': '${apiKey || 'YOUR_API_KEY'}'}, json={'longUrl': 'https://example.com'})`;
                    copyToClipboard(snippet);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-highest text-on-surface border border-border-glass text-label-sm font-bold flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  Copy Code Snippet
                </button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Main Glass Table Card */}
        <GlassCard className="shadow-2xl card-hover-lift animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="border-b border-border-glass bg-surface-glass">
                  <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Original URL</th>
                  <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Short URL</th>
                  <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-center">Clicks</th>
                  <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-glass">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : urls.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-16">
                      <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center border border-border-glass">
                          <span className="material-symbols-outlined text-[32px] text-primary">link</span>
                        </div>
                        <h3 className="font-display-lg text-headline-sm text-on-surface">No links found</h3>
                        <p className="text-body-sm text-on-surface-variant max-w-sm">You haven't created any short links yet. Start sharing faster, branded links today.</p>
                        <Button variant="gradient" icon="add" onClick={() => navigate('/')} className="mt-2">
                          Create Your First Link
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  urls.map((url) => (
                    <React.Fragment key={url._id}>
                      <tr className="hover:bg-surface-glass transition-colors">
                        <td className="px-6 py-4 max-w-xs truncate">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {url.favicon ? (
                                <img src={url.favicon} alt="icon" className="w-4 h-4 rounded-sm" onError={(e) => e.target.style.display='none'} />
                              ) : (
                                <span className="material-symbols-outlined text-[16px] text-text-muted">link</span>
                              )}
                              <span className="text-body-md text-on-surface font-semibold truncate" title={url.title || url.longUrl}>
                                {url.title || "Untitled Link"}
                              </span>
                              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${url.isActive ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' : 'bg-amber-950/40 text-amber-400 border border-amber-500/20'}`}>
                                {url.isActive ? 'Active' : 'Paused'}
                              </span>
                              {url.expiresAt && new Date(url.expiresAt) > new Date() && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold inline-block bg-purple-950/40 text-purple-400 border border-purple-500/20" title={`Expires ${new Date(url.expiresAt).toLocaleString()}`}>
                                  Expiring soon
                                </span>
                              )}
                              {url.expiresAt && new Date(url.expiresAt) <= new Date() && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold inline-block bg-rose-950/40 text-rose-400 border border-rose-500/20">
                                  Expired
                                </span>
                              )}
                            </div>
                            <span className="text-body-sm text-text-muted truncate ml-6 min-w-0 break-all sm:break-normal" title={url.longUrl}>
                              {url.longUrl}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 group">
                            <a 
                              className="text-primary font-semibold hover:underline flex items-center gap-1" 
                              href={`${API_URL}/${url.shortCode}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              {url.isOneTime && <span className="material-symbols-outlined text-[16px] text-error animate-pulse" title="One-Time Link (Burn After Reading)">local_fire_department</span>}
                              {url.password && <span className="material-symbols-outlined text-[16px] text-tertiary" title="Password Protected">lock</span>}
                              <span>{url.shortCode}</span>
                            </a>
                            <button 
                              onClick={() => copyToClipboard(`${API_URL}/${url.shortCode}`)}
                              className="material-symbols-outlined text-[18px] text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary active:scale-90"
                              title="Copy URL"
                            >
                              content_copy
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-label-sm font-semibold inline-block">
                              {url.clicks} {url.maxClicks ? `/ ${url.maxClicks}` : ''}
                            </span>
                            {url.maxClicks && (
                              <div className="w-16 h-1 bg-surface-container-highest rounded-full overflow-hidden border border-border-glass">
                                <div 
                                  className="h-full bg-primary rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(100, (url.clicks / url.maxClicks) * 100)}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-1">
                            <button 
                              onClick={() => toggleUrlStatus(url._id, url.isActive)}
                              className={`material-symbols-outlined p-2 rounded-lg transition-colors ${url.isActive ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-amber-400 hover:bg-amber-500/10'}`}
                              title={url.isActive ? "Pause Link Redirects" : "Resume Link Redirects"}
                            >
                              {url.isActive ? 'pause_circle' : 'play_circle'}
                            </button>
                            <button 
                              onClick={() => openEditModal(url)}
                              className="material-symbols-outlined text-on-surface-variant p-2 rounded-lg hover:bg-surface-container-highest hover:text-primary transition-colors"
                              title="Edit Settings"
                            >
                              edit
                            </button>
                            <button 
                              onClick={() => toggleExpand(url._id)}
                              className={`material-symbols-outlined p-2 rounded-lg transition-colors ${expandedId === url._id ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
                              title="View Analytics"
                            >
                              {expandedId === url._id ? 'expand_less' : 'expand_more'}
                            </button>
                            <button 
                              onClick={() => deleteUrl(url._id)}
                              className="material-symbols-outlined text-on-surface-variant p-2 rounded-lg hover:bg-error-container/20 hover:text-error transition-colors"
                              title="Delete"
                            >
                              delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Details */}
                      {expandedId === url._id && (
                        <tr className="bg-surface-container-low/50">
                          <td className="px-6 py-8" colSpan="4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                              
                              {/* Analytics Chart Column */}
                              <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                  <h3 className="font-headline-md text-headline-md">Advanced Analytics</h3>
                                  <div className="flex bg-surface-container-highest p-1 rounded-lg">
                                    <button 
                                      onClick={() => setAnalyticsDays(7)} 
                                      className={`px-4 py-1 text-label-sm rounded-md transition-colors ${analyticsDays === 7 ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                                    >
                                      7 Days
                                    </button>
                                    <button 
                                      onClick={() => setAnalyticsDays(30)} 
                                      className={`px-4 py-1 text-label-sm rounded-md transition-colors ${analyticsDays === 30 ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                                    >
                                      30 Days
                                    </button>
                                  </div>
                                </div>
                                
                                {url.clickHistory && url.clickHistory.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="h-48 relative bg-surface-glass rounded-xl p-4 border border-border-glass sm:col-span-2 lg:col-span-4">
                                      <h4 className="font-label-sm text-on-surface-variant mb-2">Clicks over time</h4>
                                      <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={getChartData(url.clickHistory)}>
                                          <XAxis dataKey="date" stroke="#8c909f" fontSize={12} tickLine={false} axisLine={false} />
                                          <YAxis stroke="#8c909f" fontSize={12} tickLine={false} axisLine={false} width={30} />
                                          <Tooltip 
                                            contentStyle={{ backgroundColor: '#222a3d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#dae2fd' }}
                                            itemStyle={{ color: '#ddb7ff' }}
                                          />
                                          <Line type="monotone" dataKey="clicks" stroke="#ddb7ff" strokeWidth={3} dot={{ r: 4, fill: '#ddb7ff' }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                    <div className="h-48 relative bg-surface-glass rounded-xl p-4 border border-border-glass">
                                      <h4 className="font-label-sm text-on-surface-variant mb-2">Devices & OS</h4>
                                      <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                          <Pie data={getPieData(url.clickHistory, 'os')} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                                            {getPieData(url.clickHistory, 'os').map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                          </Pie>
                                          <Tooltip contentStyle={{ backgroundColor: '#222a3d', border: 'none', borderRadius: '8px' }} />
                                        </PieChart>
                                      </ResponsiveContainer>
                                    </div>
                                    <div className="h-48 relative bg-surface-glass rounded-xl p-4 border border-border-glass">
                                      <h4 className="font-label-sm text-on-surface-variant mb-2">Browsers</h4>
                                      <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                          <Pie data={getPieData(url.clickHistory, 'browser')} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                                            {getPieData(url.clickHistory, 'browser').map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                          </Pie>
                                          <Tooltip contentStyle={{ backgroundColor: '#222a3d', border: 'none', borderRadius: '8px' }} />
                                        </PieChart>
                                      </ResponsiveContainer>
                                    </div>
                                    <div className="h-48 relative bg-surface-glass rounded-xl p-4 border border-border-glass">
                                      <h4 className="font-label-sm text-on-surface-variant mb-2">Geolocation (Countries)</h4>
                                      <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                          <Pie data={getPieData(url.clickHistory, 'country')} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                                            {getPieData(url.clickHistory, 'country').map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                          </Pie>
                                          <Tooltip contentStyle={{ backgroundColor: '#222a3d', border: 'none', borderRadius: '8px' }} />
                                        </PieChart>
                                      </ResponsiveContainer>
                                    </div>
                                    <div className="h-48 relative bg-surface-glass rounded-xl p-4 border border-border-glass">
                                      <h4 className="font-label-sm text-on-surface-variant mb-2">Traffic Sources (Referrers)</h4>
                                      <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                          <Pie data={getPieData(url.clickHistory, 'referer')} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                                            {getPieData(url.clickHistory, 'referer').map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                          </Pie>
                                          <Tooltip contentStyle={{ backgroundColor: '#222a3d', border: 'none', borderRadius: '8px' }} />
                                        </PieChart>
                                      </ResponsiveContainer>
                                    </div>
                                    <div className="mt-6 sm:col-span-2 lg:col-span-4">
                                      <WorldMapAnalytics clickHistory={url.clickHistory} />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-64 flex items-center justify-center text-text-muted font-body-md border border-border-glass border-dashed rounded-xl">No click data yet</div>
                                )}
                              </div>
                              
                              {/* QR & Social Column */}
                              <div className="flex flex-col sm:flex-row items-center justify-center gap-12 bg-surface-glass rounded-xl p-8 border border-border-glass">
                                <div className="text-center space-y-4 w-full sm:w-auto min-w-[200px]">
                                  <div className="w-32 h-32 bg-white p-2 rounded-lg mx-auto shadow-lg shadow-black/50">
                                    <QRCodeCanvas 
                                      id={`qr-${url.shortCode}`} 
                                      value={`${API_URL}/${url.shortCode}`} 
                                      size={112} 
                                      className="w-full h-full" 
                                      fgColor={qrFgColor}
                                      bgColor={qrBgColor}
                                      imageSettings={qrIncludeLogo && url.favicon ? {
                                        src: url.favicon,
                                        x: undefined,
                                        y: undefined,
                                        height: 20,
                                        width: 20,
                                        excavate: true
                                      } : undefined}
                                    />
                                  </div>
                                  <p className="font-label-sm text-label-sm text-on-surface-variant font-bold">QR Designer</p>
                                  
                                  <div className="flex flex-col items-center gap-2 mt-2 p-3 bg-surface-container-high/40 rounded-xl border border-border-glass">
                                    <div className="flex gap-4">
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-text-muted">FG:</span>
                                        <input 
                                          type="color" 
                                          value={qrFgColor} 
                                          onChange={(e) => setQrFgColor(e.target.value)}
                                          className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-text-muted">BG:</span>
                                        <input 
                                          type="color" 
                                          value={qrBgColor} 
                                          onChange={(e) => setQrBgColor(e.target.value)}
                                          className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                                        />
                                      </div>
                                    </div>
                                    
                                    {url.favicon && (
                                      <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                                        <input 
                                          type="checkbox"
                                          checked={qrIncludeLogo}
                                          onChange={(e) => setQrIncludeLogo(e.target.checked)}
                                          className="rounded border-border-glass bg-transparent text-primary focus:ring-primary w-3 h-3"
                                        />
                                        <span className="text-[10px] text-on-surface-variant">Add Logo</span>
                                      </label>
                                    )}
                                  </div>

                                  <button 
                                    onClick={() => downloadQR(url.shortCode)}
                                    className="text-primary hover:underline font-label-sm text-label-sm block w-full text-center mt-2"
                                  >
                                    Download PNG
                                  </button>
                                </div>
                                
                                <div className="h-px w-full sm:w-px sm:h-24 bg-border-glass"></div>
                                
                                <div className="text-center space-y-6 w-full sm:w-auto">
                                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Share Link</p>
                                  <div className="flex flex-wrap justify-center gap-4">
                                    <button 
                                      onClick={() => shareOnSocial('twitter', `${API_URL}/${url.shortCode}`)}
                                      className="w-12 h-12 rounded-full bg-surface-container-highest border border-border-glass flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-all duration-300"
                                      title="Share on X"
                                    >
                                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                                    </button>
                                    <button 
                                      onClick={() => shareOnSocial('facebook', `${API_URL}/${url.shortCode}`)}
                                      className="w-12 h-12 rounded-full bg-surface-container-highest border border-border-glass flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-all duration-300"
                                      title="Share on Facebook"
                                    >
                                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path></svg>
                                    </button>
                                    <button 
                                      onClick={() => shareOnSocial('linkedin', `${API_URL}/${url.shortCode}`)}
                                      className="w-12 h-12 rounded-full bg-surface-container-highest border border-border-glass flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-all duration-300"
                                      title="Share on LinkedIn"
                                    >
                                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"></path></svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile Stacked Cards View */}
            <div className="md:hidden flex flex-col divide-y divide-border-glass">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <MobileSkeletonCard key={i} />)
              ) : urls.length === 0 ? (
                <div className="px-6 py-12 text-center text-text-muted font-body-md">
                  No URLs found.
                </div>
              ) : (
                urls.map((url) => (
                  <div key={`mobile-${url._id}`} className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex flex-col gap-1 overflow-hidden min-w-0">
                        <span className="text-label-sm text-text-muted uppercase tracking-wider">Short URL</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <a 
                            className="text-primary font-semibold hover:underline flex items-center gap-1" 
                            href={`${API_URL}/${url.shortCode}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            {url.isOneTime && <span className="material-symbols-outlined text-[14px] text-error animate-pulse">local_fire_department</span>}
                            {url.password && <span className="material-symbols-outlined text-[14px] text-tertiary">lock</span>}
                            <span>{url.shortCode}</span>
                          </a>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${url.isActive ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' : 'bg-amber-950/40 text-amber-400 border border-amber-500/20'}`}>
                            {url.isActive ? 'Active' : 'Paused'}
                          </span>
                          <button 
                            onClick={() => copyToClipboard(`${API_URL}/${url.shortCode}`)}
                            className="material-symbols-outlined text-[18px] text-on-surface-variant active:scale-90"
                          >
                            content_copy
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-label-sm text-text-muted uppercase tracking-wider">Clicks</span>
                        <div className="flex flex-col items-end gap-1">
                          <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-label-sm font-semibold">
                            {url.clicks} {url.maxClicks ? `/ ${url.maxClicks}` : ''}
                          </span>
                          {url.maxClicks && (
                            <div className="w-16 h-1 bg-surface-container-highest rounded-full overflow-hidden border border-border-glass">
                              <div 
                                className="h-full bg-primary rounded-full transition-all" 
                                style={{ width: `${Math.min(100, (url.clicks / url.maxClicks) * 100)}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 overflow-hidden min-w-0 w-full">
                      <span className="text-label-sm text-text-muted uppercase tracking-wider">Original URL</span>
                      <span className="text-body-sm text-text-muted truncate break-all sm:break-normal w-full" title={url.longUrl}>
                        {url.longUrl}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-between items-center mt-2 pt-2 border-t border-border-glass/50">
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          className="!px-2 !py-1 text-label-sm h-auto"
                          onClick={() => toggleExpand(url._id)}
                        >
                          {expandedId === url._id ? 'Hide' : 'Analytics'}
                        </Button>
                        <Button 
                          variant="outline" 
                          className="!px-2 !py-1 text-label-sm h-auto"
                          icon="edit"
                          onClick={() => openEditModal(url)}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          className={`!px-2 !py-1 text-label-sm h-auto ${url.isActive ? 'text-emerald-400' : 'text-amber-400'}`}
                          icon={url.isActive ? 'pause' : 'play_arrow'}
                          onClick={() => toggleUrlStatus(url._id, url.isActive)}
                        >
                          {url.isActive ? 'Pause' : 'Resume'}
                        </Button>
                      </div>
                      <Button 
                        variant="danger" 
                        className="!px-2 !py-1 text-label-sm h-auto"
                        icon="delete"
                        onClick={() => deleteUrl(url._id)}
                      >
                        Delete
                      </Button>
                    </div>

                    {expandedId === url._id && (
                      <div className="mt-4 p-4 bg-surface-container-low rounded-lg flex flex-col gap-6">
                        <div className="text-center">
                          <div className="w-32 h-32 bg-white p-2 rounded-lg mx-auto shadow-lg mb-2">
                            <QRCodeCanvas 
                              id={`qr-mobile-${url.shortCode}`} 
                              value={`${API_URL}/${url.shortCode}`} 
                              size={112} 
                              className="w-full h-full"
                              fgColor={qrFgColor}
                              bgColor={qrBgColor}
                              imageSettings={qrIncludeLogo && url.favicon ? {
                                src: url.favicon,
                                x: undefined,
                                y: undefined,
                                height: 20,
                                width: 20,
                                excavate: true
                              } : undefined}
                            />
                          </div>
                          
                          <div className="flex flex-col items-center gap-2 mt-2 p-3 bg-surface-container-high/40 rounded-xl border border-border-glass max-w-[200px] mx-auto">
                            <div className="flex gap-4">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-text-muted">FG:</span>
                                <input 
                                  type="color" 
                                  value={qrFgColor} 
                                  onChange={(e) => setQrFgColor(e.target.value)}
                                  className="w-4 h-4 rounded cursor-pointer border-0 p-0 bg-transparent"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-text-muted">BG:</span>
                                <input 
                                  type="color" 
                                  value={qrBgColor} 
                                  onChange={(e) => setQrBgColor(e.target.value)}
                                  className="w-4 h-4 rounded cursor-pointer border-0 p-0 bg-transparent"
                                />
                              </div>
                            </div>
                            {url.favicon && (
                              <label className="flex items-center gap-1 mt-1 cursor-pointer">
                                <input 
                                  type="checkbox"
                                  checked={qrIncludeLogo}
                                  onChange={(e) => setQrIncludeLogo(e.target.checked)}
                                  className="rounded border-border-glass bg-transparent text-primary focus:ring-primary w-3 h-3"
                                />
                                <span className="text-[10px] text-on-surface-variant">Add Logo</span>
                              </label>
                            )}
                          </div>

                          <button onClick={() => downloadQR(url.shortCode)} className="text-primary hover:underline font-label-sm mt-3 block w-full">
                            Download QR
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Pagination Bottom Bar */}
          {!loading && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-border-glass flex items-center justify-between bg-surface-glass">
              <span className="text-label-sm font-label-sm text-on-surface-variant">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  icon="chevron_left"
                  className="!px-2 !py-1"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                />
                <Button 
                  variant="outline"
                  icon="chevron_right"
                  className="!px-2 !py-1"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                />
              </div>
            </div>
          )}
        </GlassCard>
          </>
        )}
      </main>

      {/* Edit URL Modal */}
      {editingUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-[95%] sm:w-[600px] max-w-2xl bg-surface-container-high border border-border-glass rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto text-left">
            <button 
              onClick={closeEditModal}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-2 rounded-lg hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h2 className="font-headline-md text-headline-md mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">edit</span> Edit URL Settings
            </h2>
            <p className="text-body-sm text-text-muted mb-6">Modify details for short link: <strong className="text-primary">/{editingUrl.shortCode}</strong></p>
            
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="space-y-2">
                <Input 
                  type="url"
                  required
                  label="Original URL"
                  value={editLongUrl}
                  onChange={(e) => setEditLongUrl(e.target.value)}
                  icon="link"
                />
              </div>

              <div className="space-y-2">
                <Input 
                  type="datetime-local"
                  label="Expiration Date"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="[color-scheme:dark]"
                  icon="event"
                />
              </div>

              <div className="space-y-2">
                {editingUrl.password && (
                  <div className="flex items-center gap-2 mb-2 p-3 bg-surface-container-low rounded-lg border border-border-glass">
                    <input 
                      type="checkbox" 
                      id="remove-password"
                      checked={removePassword}
                      onChange={(e) => {
                        setRemovePassword(e.target.checked);
                        if (e.target.checked) setEditPassword("");
                      }}
                      className="rounded border-border-glass bg-transparent text-primary focus:ring-primary cursor-pointer w-4 h-4 shrink-0"
                    />
                    <label htmlFor="remove-password" className="text-body-sm text-on-surface cursor-pointer flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-tertiary">lock_open</span> Remove password protection
                    </label>
                  </div>
                )}
                {!removePassword && (
                  <Input 
                    type="password"
                    label={editingUrl.password ? "Enter new password" : "Set a link password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    icon="key"
                    autoComplete="new-password"
                  />
                )}
              </div>

              <div className="space-y-4 border-t border-border-glass/30 pt-6 mt-4">
                <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase ml-1 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">share</span> Social Preview (Open Graph)</h3>
                <Input 
                  type="text"
                  label="Preview Title"
                  value={editOgTitle}
                  onChange={(e) => setEditOgTitle(e.target.value)}
                  icon="title"
                />
                <Input 
                  type="url"
                  label="Preview Image URL"
                  value={editOgImage}
                  onChange={(e) => setEditOgImage(e.target.value)}
                  icon="image"
                />
                <div className="relative w-full group">
                  <textarea 
                    placeholder="Preview Description (e.g. A brief summary of this link)"
                    value={editOgDescription}
                    onChange={(e) => setEditOgDescription(e.target.value)}
                    rows="3"
                    className="w-full bg-surface-container-low border border-border-glass rounded-xl p-4 text-body-md focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/50 transition-all text-on-surface placeholder:text-on-surface-variant/70 resize-none font-body-sm"
                  />
                </div>
              </div>

              <div className="space-y-4 border-t border-border-glass/30 pt-6">
                <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase ml-1 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">devices</span> Device Targeting (Deep Linking)</h3>
                <Input 
                  type="url"
                  label="iOS Redirect URL"
                  value={editIphoneUrl}
                  onChange={(e) => setEditIphoneUrl(e.target.value)}
                  icon="phone_iphone"
                />
                <Input 
                  type="url"
                  label="Android Redirect URL"
                  value={editAndroidUrl}
                  onChange={(e) => setEditAndroidUrl(e.target.value)}
                  icon="phone_android"
                />
              </div>

              <div className="space-y-4 border-t border-border-glass/30 pt-6">
                <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase ml-1 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">api</span> Real-time Webhooks</h3>
                <Input 
                  type="url"
                  label="Webhook POST URL"
                  value={editWebhookUrl}
                  onChange={(e) => setEditWebhookUrl(e.target.value)}
                  icon="webhook"
                />
              </div>

              <div className="space-y-4 border-t border-border-glass/30 pt-6">
                <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase ml-1 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">security</span> Link Expiration Limits</h3>
                
                <div className="flex items-center gap-2 mb-2 p-3 bg-surface-container-low rounded-lg border border-border-glass">
                  <input 
                    type="checkbox" 
                    id="edit-is-one-time"
                    checked={editIsOneTime}
                    onChange={(e) => setEditIsOneTime(e.target.checked)}
                    className="rounded border-border-glass bg-transparent text-primary focus:ring-primary cursor-pointer w-4 h-4 shrink-0"
                  />
                  <label htmlFor="edit-is-one-time" className="text-body-sm text-on-surface cursor-pointer flex items-center gap-1.5 font-semibold">
                    <span className="material-symbols-outlined text-[16px] text-error animate-pulse">local_fire_department</span> Burn after reading (one-time)
                  </label>
                </div>

                <Input 
                  type="number"
                  label="Click Limit"
                  value={editMaxClicks}
                  onChange={(e) => setEditMaxClicks(e.target.value)}
                  icon="pin"
                  min="1"
                />
                <Input 
                  type="url"
                  label="Fallback Redirect URL"
                  value={editFallbackUrl}
                  onChange={(e) => setEditFallbackUrl(e.target.value)}
                  icon="shortcut"
                />
              </div>

              <div className="space-y-4 border-t border-border-glass/30 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-label-sm font-label-sm text-on-surface-variant uppercase ml-1 block">A/B Split Testing (Rotational Routing)</span>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="!py-1 !px-3 text-[12px] h-auto"
                    onClick={() => setEditAbTestTargets(prev => [...prev, { url: "", weight: 50 }])}
                  >
                    + Add Target
                  </Button>
                </div>
                
                {editAbTestTargets.length === 0 ? (
                  <p className="text-text-muted text-xs ml-1">No split targets configured. All clicks go to the main destination link.</p>
                ) : (
                  <div className="space-y-3">
                    {editAbTestTargets.map((target, index) => (
                      <div key={index} className="flex flex-col md:flex-row items-center gap-3">
                        <div className="relative flex-grow w-full">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">link</span>
                          <input 
                            type="url" 
                            placeholder="Split Destination URL"
                            value={target.url}
                            onChange={(e) => {
                              const newTargets = [...editAbTestTargets];
                              newTargets[index].url = e.target.value;
                              setEditAbTestTargets(newTargets);
                            }}
                            className="w-full bg-surface-container-low border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
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
                              const newTargets = [...editAbTestTargets];
                              newTargets[index].weight = e.target.value;
                              setEditAbTestTargets(newTargets);
                            }}
                            className="w-full bg-surface-container-low border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                            required
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => setEditAbTestTargets(prev => prev.filter((_, i) => i !== index))}
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

              <div className="space-y-4 border-t border-border-glass/30 pt-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase ml-1 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">public</span> Geo-Targeting</h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="!py-1 !px-3 text-[12px] h-auto"
                    onClick={() => setEditGeoTargets(prev => [...prev, { country: "", url: "" }])}
                  >
                    + Add Target
                  </Button>
                </div>
                
                {editGeoTargets.length === 0 ? (
                  <p className="text-text-muted text-xs ml-1">No location targets configured. All clicks go to the main destination link.</p>
                ) : (
                  <div className="space-y-3">
                    {editGeoTargets.map((target, index) => (
                      <div key={index} className="flex flex-col md:flex-row items-center gap-3">
                        <div className="relative w-full md:w-48 flex-shrink-0">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">flag</span>
                          <input 
                            type="text" 
                            maxLength="2"
                            placeholder="Country Code (e.g. US, GB)"
                            value={target.country}
                            onChange={(e) => {
                              const newGeo = [...editGeoTargets];
                              newGeo[index].country = e.target.value;
                              setEditGeoTargets(newGeo);
                            }}
                            className="w-full bg-surface-container-low border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm uppercase"
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
                              const newGeo = [...editGeoTargets];
                              newGeo[index].url = e.target.value;
                              setEditGeoTargets(newGeo);
                            }}
                            className="w-full bg-surface-container-low border border-border-glass rounded-lg py-2 pl-9 pr-4 text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-tertiary/50 focus:ring-1 focus:ring-tertiary/30 transition-all font-body-sm"
                            required
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => setEditGeoTargets(prev => prev.filter((_, i) => i !== index))}
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

              <div className="space-y-4 border-t border-border-glass/30 pt-6">
                <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase ml-1 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">hourglass_empty</span> Splash Screen</h3>
                <Input 
                  type="text"
                  label="Splash Message"
                  value={editSplashMessage}
                  onChange={(e) => setEditSplashMessage(e.target.value)}
                  icon="chat_bubble"
                />
                <Input 
                  type="number"
                  label="Countdown delay in seconds"
                  value={editSplashDelay}
                  onChange={(e) => setEditSplashDelay(e.target.value)}
                  icon="timer"
                  min="1"
                  max="30"
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={closeEditModal}
                  disabled={updatingUrl}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="gradient"
                  loading={updatingUrl}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-8 border-t border-border-glass bg-surface-dim">
        <div className="flex flex-col md:flex-row justify-between items-center gap-stack-md px-gutter max-w-container-max mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="font-display-lg text-headline-md text-primary">ShortyURL</div>
            <span className="text-label-sm font-label-sm text-text-muted">© 2024 ShortyURL. All rights reserved.</span>
          </div>
          <div className="flex gap-6 font-label-sm text-label-sm">
            <a className="text-text-muted hover:text-on-surface transition-colors" href="#">Terms</a>
            <a className="text-text-muted hover:text-on-surface transition-colors" href="#">Privacy</a>
            <a className="text-text-muted hover:text-on-surface transition-colors" href="#">Status</a>
            <a className="text-text-muted hover:text-on-surface transition-colors" href="#">Support</a>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Dashboard;
