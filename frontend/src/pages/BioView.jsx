import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Globe, MessageCircle as Twitter, Code as Github, Briefcase as Linkedin, Camera as Instagram, Video as Youtube, ExternalLink, 
  Sparkles, CheckCircle2, Share2 
} from 'lucide-react';

import { API_URL } from '../utils/api';

const themeStyles = {
  glassmorphism: {
    bg: 'bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white',
    card: 'bg-white/10 backdrop-blur-xl border border-white/15 hover:bg-white/20 hover:border-white/30 text-white shadow-xl shadow-black/20',
    avatarBorder: 'border-4 border-indigo-400/30 shadow-indigo-500/20 shadow-2xl',
    highlight: 'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 border-indigo-400/50',
    accentText: 'text-indigo-300',
    badgeBg: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/30'
  },
  'dark-neon': {
    bg: 'bg-slate-950 text-slate-100',
    card: 'bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] text-emerald-100',
    avatarBorder: 'border-4 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]',
    highlight: 'bg-emerald-950/60 border-emerald-400 text-emerald-200',
    accentText: 'text-emerald-400',
    badgeBg: 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
  },
  'minimal-light': {
    bg: 'bg-slate-50 text-slate-900',
    card: 'bg-white border border-slate-200 hover:border-slate-400 hover:shadow-lg text-slate-800',
    avatarBorder: 'border-4 border-slate-300 shadow-md',
    highlight: 'bg-slate-100 border-slate-400 text-slate-900 font-bold',
    accentText: 'text-slate-600',
    badgeBg: 'bg-slate-200 text-slate-700 border-slate-300'
  },
  cyberpunk: {
    bg: 'bg-yellow-400 text-slate-950 font-mono',
    card: 'bg-black text-yellow-300 border-2 border-black hover:bg-yellow-300 hover:text-black hover:border-black font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
    avatarBorder: 'border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
    highlight: 'bg-purple-900 text-yellow-300 border-4 border-black',
    accentText: 'text-black font-bold',
    badgeBg: 'bg-black text-yellow-400 border-black'
  },
  sunset: {
    bg: 'bg-gradient-to-br from-amber-600 via-rose-600 to-purple-900 text-white',
    card: 'bg-white/15 backdrop-blur-md border border-white/20 hover:bg-white/25 hover:border-white/40 text-white shadow-lg shadow-rose-950/30',
    avatarBorder: 'border-4 border-amber-300/40 shadow-xl shadow-amber-500/20',
    highlight: 'bg-amber-500/30 border-amber-300/60 text-amber-100',
    accentText: 'text-amber-200',
    badgeBg: 'bg-amber-500/20 text-amber-100 border-amber-400/30'
  }
};

export default function BioView() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchBioData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/bio/public/${slug}`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Bio page not found' : 'Failed to load page');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchBioData();
  }, [fetchBioData]);

  const handleLinkClick = async (linkId, targetUrl) => {
    try {
      fetch(`${API_URL}/api/bio/public/${slug}/click/${linkId}`, { method: 'POST' }).catch((err) => {
        console.warn('Bio link click tracking suppressed:', err);
      });
    } catch (err) {
      console.warn('Bio link click handler error:', err);
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast('Unable to copy the bio page link.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-text-muted tracking-wide">Loading Bio Page...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface p-4">
        <div className="max-w-md w-full text-center bg-surface/80 backdrop-blur-xl p-8 rounded-3xl border border-border-glass shadow-2xl">
          <div className="w-16 h-16 bg-error-container/30 text-error rounded-2xl flex items-center justify-center mx-auto mb-4 border border-error/20">
            ⚠️
          </div>
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-text-muted text-sm mb-6">{error || "The bio page you are looking for does not exist."}</p>
          <Link to="/" className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-sm font-semibold transition-all">
            Go to ShortyURL Home
          </Link>
        </div>
      </div>
    );
  }

  const currentTheme = themeStyles[data.theme] || themeStyles.glassmorphism;
  const social = data.socialLinks || {};

  return (
    <div className={`min-h-screen ${currentTheme.bg} flex flex-col items-center px-4 py-12 transition-all duration-500 relative overflow-x-hidden`}>
      {/* Top Share Button */}
      <button 
        onClick={handleShare}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all text-current shadow-lg flex items-center justify-center"
        title="Share Profile"
      >
        {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-scale" /> : <Share2 className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md flex flex-col items-center text-center">
        {/* Avatar */}
        {data.avatarUrl ? (
          <img 
            src={data.avatarUrl} 
            alt={data.title} 
            className={`w-28 h-28 rounded-full object-cover mb-5 ${currentTheme.avatarBorder} transition-transform hover:scale-105 duration-300`}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className={`w-28 h-28 rounded-full flex items-center justify-center text-3xl font-extrabold mb-5 ${currentTheme.avatarBorder} bg-white/10 backdrop-blur-md`}>
            {data.title ? data.title.charAt(0).toUpperCase() : 'B'}
          </div>
        )}

        {/* Title & Bio */}
        <h1 className="text-2xl font-extrabold tracking-tight mb-2 flex items-center gap-2">
          {data.title}
          <Sparkles className={`w-5 h-5 ${currentTheme.accentText}`} />
        </h1>

        {data.bio && (
          <p className="text-sm font-medium opacity-90 max-w-sm mb-6 leading-relaxed">
            {data.bio}
          </p>
        )}

        {/* Social Links Bar */}
        {(social.twitter || social.github || social.linkedin || social.instagram || social.youtube || social.website) && (
          <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
            {social.twitter && (
              <a href={social.twitter} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-all hover:scale-110">
                <Twitter className="w-5 h-5" />
              </a>
            )}
            {social.github && (
              <a href={social.github} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-all hover:scale-110">
                <Github className="w-5 h-5" />
              </a>
            )}
            {social.linkedin && (
              <a href={social.linkedin} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-all hover:scale-110">
                <Linkedin className="w-5 h-5" />
              </a>
            )}
            {social.instagram && (
              <a href={social.instagram} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-all hover:scale-110">
                <Instagram className="w-5 h-5" />
              </a>
            )}
            {social.youtube && (
              <a href={social.youtube} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-all hover:scale-110">
                <Youtube className="w-5 h-5" />
              </a>
            )}
            {social.website && (
              <a href={social.website} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-all hover:scale-110">
                <Globe className="w-5 h-5" />
              </a>
            )}
          </div>
        )}

        {/* Sub-links Stack */}
        <div className="w-full flex flex-col gap-3.5 mb-10">
          {data.links && data.links.length > 0 ? (
            data.links.map((link) => (
              <button
                key={link._id || link.title}
                onClick={() => handleLinkClick(link._id, link.url)}
                className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between font-semibold transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 ${
                  link.isHighlighted ? currentTheme.highlight : currentTheme.card
                }`}
              >
                <span className="flex items-center gap-3 text-sm font-bold truncate">
                  <Globe className="w-4 h-4 opacity-70 shrink-0" />
                  {link.title}
                </span>
                <ExternalLink className="w-4 h-4 opacity-70 shrink-0" />
              </button>
            ))
          ) : (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-xs opacity-70">
              No links added yet to this bio page.
            </div>
          )}
        </div>

        {/* Footer Brand Credit */}
        <div className="mt-auto pt-6 text-xs opacity-60 flex items-center gap-1.5 font-medium">
          Powered by <span className="font-extrabold tracking-wide">ShortyURL Enterprise</span>
        </div>
      </div>
    </div>
  );
}
