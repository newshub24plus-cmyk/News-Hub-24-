import { ArrowRight, X } from 'lucide-react';
import { useState } from 'react';
import type { NewsArticle } from '../data/newsData';

interface BreakingNewsBannerProps {
  articles: NewsArticle[];
  onSelectArticle: (article: NewsArticle) => void;
}

export function BreakingNewsBanner({ articles, onSelectArticle }: BreakingNewsBannerProps) {
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const breakingArticle = articles.find((article) => article.breaking === true);

  if (!breakingArticle || dismissedId === breakingArticle.id) {
    return null;
  }

  return (
    <section
      aria-label="Breaking News Alert"
      className="border-b border-[#D6D1C7] dark:border-[#2E2C28] bg-[#141413] dark:bg-[#1B1A18] text-[#FBF9F5]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="inline-flex items-center gap-2 shrink-0">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#DC2626]" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-[#FCA5A5] whitespace-nowrap">
              Breaking News
            </span>
          </div>

          <span className="hidden sm:inline text-[#57534E]" aria-hidden="true">
            ·
          </span>

          <button
            type="button"
            onClick={() => onSelectArticle(breakingArticle)}
            className="text-left text-xs sm:text-sm font-medium text-[#FBF9F5] hover:text-[#FCA5A5] transition-colors truncate"
            title={breakingArticle.title}
          >
            {breakingArticle.title}
          </button>

          <span className="hidden lg:inline-flex items-center gap-1.5 text-xs font-mono text-[#A8A29E] whitespace-nowrap shrink-0 tabular-nums">
            <span aria-hidden="true">·</span>
            <span>{breakingArticle.bureau}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectArticle(breakingArticle)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#141413] bg-[#FBF9F5] rounded-sm hover:bg-[#EAE5DC] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span>Read Dispatch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDismissedId(breakingArticle.id)}
            aria-label="Dismiss breaking news banner"
            className="inline-flex items-center justify-center w-8 h-8 text-[#A8A29E] hover:text-white rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
