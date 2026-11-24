import { Eye, Globe, PenSquare, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { ARTICLE_CATALOGS, type NewsArticle, type NewsCategory } from '../data/newsData';

const CROSS_PUBLISH_OPTIONS = [
  { id: 'website', label: 'Website & RSS' },
  { id: 'android_apk', label: 'Android APK Feed' },
  { id: 'base44_app', label: 'Base44 Official App' },
  { id: 'meta_facebook', label: 'Meta Facebook' },
  { id: 'meta_instagram', label: 'Meta Instagram' },
  { id: 'meta_threads', label: 'Meta Threads' },
  { id: 'meta_whatsapp', label: 'Meta WhatsApp' },
  { id: 'youtube', label: 'YouTube Community' }
] as const;

interface PublishStoryModalProps {
  isOpen: boolean;
  defaultCategory: NewsCategory;
  onClose: () => void;
  onPublished: (article: NewsArticle, message: string) => void;
}

export function PublishStoryModal({
  isOpen,
  defaultCategory,
  onClose,
  onPublished
}: PublishStoryModalProps) {
  const resolveInitialCategory = (cat: NewsCategory): Exclude<NewsCategory, 'All'> =>
    cat !== 'All' ? cat : 'Sports';

  const [category, setCategory] = useState<Exclude<NewsCategory, 'All'>>(
    resolveInitialCategory(defaultCategory)
  );
  const [title, setTitle] = useState('');
  const [kicker, setKicker] = useState('');
  const [deck, setDeck] = useState('');
  const [author, setAuthor] = useState('');
  const [bureau, setBureau] = useState('');
  const [pullQuote, setPullQuote] = useState('');
  const [body, setBody] = useState('');
  const [breaking, setBreaking] = useState(false);
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([
    'website',
    'android_apk',
    'base44_app',
    'meta_facebook',
    'meta_instagram',
    'meta_threads',
    'meta_whatsapp',
    'youtube'
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTargetPlatform = (id: string) => {
    setTargetPlatforms((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id]
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    setCategory(resolveInitialCategory(defaultCategory));
    setError(null);
  }, [isOpen, defaultCategory]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 6) {
      setError('Headline must be at least 6 characters.');
      return;
    }
    if (deck.trim().length < 12) {
      setError('Summary deck must be at least 12 characters.');
      return;
    }
    if (author.trim().length < 2) {
      setError('Please provide an author or desk name.');
      return;
    }
    if (body.trim().length < 30) {
      setError('Story body must contain at least 30 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          deck: deck.trim(),
          category,
          author: author.trim(),
          bureau: bureau.trim(),
          kicker: kicker.trim(),
          pullQuote: pullQuote.trim(),
          body: body.trim(),
          breaking,
          publishPlatforms: targetPlatforms
        })
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not publish story.');
      }

      setTitle('');
      setKicker('');
      setDeck('');
      setAuthor('');
      setBureau('');
      setPullQuote('');
      setBody('');
      setBreaking(false);
      onPublished(payload.article as NewsArticle, payload.message as string);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to publish story right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-8 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-story-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#FBF9F5] dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#1C1B19]">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-0.5 flex items-center gap-1.5">
              <PenSquare className="w-3.5 h-3.5" />
              <span>News Hub 24+.com Wire Publication</span>
            </p>
            <h2
              id="publish-story-modal-title"
              className="font-serif text-lg sm:text-xl font-semibold text-[#141413] dark:text-[#F5F3EE]"
            >
              Publish a New Story to Reader Catalogs
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close publish story modal"
            className="inline-flex items-center justify-center w-9 h-9 text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="pub-category"
                className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
              >
                Catalog Section *
              </label>
              <select
                id="pub-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Exclude<NewsCategory, 'All'>)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
              >
                {ARTICLE_CATALOGS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pub-kicker"
                className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
              >
                Section Kicker (optional)
              </label>
              <input
                id="pub-kicker"
                type="text"
                value={kicker}
                onChange={(e) => setKicker(e.target.value)}
                placeholder="e.g. Match Analysis · Cinema Reel · Comic Issue"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] dark:placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="pub-title"
              className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
            >
              Headline *
            </label>
            <input
              id="pub-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Write a clear editorial headline..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
            />
          </div>

          <div>
            <label
              htmlFor="pub-deck"
              className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
            >
              Summary Deck *
            </label>
            <input
              id="pub-deck"
              type="text"
              required
              value={deck}
              onChange={(e) => setDeck(e.target.value)}
              placeholder="One or two sentences summarizing the dispatch..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="pub-author"
                className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
              >
                Author / Contributor *
              </label>
              <input
                id="pub-author"
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name or newsroom desk"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
              />
            </div>

            <div>
              <label
                htmlFor="pub-bureau"
                className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
              >
                Bureau / City Desk (optional)
              </label>
              <input
                id="pub-bureau"
                type="text"
                value={bureau}
                onChange={(e) => setBureau(e.target.value)}
                placeholder="e.g. Atlanta Bureau · Lagos Desk"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="pub-body"
              className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
            >
              Full Story Body * <span className="text-[#57534E] dark:text-[#A8A29E] font-normal">(separate paragraphs with blank lines)</span>
            </label>
            <textarea
              id="pub-body"
              rows={5}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your report, sports recap, Black History feature, movie snippet breakdown, comic series release, or commercial spotlight..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
            />
          </div>

          <div>
            <label
              htmlFor="pub-quote"
              className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
            >
              Featured Pull Quote (optional)
            </label>
            <input
              id="pub-quote"
              type="text"
              value={pullQuote}
              onChange={(e) => setPullQuote(e.target.value)}
              placeholder="Highlighted statement or quote for the reader view..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs text-[#292524] dark:text-[#D6D3CD] cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={breaking}
              onChange={(e) => setBreaking(e.target.checked)}
              className="h-4 w-4 rounded-sm border-[#D6D1C7] dark:border-[#3A3732] accent-[#991B1B]"
            />
            <span>Feature in the live Breaking News wire banner</span>
          </label>

          {/* Cross-Platform Story Syndication Selector */}
          <fieldset className="p-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-2.5">
            <legend className="px-1 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
              <span>Publish Across Connected Platforms ({targetPlatforms.length} selected)</span>
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CROSS_PUBLISH_OPTIONS.map((opt) => {
                const checked = targetPlatforms.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-2 px-2.5 py-2 text-xs rounded border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-white dark:bg-[#141413] border-[#991B1B] dark:border-[#F87171] text-[#141413] dark:text-[#F5F3EE] font-medium'
                        : 'bg-[#FBF9F5] dark:bg-[#171715] border-[#D6D1C7] dark:border-[#3A3732] text-[#57534E] dark:text-[#A8A29E]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTargetPlatform(opt.id)}
                      className="h-3.5 w-3.5 accent-[#991B1B] shrink-0"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <p
              role="alert"
              className="text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] px-3 py-2 rounded-md"
            >
              {error}
            </p>
          )}

          <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#57534E] dark:text-[#A8A29E]">
              <Eye className="w-3.5 h-3.5" />
              <span>Tracks live reader views &amp; syndicates to RSS + sitemaps</span>
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Publishing Story…' : 'Publish to Catalog'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
