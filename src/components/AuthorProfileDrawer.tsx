import { ArrowRight, BookOpen, Globe, Mail, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { resolveAuthorProfile, type NewsArticle } from '../data/newsData';
import { calculateEstimatedReadTime } from '../utils/readingTime';

export interface SelectedAuthorTarget {
  name: string;
  role?: string;
  bureau?: string;
}

interface AuthorProfileDrawerProps {
  target: SelectedAuthorTarget | null;
  articles: NewsArticle[];
  onClose: () => void;
  onSelectArticle: (article: NewsArticle) => void;
}

function getInitials(name: string): string {
  const cleaned = name
    .replace(/\bDr\.\s*/gi, '')
    .split(/[\s&]+/)
    .filter((part) => part.length > 0 && part !== '&');
  if (cleaned.length === 0) return 'NH';
  if (cleaned.length === 1) return cleaned[0].slice(0, 2).toUpperCase();
  return `${cleaned[0][0]}${cleaned[cleaned.length - 1][0]}`.toUpperCase();
}

export function AuthorProfileDrawer({
  target,
  articles,
  onClose,
  onSelectArticle
}: AuthorProfileDrawerProps) {
  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [target, onClose]);

  const profile = useMemo(() => {
    if (!target) return null;
    return resolveAuthorProfile(target.name, target.role, target.bureau, articles);
  }, [target, articles]);

  const contributions = useMemo(() => {
    if (!target) return [];
    const normalized = target.name.trim().toLowerCase();
    return articles
      .filter((a) => {
        const authorNorm = a.author.trim().toLowerCase();
        return authorNorm === normalized || authorNorm.includes(normalized) || normalized.includes(authorNorm);
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [target, articles]);

  const totalViews = useMemo(
    () => contributions.reduce((sum, item) => sum + item.views, 0),
    [contributions]
  );

  if (!target || !profile) return null;

  const initials = getInitials(profile.name);

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="author-profile-name"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg h-full overflow-y-auto bg-[#FBF9F5] dark:bg-[#141413] border-l border-[#DFDBD2] dark:border-[#2E2C28] shadow-2xl flex flex-col justify-between"
      >
        <div>
          {/* Top Drawer Bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26]">
            <div className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171]">
              Editorial Author Profile
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close author profile"
              className="inline-flex items-center justify-center w-9 h-9 text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors focus-visible:outline-2 focus-visible:outline-[#991B1B]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-7 sm:px-8 space-y-7">
            {/* Header Lockup */}
            <div className="flex items-start gap-4">
              <div
                aria-hidden="true"
                className="w-14 h-14 rounded-md bg-white dark:bg-[#1C1B19] border border-[#DFDBD2] dark:border-[#2E2C28] flex items-center justify-center font-serif text-xl font-bold text-[#991B1B] dark:text-[#F87171] shrink-0"
              >
                {initials}
              </div>
              <div className="min-w-0">
                <h2
                  id="author-profile-name"
                  className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] leading-tight"
                >
                  {profile.name}
                </h2>
                <p className="text-xs sm:text-sm text-[#44403C] dark:text-[#D6D3CD] mt-1">
                  {profile.role} <span aria-hidden="true">·</span> {profile.bureau}
                </p>
                <p className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1">
                  {profile.credentials}
                </p>
              </div>
            </div>

            {/* 3-Column Tabular Author Stats */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-[#E5E2DC] dark:border-[#2C2A26]">
              <div>
                <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mb-0.5">Contributions</p>
                <p className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {contributions.length}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mb-0.5">Reader Views</p>
                <p className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {totalViews.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mb-0.5">Desk Tenure</p>
                <p className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {profile.yearsReporting} yrs
                </p>
              </div>
            </div>

            {/* Editorial Bio */}
            <section aria-labelledby="author-bio-heading" className="space-y-2">
              <h3
                id="author-bio-heading"
                className="text-xs font-semibold text-[#57534E] dark:text-[#A8A29E]"
              >
                Editorial Biography
              </h3>
              <p className="text-sm sm:text-[15px] text-[#292524] dark:text-[#E5E2DC] leading-relaxed">
                {profile.bio}
              </p>
            </section>

            {/* Areas of Expertise & Languages */}
            <section aria-labelledby="author-expertise-heading" className="space-y-3">
              <h3
                id="author-expertise-heading"
                className="text-xs font-semibold text-[#57534E] dark:text-[#A8A29E]"
              >
                Beats &amp; Areas of Expertise
              </h3>
              <ul className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] border-t border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs sm:text-sm">
                {profile.expertise.map((topic, idx) => (
                  <li
                    key={topic}
                    className="py-2.5 flex items-center justify-between gap-3 text-[#141413] dark:text-[#F5F3EE]"
                  >
                    <span className="font-medium">{topic}</span>
                    <span className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                      0{idx + 1}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#57534E] dark:text-[#A8A29E]">
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{profile.languages}</span>
                </span>
                <a
                  href={`mailto:${profile.contactEmail}?subject=${encodeURIComponent(`Press Desk Inquiry for ${profile.name}`)}`}
                  className="inline-flex items-center gap-1.5 font-medium text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171] hover:underline underline-offset-4"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Contact via Desk</span>
                </a>
              </div>
            </section>

            {/* Recent Contributions */}
            <section aria-labelledby="author-contributions-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3
                  id="author-contributions-heading"
                  className="text-xs font-semibold text-[#57534E] dark:text-[#A8A29E] inline-flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                  <span>Recent Contributions on News Hub 24+</span>
                </h3>
                <span className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                  {contributions.length} {contributions.length === 1 ? 'dispatch' : 'dispatches'}
                </span>
              </div>

              {contributions.length === 0 ? (
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] py-4 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                  No archived dispatches found under this byline yet.
                </p>
              ) : (
                <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] border-t border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                  {contributions.map((story) => (
                    <article key={story.id} className="py-4 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                        <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">
                          {story.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={story.publishedAt} className="font-mono tabular-nums">
                          {story.displayDate}
                        </time>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {calculateEstimatedReadTime(story).shortLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {story.views.toLocaleString()} views
                        </span>
                      </div>
                      <h4 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE] leading-snug">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectArticle(story);
                          }}
                          className="text-left hover:text-[#991B1B] dark:hover:text-[#F87171] transition-colors"
                        >
                          {story.title}
                        </button>
                      </h4>
                      <p className="text-xs text-[#44403C] dark:text-[#D6D3CD] leading-relaxed line-clamp-2">
                        {story.deck}
                      </p>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectArticle(story);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171] transition-colors"
                        >
                          <span>Read Dispatch</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border-t border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-3 text-xs">
          <span className="text-[#57534E] dark:text-[#A8A29E] truncate">
            News Hub 24+ Editorial Masthead
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] transition-colors whitespace-nowrap shrink-0"
          >
            Close Profile
          </button>
        </div>
      </aside>
    </div>
  );
}
