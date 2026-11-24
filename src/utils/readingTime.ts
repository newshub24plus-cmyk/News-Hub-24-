export const DEFAULT_READING_WPM = 200;

export interface ArticleWordStatsInput {
  title?: string;
  deck?: string;
  pullQuote?: string;
  paragraphs?: string[];
  readTime?: string;
}

export interface ArticleReadingStats {
  wordCount: number;
  minutes: number;
  label: string;
  shortLabel: string;
  summary: string;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Dynamically calculates estimated minutes to read from an article's
 * title, deck, pullQuote, and body paragraphs based on word count.
 */
export function calculateEstimatedReadTime(
  article: ArticleWordStatsInput,
  wordsPerMinute: number = DEFAULT_READING_WPM
): ArticleReadingStats {
  const safeWpm = wordsPerMinute > 0 ? wordsPerMinute : DEFAULT_READING_WPM;
  const combinedSegments = [
    article.title ?? '',
    article.deck ?? '',
    article.pullQuote ?? '',
    ...(Array.isArray(article.paragraphs) ? article.paragraphs : [])
  ];

  const wordCount = combinedSegments.reduce((total, segment) => total + countWords(segment), 0);

  if (wordCount === 0) {
    return {
      wordCount: 0,
      minutes: 1,
      label: '1 min read',
      shortLabel: '1m read',
      summary: '1 min read · 0 words'
    };
  }

  const minutes = Math.max(1, Math.ceil(wordCount / safeWpm));
  const label = `${minutes} min read`;
  return {
    wordCount,
    minutes,
    label,
    shortLabel: `${minutes}m read`,
    summary: `${label} · ${wordCount.toLocaleString()} words`
  };
}
