import React, { useEffect, useState, useContext, useCallback } from 'react';
import { Sparkles, Plus, Edit2, Trash2, ExternalLink, Eye, Share2, Check } from 'lucide-react';
import { useToast } from '../context/ToastContextInstance';
import { apiFetch, API_URL } from '../utils/api';
import { AuthContext } from '../context/AuthContext';

export default function BioPageList({ onCreateNew, onEdit }) {
  const { addToast } = useToast();
  const { user, login, logout } = useContext(AuthContext);
  const [bioPages, setBioPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState(null);

  const fetchBioPages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_URL}/api/bio/my`, {}, user, login, logout);
      if (res.ok) {
        const data = await res.json();
        setBioPages(data);
      }
    } catch (err) {
      console.error('Error fetching bio pages:', err);
    } finally {
      setLoading(false);
    }
  }, [user, login, logout]);

  useEffect(() => {
    fetchBioPages();
  }, [fetchBioPages]);

  const handleDelete = async (id, slug) => {
    if (!window.confirm(`Are you sure you want to delete the bio page "/bio/${slug}"?`)) return;

    try {
      const res = await apiFetch(`${API_URL}/api/bio/${id}`, {
        method: 'DELETE'
      }, user, login, logout);

      if (res.ok) {
        addToast('Bio page deleted successfully', 'success');
        setBioPages(bioPages.filter(b => b._id !== id));
      }
    } catch (err) {
      console.error('Delete bio page error:', err);
      addToast('Failed to delete bio page', 'error');
    }
  };

  const copyBioUrl = async (slug) => {
    const fullUrl = `${window.location.origin}/bio/${slug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedSlug(slug);
      addToast('Bio page link copied to clipboard!', 'success');
      setTimeout(() => setCopiedSlug(null), 2500);
    } catch {
      addToast('Unable to copy the bio page link.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-text-muted">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3"></div>
        Loading your BioPages...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-on-surface flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Your Bio Landing Pages
          </h2>
          <p className="text-xs text-text-muted">Create multi-link landing pages for social media bios</p>
        </div>

        <button
          onClick={onCreateNew}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-on-surface text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Bio Page
        </button>
      </div>

      {bioPages.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface-container/60 backdrop-blur-md border border-border-glass text-text-muted space-y-4">
          <Sparkles className="w-12 h-12 text-purple-400/50 mx-auto" />
          <h3 className="text-base font-bold text-on-surface">No Bio Pages Created Yet</h3>
          <p className="text-xs max-w-sm mx-auto">Build your first custom link-in-bio page with glassmorphic themes, social icons, and sub-link click tracking.</p>
          <button
            onClick={onCreateNew}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-on-surface text-xs font-bold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Your First Bio Page
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bioPages.map((page) => (
            <div key={page._id} className="bg-surface-container/60 backdrop-blur-md border border-border-glass rounded-2xl p-5 hover:border-purple-500/40 transition-all shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {page.theme}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium">
                    <Eye className="w-3.5 h-3.5" />
                    {page.views || 0} views
                  </div>
                </div>

                <h3 className="text-base font-bold text-on-surface mb-1 truncate">{page.title}</h3>
                <p className="text-xs font-mono text-purple-400 mb-4 truncate">/bio/{page.slug}</p>
                <p className="text-xs text-text-muted line-clamp-2 mb-4">{page.bio || "No description."}</p>
              </div>

              <div className="pt-4 border-t border-border-glass/ flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyBioUrl(page.slug)}
                    className="p-2 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface-variant text-xs flex items-center gap-1"
                    title="Copy Link"
                  >
                    {copiedSlug === page.slug ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={`/bio/${page.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface-variant text-xs flex items-center gap-1"
                    title="View Live Page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(page)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(page._id, page.slug)}
                    className="p-1.5 rounded-lg hover:bg-rose-950 text-text-muted hover:text-rose-400 text-xs"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
