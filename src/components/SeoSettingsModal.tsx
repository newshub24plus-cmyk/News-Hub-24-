import { Globe, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  auth,
  isAgencyAdminUser,
  saveSeoSettingsToFirestore,
  type GlobalSeoSettings
} from '../lib/firebase';

export const DEFAULT_GLOBAL_SEO_SETTINGS: GlobalSeoSettings = {
  title: 'News Hub 24+ (newshub24plus.com) – Official News Agency, Wire & Android APK',
  description:
    'newshub24plus.com is the official standalone .com website of News Hub 24+ global news and media agency, featuring 24/7 reporting, GhanaPay monetization, and Android APK download.',
  news_keywords:
    'newshub24plus.com, News Hub 24+, Ghana news, MTN MoMo, global news, breaking news, media agency, investigative journalism, Android APK',
  author: 'News Hub 24+ Editorial Desk (newshub24plus.com)',
  ogTitle: 'News Hub 24+ (newshub24plus.com) – Official News Agency, Wire & Android APK',
  ogDescription:
    'newshub24plus.com is the official standalone .com website of News Hub 24+ global news and media agency, linked to the Base44 app with 24/7 reporting and APK download.',
  canonicalUrl: 'https://www.newshub24plus.com'
};

interface SeoSettingsModalProps {
  isOpen: boolean;
  initialSettings: GlobalSeoSettings;
  onClose: () => void;
  onSaved: (settings: GlobalSeoSettings) => void;
}

export function SeoSettingsModal({
  isOpen,
  initialSettings,
  onClose,
  onSaved
}: SeoSettingsModalProps) {
  const [title, setTitle] = useState(initialSettings.title);
  const [description, setDescription] = useState(initialSettings.description);
  const [newsKeywords, setNewsKeywords] = useState(initialSettings.news_keywords);
  const [author, setAuthor] = useState(initialSettings.author);
  const [ogTitle, setOgTitle] = useState(initialSettings.ogTitle || initialSettings.title);
  const [ogDescription, setOgDescription] = useState(
    initialSettings.ogDescription || initialSettings.description
  );
  const [canonicalUrl, setCanonicalUrl] = useState(
    initialSettings.canonicalUrl || DEFAULT_GLOBAL_SEO_SETTINGS.canonicalUrl || 'https://www.newshub24plus.com'
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialSettings.title);
    setDescription(initialSettings.description);
    setNewsKeywords(initialSettings.news_keywords);
    setAuthor(initialSettings.author);
    setOgTitle(initialSettings.ogTitle || initialSettings.title);
    setOgDescription(initialSettings.ogDescription || initialSettings.description);
    setCanonicalUrl(initialSettings.canonicalUrl || 'https://www.newshub24plus.com');
    setFeedback(null);
  }, [isOpen, initialSettings]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    setTitle(DEFAULT_GLOBAL_SEO_SETTINGS.title);
    setDescription(DEFAULT_GLOBAL_SEO_SETTINGS.description);
    setNewsKeywords(DEFAULT_GLOBAL_SEO_SETTINGS.news_keywords);
    setAuthor(DEFAULT_GLOBAL_SEO_SETTINGS.author);
    setOgTitle(DEFAULT_GLOBAL_SEO_SETTINGS.ogTitle || DEFAULT_GLOBAL_SEO_SETTINGS.title);
    setOgDescription(
      DEFAULT_GLOBAL_SEO_SETTINGS.ogDescription || DEFAULT_GLOBAL_SEO_SETTINGS.description
    );
    setCanonicalUrl(DEFAULT_GLOBAL_SEO_SETTINGS.canonicalUrl || 'https://www.newshub24plus.com');
    setFeedback(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (title.trim().length < 3 || description.trim().length < 10 || newsKeywords.trim().length < 2 || author.trim().length < 2) {
      setFeedback({
        type: 'error',
        text: 'Enter a valid SEO title (3+ chars), meta description (10+ chars), news_keywords, and author.'
      });
      return;
    }

    setSaving(true);
    try {
      const payloadBody: GlobalSeoSettings = {
        title: title.trim(),
        description: description.trim(),
        news_keywords: newsKeywords.trim(),
        author: author.trim(),
        ogTitle: ogTitle.trim() || title.trim(),
        ogDescription: ogDescription.trim() || description.trim(),
        canonicalUrl: canonicalUrl.trim() || 'https://www.newshub24plus.com',
        updatedBy: auth.currentUser?.email || 'News Hub 24+ Desk'
      };

      const res = await fetch('/api/seo-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody)
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Could not update SEO settings.');
      }

      const savedSettings = (json.settings as GlobalSeoSettings) || payloadBody;
      let firestoreNote = '';
      if (auth.currentUser && isAgencyAdminUser(auth.currentUser)) {
        try {
          await saveSeoSettingsToFirestore(auth.currentUser, savedSettings);
          firestoreNote = ' Synced to Firestore global SEO config.';
        } catch {
          // Server persistence succeeded cleanly
        }
      }

      onSaved(savedSettings);
      setFeedback({
        type: 'success',
        text: `Global <head> SEO meta tags updated live.${firestoreNote}`
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save global SEO meta tags.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-8 sm:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seo-settings-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#FBF9F5] dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#1C1B19]">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-0.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Global Search Engine Indexing &amp; Document Head Manager</span>
            </p>
            <h2
              id="seo-settings-modal-title"
              className="font-serif text-lg sm:text-xl font-bold text-[#141413] dark:text-[#F5F3EE] truncate"
            >
              Dynamic Global SEO Meta Tags Configuration
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close SEO configuration"
            className="inline-flex items-center justify-center w-9 h-9 text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Live SERP Preview */}
          <div className="p-4 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-1">
            <p className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E] flex items-center gap-1.5">
              <Search className="w-3 h-3" />
              <span>Live Search Result Snippet Preview</span>
            </p>
            <p className="text-xs font-mono text-[#14532D] dark:text-[#4ADE80] truncate">
              {canonicalUrl || 'https://www.newshub24plus.com'}
            </p>
            <p className="text-base font-semibold text-[#1E3A8A] dark:text-[#93C5FD] line-clamp-1">
              {title || 'News Hub 24+'}
            </p>
            <p className="text-xs text-[#44403C] dark:text-[#D6D3CD] line-clamp-2">
              {description}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="seo-title-input" className="text-xs font-medium text-[#292524] dark:text-[#D6D3CD]">
                Document &lt;title&gt; *
              </label>
              <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                {title.length}/160 chars
              </span>
            </div>
            <input
              id="seo-title-input"
              type="text"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="seo-desc-input" className="text-xs font-medium text-[#292524] dark:text-[#D6D3CD]">
                meta[name=&quot;description&quot;] *
              </label>
              <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                {description.length}/400 chars
              </span>
            </div>
            <textarea
              id="seo-desc-input"
              rows={3}
              required
              maxLength={400}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="seo-keywords-input" className="text-xs font-medium text-[#292524] dark:text-[#D6D3CD]">
                meta[name=&quot;news_keywords&quot;] (comma-separated) *
              </label>
              <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                {newsKeywords.length}/400 chars
              </span>
            </div>
            <input
              id="seo-keywords-input"
              type="text"
              required
              maxLength={400}
              value={newsKeywords}
              onChange={(e) => setNewsKeywords(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="seo-author-input" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                meta[name=&quot;author&quot;] *
              </label>
              <input
                id="seo-author-input"
                type="text"
                required
                maxLength={120}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
            <div>
              <label htmlFor="seo-canonical-input" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Canonical Base URL
              </label>
              <input
                id="seo-canonical-input"
                type="url"
                maxLength={300}
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="seo-og-title" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                OpenGraph og:title / Twitter Title
              </label>
              <input
                id="seo-og-title"
                type="text"
                maxLength={160}
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
            <div>
              <label htmlFor="seo-og-desc" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                OpenGraph og:description / Twitter Desc
              </label>
              <input
                id="seo-og-desc"
                type="text"
                maxLength={400}
                value={ogDescription}
                onChange={(e) => setOgDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
          </div>

          {feedback && (
            <p
              role="status"
              className={`text-xs font-medium px-3 py-2 rounded-md border ${
                feedback.type === 'success'
                  ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                  : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
              }`}
            >
              {feedback.text}
            </p>
          )}

          <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-60"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{saving ? 'Applying…' : 'Apply Globally & Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
