import {
  Award,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  ExternalLink,
  Globe,
  HelpCircle,
  Lightbulb,
  Share2,
  ThumbsUp,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { NewsArticle } from '../data/newsData';
import { calculateEstimatedReadTime } from '../utils/readingTime';
import { EditorialImage } from './EditorialImage';

export type ModalReactionKind =
  | 'insightful'
  | 'support'
  | 'celebrate'
  | 'curious'
  | 'shareworthy';

export interface ModalReactionTally {
  insightful: number;
  support: number;
  celebrate: number;
  curious: number;
  shareworthy: number;
  total: number;
}

interface ArticleModalProps {
  article: NewsArticle | null;
  onClose: () => void;
  isSaved?: boolean;
  onToggleSave?: (articleId: string) => void;
  onSelectAuthor?: (authorName: string, authorRole?: string, bureau?: string) => void;
  onReadingEngage?: (articleId: string, seconds: number) => void;
  reactionTally?: ModalReactionTally;
  onReact?: (articleId: string, reactionType: ModalReactionKind) => Promise<void> | void;
  onSyndicateAcrossPlatforms?: (article: NewsArticle) => Promise<void> | void;
}

export function ArticleModal({
  article,
  onClose,
  isSaved = false,
  onToggleSave,
  onSelectAuthor,
  onReadingEngage,
  reactionTally,
  onReact,
  onSyndicateAcrossPlatforms
}: ArticleModalProps) {
  const [copied, setCopied] = useState(false);
  const [syndicating, setSyndicating] = useState(false);
  const [syndicateFeedback, setSyndicateFeedback] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!article) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [article, onClose]);

  const updateScrollProgress = () => {
    const el = scrollBodyRef.current;
    if (!el) return;
    const scrollableDistance = el.scrollHeight - el.clientHeight;
    if (scrollableDistance <= 1) {
      setReadingProgress(100);
      return;
    }
    const pct = Math.min(100, Math.max(0, (el.scrollTop / scrollableDistance) * 100));
    setReadingProgress(Number(pct.toFixed(1)));
  };

  useEffect(() => {
    if (!article) return;
    const el = scrollBodyRef.current;
    if (el) {
      el.scrollTop = 0;
    }
    setReadingProgress(0);
    const rafId = window.requestAnimationFrame(() => {
      updateScrollProgress();
    });
    window.addEventListener('resize', updateScrollProgress);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateScrollProgress);
    };
  }, [article?.id]);

  useEffect(() => {
    if (!article || !onReadingEngage) return;
    const articleId = article.id;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        onReadingEngage(articleId, 15);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [article, onReadingEngage]);

  const handleBodyScroll = () => {
    updateScrollProgress();
  };

  if (!article) return null;
  const displayProgress = Math.round(readingProgress);

  const handleCopyShareUrl = async () => {
    const shareUrl = `${window.location.origin}/?story=${encodeURIComponent(article.slug)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-modal-title"
      onClick={onClose}
    >
      <article
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-[#FBF9F5] dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thin Reading Progress Bar pinned at the very top of ArticleModal */}
        <div
          role="progressbar"
          aria-label="Article reading progress"
          aria-valuenow={displayProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-[3px] bg-[#E5E2DC] dark:bg-[#2C2A26] shrink-0"
        >
          <svg
            viewBox="0 0 100 1"
            preserveAspectRatio="none"
            className="block w-full h-full"
            aria-hidden="true"
          >
            <rect
              x="0"
              y="0"
              width={readingProgress}
              height="1"
              className="fill-[#991B1B] dark:fill-[#F87171] transition-all duration-100"
            />
          </svg>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#1C1B19] shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E] dark:text-[#A8A29E] font-medium min-w-0">
            <span className="text-[#991B1B] dark:text-[#F87171] font-semibold">{article.category}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{article.bureau}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{calculateEstimatedReadTime(article).summary}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[#141413] dark:text-[#F5F3EE]">
              {article.views.toLocaleString()} views
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[#991B1B] dark:text-[#F87171]">
              {displayProgress}% read
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onToggleSave && (
              <button
                type="button"
                onClick={() => onToggleSave(article.id)}
                aria-pressed={isSaved}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#991B1B] ${
                  isSaved
                    ? 'text-[#991B1B] dark:text-[#F87171] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                    : 'text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border-[#D6D1C7] dark:border-[#3A3732] hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28]'
                }`}
              >
                {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                <span>{isSaved ? 'Saved' : 'Save for Later'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyShareUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#991B1B]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied' : 'Copy Story Link'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dispatch"
              className="inline-flex items-center justify-center w-9 h-9 text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors focus-visible:outline-2 focus-visible:outline-[#991B1B]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollBodyRef}
          onScroll={handleBodyScroll}
          className="flex-1 overflow-y-auto px-6 py-8 sm:px-10 sm:py-10"
        >
          <p className="text-xs font-medium tracking-wide text-[#57534E] dark:text-[#A8A29E] mb-3">
            {article.kicker}
          </p>

          <h2
            id="article-modal-title"
            className="font-serif text-2xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F5F3EE] leading-tight mb-4"
          >
            {article.title}
          </h2>

          <p className="text-base sm:text-lg text-[#44403C] dark:text-[#D6D3CD] leading-relaxed mb-6">
            {article.deck}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 pb-6 mb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs text-[#57534E] dark:text-[#A8A29E]">
            <div>
              <span>By </span>
              {onSelectAuthor ? (
                <button
                  type="button"
                  onClick={() => onSelectAuthor(article.author, article.authorRole, article.bureau)}
                  className="font-semibold text-[#141413] dark:text-[#F5F3EE] underline decoration-[#D6D1C7] dark:decoration-[#57534E] underline-offset-4 hover:text-[#991B1B] dark:hover:text-[#F87171] hover:decoration-[#991B1B] transition-colors"
                >
                  {article.author}
                </button>
              ) : (
                <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">{article.author}</span>
              )}
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{article.authorRole}</span>
            </div>
            <time dateTime={article.publishedAt} className="font-mono tabular-nums">
              {article.displayDate}
            </time>
          </div>

          {article.imageKey && (
            <figure className="mb-8">
              <div className="overflow-hidden rounded-md border border-[#E5E2DC] dark:border-[#2C2A26] bg-[#EFECE6] dark:bg-[#1F1E1B]">
                <EditorialImage
                  imageKey={article.imageKey}
                  alt={article.figureCaption || article.title}
                  className="aspect-video"
                />
              </div>
              {article.figureCaption && (
                <figcaption className="mt-2.5 text-xs font-serif italic text-[#57534E] dark:text-[#A8A29E]">
                  {article.figureCaption}
                </figcaption>
              )}
            </figure>
          )}

          <div className="max-w-prose space-y-5 text-[16px] text-[#292524] dark:text-[#E5E2DC] leading-[1.78]">
            {article.paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className={
                  index === 0
                    ? 'first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none first-letter:text-[#141413] dark:first-letter:text-[#F5F3EE]'
                    : ''
                }
              >
                {paragraph}
              </p>
            ))}
          </div>

          {article.pullQuote && (
            <blockquote className="my-8 py-6 border-y border-[#D6D1C7] dark:border-[#2E2C28] font-serif italic text-xl sm:text-2xl text-[#141413] dark:text-[#F5F3EE] leading-snug">
              “{article.pullQuote}”
            </blockquote>
          )}

          {article.sourceLinks && article.sourceLinks.length > 0 && (
            <div className="my-6 p-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-2">
              <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                Grounded Reporting Sources {article.regionFocus ? `· ${article.regionFocus}` : ''}
              </p>
              <ul className="space-y-1.5 text-xs">
                {article.sourceLinks.map((src, idx) => (
                  <li key={`${src.uri}-${idx}`} className="flex items-center gap-2 min-w-0">
                    <ExternalLink className="w-3 h-3 text-[#991B1B] dark:text-[#F87171] shrink-0" />
                    <a
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#292524] dark:text-[#D6D3CD] hover:text-[#991B1B] dark:hover:text-[#F87171] underline underline-offset-2 truncate"
                    >
                      {src.title || src.uri}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Post Reactions & Cross-Platform Syndication Bar */}
          <div className="my-8 p-5 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Reader Reactions &amp; Cross-Platform Distribution
                </p>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] font-mono tabular-nums mt-0.5">
                  {(reactionTally?.total ?? 0).toLocaleString()} total post reactions recorded
                </p>
              </div>
              {onSyndicateAcrossPlatforms && (
                <button
                  type="button"
                  disabled={syndicating}
                  onClick={async () => {
                    setSyndicateFeedback(null);
                    setSyndicating(true);
                    try {
                      await onSyndicateAcrossPlatforms(article);
                      setSyndicateFeedback('Published across all 8 connected platforms.');
                    } catch {
                      setSyndicateFeedback('Could not syndicate right now.');
                    } finally {
                      setSyndicating(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{syndicating ? 'Publishing…' : 'Publish Across All Platforms'}</span>
                </button>
              )}
            </div>

            {syndicateFeedback && (
              <p className="text-xs font-medium text-[#14532D] dark:text-[#4ADE80]">
                {syndicateFeedback}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'insightful', label: 'Insightful', Icon: Lightbulb },
                  { id: 'support', label: 'Support', Icon: ThumbsUp },
                  { id: 'celebrate', label: 'Celebrate', Icon: Award },
                  { id: 'curious', label: 'Curious', Icon: HelpCircle },
                  { id: 'shareworthy', label: 'Shareworthy', Icon: Share2 }
                ] as const
              ).map(({ id, label, Icon }) => {
                const count = reactionTally?.[id] ?? 0;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onReact?.(article.id, id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                    <span>{label}</span>
                    <span className="font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-4 text-xs text-[#57534E] dark:text-[#A8A29E]">
            <span>
              Published by News Hub 24+.com{article.isAiGenerated ? ' · AI Wire Assistant' : ''} · Dispatch ID{' '}
              {article.id.toUpperCase()} ·{' '}
              <span className="font-mono tabular-nums">{article.views.toLocaleString()} reader views</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] transition-colors whitespace-nowrap shrink-0"
            >
              Return to Front Page
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
