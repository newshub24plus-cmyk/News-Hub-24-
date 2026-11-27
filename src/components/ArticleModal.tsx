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
  Pause,
  Play,
  Share2,
  SkipBack,
  SkipForward,
  Square,
  ThumbsUp,
  Volume2,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  // Web Speech API ('Listen to Article') state
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speechSessionRef = useRef<number>(0);
  const activeSegmentRef = useRef<number>(-1);
  const speechRateRef = useRef<number>(1);
  const selectedVoiceUriRef = useRef<string>('');
  const speechVoicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    speechRateRef.current = speechRate;
  }, [speechRate]);

  useEffect(() => {
    selectedVoiceUriRef.current = selectedVoiceUri;
  }, [selectedVoiceUri]);

  useEffect(() => {
    speechVoicesRef.current = speechVoices;
  }, [speechVoices]);

  const speechSegments = useMemo(() => {
    if (!article) return [];
    const list: Array<{ label: string; text: string; paragraphIndex: number | null }> = [
      {
        label: 'Headline & Summary',
        text: `${article.title}. ${article.deck}. By ${article.author}.`,
        paragraphIndex: null
      },
      ...article.paragraphs.map((p, idx) => ({
        label: `Paragraph ${idx + 1} of ${article.paragraphs.length}`,
        text: p,
        paragraphIndex: idx
      }))
    ];
    if (article.pullQuote) {
      list.push({
        label: 'Featured Quote',
        text: `Featured quote: ${article.pullQuote}`,
        paragraphIndex: null
      });
    }
    return list;
  }, [article]);

  const stopSpeech = useCallback(() => {
    speechSessionRef.current += 1;
    activeSegmentRef.current = -1;
    setSpeechStatus('idle');
    setActiveSegmentIndex(-1);
    setSpeechError(null);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser cancel edge cases
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechSupported(false);
      return;
    }
    setSpeechSupported(true);

    const loadVoices = () => {
      try {
        const list = window.speechSynthesis.getVoices();
        if (list.length > 0) {
          setSpeechVoices(list);
          setSelectedVoiceUri((prev) => {
            if (prev && list.some((v) => v.voiceURI === prev)) return prev;
            const preferred =
              list.find((v) => v.default && v.lang.toLowerCase().startsWith('en')) ??
              list.find((v) => v.lang.toLowerCase().startsWith('en')) ??
              list[0];
            return preferred?.voiceURI ?? '';
          });
        }
      } catch {
        // Ignore voice enumeration errors
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, []);

  const speakSegmentAt = useCallback(
    (index: number) => {
      if (!article || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      if (index < 0 || index >= speechSegments.length) {
        stopSpeech();
        return;
      }

      const sessionId = speechSessionRef.current + 1;
      speechSessionRef.current = sessionId;
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel failures
      }

      const segment = speechSegments[index];
      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.rate = speechRateRef.current;
      const chosenVoice = speechVoicesRef.current.find(
        (v) => v.voiceURI === selectedVoiceUriRef.current
      );
      if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang;
      } else {
        utterance.lang = 'en-US';
      }

      activeSegmentRef.current = index;
      setActiveSegmentIndex(index);
      setSpeechStatus('playing');
      setSpeechError(null);

      utterance.onend = () => {
        if (speechSessionRef.current !== sessionId) return;
        if (index + 1 < speechSegments.length) {
          speakSegmentAt(index + 1);
        } else {
          speechSessionRef.current += 1;
          activeSegmentRef.current = -1;
          setSpeechStatus('idle');
          setActiveSegmentIndex(-1);
        }
      };

      utterance.onerror = (event) => {
        if (speechSessionRef.current !== sessionId) return;
        const errCode = (event as SpeechSynthesisErrorEvent).error;
        if (errCode === 'interrupted' || errCode === 'canceled') return;
        setSpeechStatus('idle');
        setActiveSegmentIndex(-1);
        activeSegmentRef.current = -1;
        setSpeechError('Browser speech synthesis could not play audio on this device.');
      };

      window.speechSynthesis.speak(utterance);
    },
    [article, speechSegments, stopSpeech]
  );

  const handleToggleListen = useCallback(() => {
    if (!speechSupported || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeechError('Text-to-speech is not supported in this browser.');
      return;
    }
    if (speechStatus === 'playing') {
      try {
        window.speechSynthesis.pause();
        setSpeechStatus('paused');
      } catch {
        stopSpeech();
      }
      return;
    }
    if (speechStatus === 'paused') {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setSpeechStatus('playing');
        } else {
          const resumeIdx = activeSegmentRef.current >= 0 ? activeSegmentRef.current : 0;
          speakSegmentAt(resumeIdx);
        }
      } catch {
        const resumeIdx = activeSegmentRef.current >= 0 ? activeSegmentRef.current : 0;
        speakSegmentAt(resumeIdx);
      }
      return;
    }
    speakSegmentAt(0);
  }, [speakSegmentAt, speechStatus, speechSupported, stopSpeech]);

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
    stopSpeech();
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
      stopSpeech();
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateScrollProgress);
    };
  }, [article?.id, stopSpeech]);

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
            <button
              type="button"
              onClick={handleToggleListen}
              disabled={!speechSupported}
              aria-pressed={speechStatus !== 'idle'}
              title={speechSupported ? 'Listen to this article read aloud' : 'Web Speech API unavailable in this browser'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#991B1B] disabled:opacity-50 ${
                speechStatus !== 'idle'
                  ? 'text-white bg-[#991B1B] border-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:border-[#DC2626]'
                  : 'text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border-[#D6D1C7] dark:border-[#3A3732] hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28]'
              }`}
            >
              {speechStatus === 'playing' ? (
                <Pause className="w-3.5 h-3.5" />
              ) : speechStatus === 'paused' ? (
                <Play className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
              <span>
                {speechStatus === 'playing'
                  ? 'Pause Audio'
                  : speechStatus === 'paused'
                    ? 'Resume Audio'
                    : 'Listen to Article'}
              </span>
            </button>
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

          {/* Inline Listen to Article Web Speech Audio Bar */}
          {(speechStatus !== 'idle' || speechError) && (
            <div
              role="region"
              aria-label="Audio article reader controls"
              className="mb-6 p-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Volume2 className="w-4 h-4 text-[#991B1B] dark:text-[#F87171] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                    {speechError
                      ? speechError
                      : speechStatus === 'paused'
                        ? `Paused · ${speechSegments[activeSegmentIndex]?.label ?? 'Audio Ready'}`
                        : `Reading Aloud · ${speechSegments[activeSegmentIndex]?.label ?? 'Starting…'}`}
                  </p>
                  {!speechError && (
                    <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                      Segment {Math.max(1, activeSegmentIndex + 1)} of {speechSegments.length} · Speed {speechRate}x
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => speakSegmentAt(Math.max(0, activeSegmentIndex - 1))}
                  disabled={activeSegmentIndex <= 0}
                  aria-label="Previous section"
                  className="p-1.5 text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded disabled:opacity-40"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleToggleListen}
                  aria-label={speechStatus === 'playing' ? 'Pause audio' : 'Resume audio'}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] rounded"
                >
                  {speechStatus === 'playing' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{speechStatus === 'playing' ? 'Pause' : 'Resume'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => speakSegmentAt(Math.min(speechSegments.length - 1, activeSegmentIndex + 1))}
                  disabled={activeSegmentIndex >= speechSegments.length - 1}
                  aria-label="Next section"
                  className="p-1.5 text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded disabled:opacity-40"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={stopSpeech}
                  aria-label="Stop reading"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded hover:border-[#991B1B]"
                >
                  <Square className="w-3 h-3" />
                  <span>Stop</span>
                </button>

                <select
                  aria-label="Reading speed"
                  value={speechRate}
                  onChange={(e) => {
                    const nextRate = Number(e.target.value) || 1;
                    setSpeechRate(nextRate);
                    speechRateRef.current = nextRate;
                    if (speechStatus !== 'idle' && activeSegmentRef.current >= 0) {
                      speakSegmentAt(activeSegmentRef.current);
                    }
                  }}
                  className="px-2 py-1 text-[11px] font-mono bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE]"
                >
                  <option value={0.9}>0.9x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                </select>

                {speechVoices.length > 0 && (
                  <select
                    aria-label="Narrator voice"
                    value={selectedVoiceUri}
                    onChange={(e) => {
                      const nextUri = e.target.value;
                      setSelectedVoiceUri(nextUri);
                      selectedVoiceUriRef.current = nextUri;
                      if (speechStatus !== 'idle' && activeSegmentRef.current >= 0) {
                        speakSegmentAt(activeSegmentRef.current);
                      }
                    }}
                    className="max-w-[140px] px-2 py-1 text-[11px] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE] truncate"
                  >
                    {speechVoices.slice(0, 20).map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

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
            {article.paragraphs.map((paragraph, index) => {
              const isBeingSpoken =
                speechStatus !== 'idle' &&
                speechSegments[activeSegmentIndex]?.paragraphIndex === index;
              return (
                <p
                  key={index}
                  className={`${
                    index === 0
                      ? 'first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none first-letter:text-[#141413] dark:first-letter:text-[#F5F3EE]'
                      : ''
                  } ${
                    isBeingSpoken
                      ? 'bg-[#FEF2F2] dark:bg-[#2A1515]/60 border-l-2 border-[#991B1B] dark:border-[#F87171] pl-3 py-1 rounded-r transition-colors'
                      : ''
                  }`}
                >
                  {paragraph}
                </p>
              );
            })}
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
