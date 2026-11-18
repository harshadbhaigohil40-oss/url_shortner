import React, { useState, useContext } from 'react';
import { 
  Sparkles, Plus, Trash2, Link2, 
  ExternalLink, Check, Layout, Palette, ArrowLeft, MoveUp, MoveDown, AtSign,
  Smartphone, Globe
} from 'lucide-react';
import { useToast } from '../context/ToastContextInstance';
import { apiFetch, API_URL } from '../utils/api';
import { AuthContext } from '../context/AuthContext';

const themes = [
  { 
    id: 'glassmorphism', 
    name: 'Glassmorphism', 
    bg: 'bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white', 
    cardBg: 'bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/15',
    preview: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-800' 
  },
  { 
    id: 'dark-neon', 
    name: 'Dark Neon', 
    bg: 'bg-gradient-to-br from-slate-950 via-zinc-900 to-emerald-950 text-emerald-100', 
    cardBg: 'bg-emerald-950/40 backdrop-blur-md border-emerald-500/40 text-emerald-200 hover:border-emerald-400',
    preview: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-slate-950' 
  },
  { 
    id: 'minimal-light', 
    name: 'Minimal Light', 
    bg: 'bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-800', 
    cardBg: 'bg-white/80 backdrop-blur-md border-slate-300 text-slate-800 shadow-sm hover:border-slate-400',
    preview: 'bg-gradient-to-br from-slate-300 via-slate-100 to-slate-400' 
  },
  { 
    id: 'cyberpunk', 
    name: 'Cyberpunk', 
    bg: 'bg-gradient-to-br from-yellow-400 via-amber-500 to-neutral-950 text-neutral-900', 
    cardBg: 'bg-black/90 border-yellow-400 text-yellow-300 shadow-yellow-500/20 hover:bg-black',
    preview: 'bg-gradient-to-br from-yellow-400 via-amber-500 to-neutral-900' 
  },
  { 
    id: 'sunset', 
    name: 'Sunset Gradient', 
    bg: 'bg-gradient-to-br from-amber-600 via-rose-600 to-purple-950 text-white', 
    cardBg: 'bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20',
    preview: 'bg-gradient-to-br from-amber-500 via-rose-500 to-purple-800' 
  }
];

const SocialIcon = ({ platform, className = "w-3.5 h-3.5" }) => {
  switch (platform) {
    case 'twitter':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case 'github':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      );
    case 'linkedin':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      );
    case 'youtube':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    default:
      return <Globe className={className} />;
  }
};

export default function BioBuilder({ bioPage, onBack, onSaveSuccess }) {
  const { addToast } = useToast();
  const { user, login, logout } = useContext(AuthContext);
  const [slug, setSlug] = useState(bioPage ? bioPage.slug : '');
  const [title, setTitle] = useState(bioPage ? bioPage.title : 'My Portfolio & Links');
  const [bio, setBio] = useState(bioPage ? bioPage.bio : 'Welcome to my official links!');
  const [avatarUrl, setAvatarUrl] = useState(bioPage ? bioPage.avatarUrl : '');
  const [theme, setTheme] = useState(bioPage ? bioPage.theme : 'glassmorphism');
  const [socialLinks, setSocialLinks] = useState(bioPage ? bioPage.socialLinks : {
    twitter: '', github: '', linkedin: '', instagram: '', youtube: '', website: ''
  });
  const [links, setLinks] = useState(bioPage ? bioPage.links : [
    { title: 'My Official Website', url: 'https://example.com', isHighlighted: true },
    { title: 'Read My Latest Blog', url: 'https://example.com/blog', isHighlighted: false }
  ]);

  const [saving, setSaving] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkHighlight, setNewLinkHighlight] = useState(false);

  const activeThemeObj = themes.find(t => t.id === theme) || themes[0];

  const handleAddLink = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) {
      addToast('Please enter both title and valid URL', 'error');
      return;
    }
    setLinks([...links, { title: newLinkTitle.trim(), url: newLinkUrl.trim(), isHighlighted: newLinkHighlight, clicks: 0 }]);
    setNewLinkTitle('');
    setNewLinkUrl('');
    setNewLinkHighlight(false);
    addToast('Link added to preview', 'success');
  };

  const handleRemoveLink = (index) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleMoveLink = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= links.length) return;
    const updated = [...links];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setLinks(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!slug.trim()) {
      addToast('URL handle (slug) is required', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = { slug, title, bio, avatarUrl, theme, socialLinks, links };
      const isEdit = !!bioPage?._id;
      const url = isEdit ? `${API_URL}/api/bio/${bioPage._id}` : `${API_URL}/api/bio`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }, user, login, logout);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save Bio Page');
      }

      addToast(`Bio Page ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
      if (onSaveSuccess) onSaveSuccess(data);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface pt-28 pb-16 px-4 sm:px-6 lg:px-8">
      {/* Top Header Bar with responsive layout and clear navbar clearance */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-5 border-b border-border-glass">
        <div className="flex items-center gap-3.5">
          {onBack && (
            <button 
              type="button"
              onClick={onBack} 
              className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-border-glass transition-all text-on-surface hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 bg-clip-text text-transparent bg-accent-gradient">
              <Sparkles className="w-6 h-6 text-purple-400 shrink-0" />
              <span>{bioPage ? 'Edit Bio Page' : 'Create New Bio Page'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Design custom link-in-bio landing pages with live interactive preview
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-primary hover:from-purple-500 hover:to-indigo-500 font-bold text-white text-sm shadow-lg shadow-purple-900/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>{bioPage ? 'Update Bio Page' : 'Publish Bio Page'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Form Controls (7 cols) + Right Phone Live Preview (5 cols) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Form Controls */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Profile Details */}
          <div className="bg-surface-container-low/70 backdrop-blur-xl border border-border-glass rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-on-surface flex items-center gap-2 pb-2 border-b border-border-glass">
              <Layout className="w-5 h-5 text-indigo-400" />
              <span>Profile Details</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">URL Handle (Slug)</label>
              <div className="flex items-center rounded-xl bg-surface-container-lowest border border-border-glass focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 overflow-hidden transition-all">
                <span className="px-3.5 py-2.5 text-xs text-on-surface-variant font-mono bg-surface-container-low border-r border-border-glass">/bio/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                  placeholder="my-portfolio"
                  className="w-full bg-transparent px-3.5 py-2.5 text-sm text-on-surface focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Display Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-surface-container-lowest border border-border-glass rounded-xl px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Avatar Image URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://images.com/photo.jpg"
                    className="w-full bg-surface-container-lowest border border-border-glass rounded-xl px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                  {avatarUrl && (
                    <img 
                      src={avatarUrl} 
                      alt="Thumbnail" 
                      className="w-10 h-10 rounded-xl object-cover border border-border-glass shrink-0" 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Short Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows="2"
                placeholder="Software Engineer & Content Creator"
                className="w-full bg-surface-container-lowest border border-border-glass rounded-xl px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
          </div>

          {/* Section 2: Social Media Links */}
          <div className="bg-surface-container-low/70 backdrop-blur-xl border border-border-glass rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-on-surface flex items-center gap-2 pb-2 border-b border-border-glass">
              <AtSign className="w-5 h-5 text-purple-400" />
              <span>Social Media Links</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {['twitter', 'github', 'linkedin', 'instagram', 'youtube', 'website'].map((platform) => (
                <div key={platform}>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 capitalize flex items-center gap-1.5">
                    <span className="text-purple-400"><SocialIcon platform={platform} className="w-3.5 h-3.5" /></span>
                    <span>{platform === 'twitter' ? 'Twitter / X' : platform} URL</span>
                  </label>
                  <input
                    type="text"
                    value={socialLinks[platform] || ''}
                    onChange={(e) => setSocialLinks({ ...socialLinks, [platform]: e.target.value })}
                    placeholder={`https://${platform === 'twitter' ? 'x' : platform}.com/username`}
                    className="w-full bg-surface-container-lowest border border-border-glass rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Theme & Style Selector */}
          <div className="bg-surface-container-low/70 backdrop-blur-xl border border-border-glass rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-on-surface flex items-center gap-2 pb-2 border-b border-border-glass">
              <Palette className="w-5 h-5 text-pink-400" />
              <span>Theme & Style</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {themes.map((t) => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`relative p-3 rounded-2xl border text-left text-xs font-bold transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected 
                        ? 'border-purple-500 bg-purple-500/15 text-on-surface shadow-lg shadow-purple-500/20 scale-[1.02]' 
                        : 'border-border-glass bg-surface-container-lowest/80 text-on-surface-variant hover:border-outline-variant hover:bg-surface-container'
                    }`}
                  >
                    <div className={`w-full h-10 rounded-xl mb-2.5 shadow-sm border border-black/10 ${t.preview}`}></div>
                    <div className="flex items-center justify-between">
                      <span className="truncate">{t.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Manage Sub-Links */}
          <div className="bg-surface-container-low/70 backdrop-blur-xl border border-border-glass rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-on-surface flex items-center gap-2 pb-2 border-b border-border-glass">
              <Link2 className="w-5 h-5 text-emerald-400" />
              <span>Manage Portfolio Sub-Links</span>
            </h2>

            {/* Add New Link Card */}
            <div className="bg-surface-container-lowest/90 p-4 rounded-xl border border-border-glass space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Link Title</label>
                  <input
                    type="text"
                    placeholder="e.g. My GitHub"
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    className="w-full bg-surface-container-low border border-border-glass rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Destination URL</label>
                  <input
                    type="text"
                    placeholder="https://github.com/..."
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="w-full bg-surface-container-low border border-border-glass rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newLinkHighlight}
                    onChange={(e) => setNewLinkHighlight(e.target.checked)}
                    className="w-4 h-4 rounded border-border-glass text-purple-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Highlight Link (Featured Glow Style)</span>
                </label>

                <button
                  type="button"
                  onClick={handleAddLink}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-900/20 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Link</span>
                </button>
              </div>
            </div>

            {/* List of Existing Sub-Links */}
            <div className="space-y-2.5 pt-2">
              {links.length === 0 ? (
                <p className="text-center py-4 text-xs text-on-surface-variant italic">No links added yet. Add one above to see it in preview!</p>
              ) : (
                links.map((link, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-surface-container-lowest/90 px-4 py-3 rounded-xl border border-border-glass text-xs gap-3 shadow-sm hover:border-outline-variant transition-all">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-on-surface truncate">{link.title}</span>
                        {link.isHighlighted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                            Featured
                          </span>
                        )}
                      </div>
                      <span className="text-on-surface-variant block truncate font-mono text-[11px] mt-0.5">{link.url}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        type="button" 
                        onClick={() => handleMoveLink(idx, -1)} 
                        disabled={idx === 0} 
                        className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant disabled:opacity-20 cursor-pointer"
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleMoveLink(idx, 1)} 
                        disabled={idx === links.length - 1} 
                        className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant disabled:opacity-20 cursor-pointer"
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveLink(idx)} 
                        className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg text-on-surface-variant transition-colors cursor-pointer"
                        title="Delete Link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Phone Live Preview (Sticky on desktop, responsive layout) */}
        <div className="lg:col-span-5 flex flex-col items-center w-full lg:sticky lg:top-28">
          <div className="w-full max-w-[340px] sm:max-w-[360px]">
            <div className="flex items-center justify-between mb-3 px-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-purple-400" />
                Live Preview
              </span>
              <span className="text-[10px] lowercase text-purple-400 font-mono">/bio/{slug || 'preview'}</span>
            </div>

            {/* Realistic Smartphone Shell */}
            <div className="w-full bg-slate-900/90 p-3 sm:p-4 rounded-[44px] border-4 border-slate-700/60 shadow-2xl shadow-purple-950/40 relative">
              
              {/* Dynamic Theme Background Inside Phone Screen */}
              <div className={`w-full min-h-[580px] max-h-[640px] rounded-[34px] overflow-y-auto p-5 flex flex-col items-center text-center relative border border-white/10 ${activeThemeObj.bg} transition-colors duration-500 shadow-inner`}>
                
                {/* Smartphone Speaker / Camera Notch */}
                <div className="w-24 h-4 bg-black/40 rounded-full mb-4 shrink-0 mx-auto"></div>

                {/* Avatar */}
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Preview" 
                    className="w-20 h-20 rounded-full object-cover mb-3 border-2 border-white/30 shadow-md"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-2xl font-black mb-3 shadow-md">
                    {title ? title.charAt(0).toUpperCase() : 'B'}
                  </div>
                )}

                {/* Display Title & Bio */}
                <h3 className="text-base font-extrabold mb-1 max-w-[240px] leading-snug">{title || 'Your Title Here'}</h3>
                <p className="text-xs opacity-80 mb-4 max-w-[240px] leading-relaxed">{bio || 'Your short bio description goes here...'}</p>

                {/* Social Media Link Icons in Preview */}
                {Object.entries(socialLinks).some(([_, val]) => !!val) && (
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
                    {Object.entries(socialLinks).map(([platform, val]) => {
                      if (!val) return null;
                      return (
                        <div key={platform} className="p-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 shadow-sm" title={platform}>
                          <SocialIcon platform={platform} className="w-3.5 h-3.5" />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Sub-links Preview */}
                <div className="w-full space-y-2.5 mt-auto mb-2">
                  {links.map((link, i) => (
                    <div
                      key={i}
                      className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-between border transition-all shadow-sm ${
                        link.isHighlighted 
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-lg shadow-purple-900/40 ring-1 ring-purple-300' 
                          : activeThemeObj.cardBg
                      }`}
                    >
                      <span className="truncate pr-2">{link.title || 'Untitled Link'}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70 shrink-0" />
                    </div>
                  ))}
                </div>

                {/* Branding Footer */}
                <div className="pt-4 text-[10px] font-medium opacity-60 tracking-wider uppercase">
                  ⚡ Powered by ShortyURL
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
