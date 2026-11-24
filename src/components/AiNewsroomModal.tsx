import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  Newspaper,
  Radar,
  Sparkles,
  X
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { ARTICLE_CATALOGS, type NewsArticle } from '../data/newsData';

export type AiRegionFocus = 'Global' | 'Europe & Asia' | 'Europe' | 'Asia';

export interface AiTrendingTopic {
  id: string;
  headline: string;
  summary: string;
  region: AiRegionFocus;
  suggestedCatalog: Exclude<NewsArticle['category'], 'All'>;
  whyTrending: string;
  sources: Array<{ title: string; uri: string }>;
}

export interface AiDeskStatusResponse {
  configured: boolean;
  model: string;
  groundingTool: string;
  regions: AiRegionFocus[];
  catalogs: Array<Exclude<NewsArticle['category'], 'All'>>;
  autoPublish: {
    enabled: boolean;
    intervalMinutes: number;
    regionFocus: AiRegionFocus;
    catalog: string;
    totalAiPublished: number;
    lastRunAt: string | null;
    lastError: string | null;
  };
  recentRuns: Array<{
    id: string;
    regionFocus: AiRegionFocus;
    catalog: string;
    publishedTitles: string[];
    sourcesCount: number;
    mode: 'manual' | 'scheduled';
    createdAt: string;
  }>;
  recentAiArticles: Array<{
    id: string;
    title: string;
    category: string;
    regionFocus: AiRegionFocus;
    publishedAt: string;
    sourceCount: number;
  }>;
}

interface AiNewsroomModalProps {
  isOpen: boolean;
  defaultCatalog: Exclude<NewsArticle['category'], 'All'> | 'All';
  onClose: () => void;
  onArticlesPublished: (articles: NewsArticle[], message: string) => void;
  onOpenArticleById?: (articleId: string) => void;
}

const REGION_OPTIONS: Array<{ value: AiRegionFocus; label: string; detail: string }> = [
  {
    value: 'Global',
    label: 'World (Global Priority)',
    detail: 'Top worldwide breaking trends including Europe, Asia & international markets'
  },
  {
    value: 'Europe & Asia',
    label: 'Europe & Asia Focus',
    detail: 'Balanced cross-continental coverage from Brussels, London, Tokyo & Singapore'
  },
  {
    value: 'Europe',
    label: 'Europe Desk',
    detail: 'European Union, UK, Nordics, sovereign policy, energy, sports & culture'
  },
  {
    value: 'Asia',
    label: 'Asia-Pacific Desk',
    detail: 'East, South & Southeast Asia trade, semiconductors, cinema, sports & tech'
  }
];

export function AiNewsroomModal({
  isOpen,
  defaultCatalog,
  onClose,
  onArticlesPublished,
  onOpenArticleById
}: AiNewsroomModalProps) {
  const [activeTab, setActiveTab] = useState<'publish' | 'radar' | 'scheduler'>('publish');
  const [status, setStatus] = useState<AiDeskStatusResponse | null>(null);

  // Publish Form State
  const [regionFocus, setRegionFocus] = useState<AiRegionFocus>('Global');
  const [selectedCatalog, setSelectedCatalog] = useState<string>('auto');
  const [topicHint, setTopicHint] = useState<string>('');
  const [batchCount, setBatchCount] = useState<number>(2);
  const [markBreaking, setMarkBreaking] = useState<boolean>(true);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishFeedback, setPublishFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    createdArticles?: NewsArticle[];
  } | null>(null);

  // Radar State
  const [scanningRadar, setScanningRadar] = useState<boolean>(false);
  const [radarTopics, setRadarTopics] = useState<AiTrendingTopic[]>([]);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [publishingTopicId, setPublishingTopicId] = useState<string | null>(null);

  // Scheduler State
  const [schedEnabled, setSchedEnabled] = useState<boolean>(false);
  const [schedInterval, setSchedInterval] = useState<number>(60);
  const [schedRegion, setSchedRegion] = useState<AiRegionFocus>('Global');
  const [schedCatalog, setSchedCatalog] = useState<string>('auto');
  const [savingScheduler, setSavingScheduler] = useState<boolean>(false);
  const [schedulerFeedback, setSchedulerFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedCatalog(defaultCatalog === 'All' ? 'auto' : defaultCatalog);

    fetch('/api/ai-assistant/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AiDeskStatusResponse | null) => {
        if (!data) return;
        setStatus(data);
        setSchedEnabled(data.autoPublish.enabled);
        setSchedInterval(data.autoPublish.intervalMinutes);
        setSchedRegion(data.autoPublish.regionFocus);
        setSchedCatalog(data.autoPublish.catalog);
      })
      .catch(() => {
        // Ignore non-fatal status load failure
      });
  }, [isOpen, defaultCatalog]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePublishTrending = async (e: FormEvent) => {
    e.preventDefault();
    setPublishFeedback(null);
    setPublishing(true);

    try {
      const res = await fetch('/api/ai-assistant/publish-trending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionFocus,
          catalog: selectedCatalog,
          topicHint: topicHint.trim() || undefined,
          count: batchCount,
          markBreaking
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not publish trending dispatches.');
      }

      const created = (payload.articles ?? []) as NewsArticle[];
      if (payload.status) {
        setStatus(payload.status as AiDeskStatusResponse);
      }
      if (created.length > 0) {
        onArticlesPublished(created, payload.message as string);
      }
      setPublishFeedback({
        type: 'success',
        text: payload.message as string,
        createdArticles: created
      });
      setTopicHint('');
    } catch (err: unknown) {
      setPublishFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to reach AI Trending Wire Desk.'
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleScanRadar = async () => {
    setRadarError(null);
    setScanningRadar(true);
    try {
      const res = await fetch('/api/ai-assistant/discover-briefings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionFocus,
          catalog: selectedCatalog
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not scan live global trends.');
      }
      setRadarTopics((payload.topics ?? []) as AiTrendingTopic[]);
    } catch (err: unknown) {
      setRadarError(err instanceof Error ? err.message : 'Unable to load trending radar.');
    } finally {
      setScanningRadar(false);
    }
  };

  const handlePublishSingleTopic = async (topic: AiTrendingTopic) => {
    setRadarError(null);
    setPublishingTopicId(topic.id);
    try {
      const res = await fetch('/api/ai-assistant/publish-trending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionFocus: topic.region,
          catalog: topic.suggestedCatalog,
          topicHint: topic.headline,
          count: 1,
          markBreaking: true
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not publish topic.');
      }
      const created = (payload.articles ?? []) as NewsArticle[];
      if (payload.status) {
        setStatus(payload.status as AiDeskStatusResponse);
      }
      if (created.length > 0) {
        onArticlesPublished(created, payload.message as string);
        setPublishFeedback({
          type: 'success',
          text: payload.message as string,
          createdArticles: created
        });
      }
    } catch (err: unknown) {
      setRadarError(err instanceof Error ? err.message : 'Failed to publish trending topic.');
    } finally {
      setPublishingTopicId(null);
    }
  };

  const handleSaveScheduler = async (e: FormEvent) => {
    e.preventDefault();
    setSchedulerFeedback(null);
    setSavingScheduler(true);
    try {
      const res = await fetch('/api/ai-assistant/auto-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: schedEnabled,
          intervalMinutes: schedInterval,
          regionFocus: schedRegion,
          catalog: schedCatalog
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Unable to update scheduler.');
      }
      if (payload.status) {
        setStatus(payload.status as AiDeskStatusResponse);
      }
      setSchedulerFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setSchedulerFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save scheduler settings.'
      });
    } finally {
      setSavingScheduler(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-newsroom-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#FBF9F5] dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-6 py-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] flex items-center gap-1.5 mb-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Trending Wire Assistant · Google Search Grounded</span>
            </p>
            <h2
              id="ai-newsroom-title"
              className="font-serif text-xl sm:text-2xl font-bold text-[#141413] dark:text-[#F5F3EE]"
            >
              Publish Real Trending News (World, Europe &amp; Asia)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Trending Desk"
            className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs + Live Desk Metrics */}
        <div className="px-6 py-3 bg-white dark:bg-[#171715] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex border border-[#D6D1C7] dark:border-[#3A3732] rounded-md overflow-hidden bg-[#F5F2EB] dark:bg-[#10100F] text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('publish')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 transition-colors ${
                activeTab === 'publish'
                  ? 'bg-[#141413] text-white dark:bg-[#F5F3EE] dark:text-[#141413] font-semibold'
                  : 'text-[#44403C] dark:text-[#D6D3CD]'
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>Publish Trending</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('radar')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 transition-colors ${
                activeTab === 'radar'
                  ? 'bg-[#141413] text-white dark:bg-[#F5F3EE] dark:text-[#141413] font-semibold'
                  : 'text-[#44403C] dark:text-[#D6D3CD]'
              }`}
            >
              <Radar className="w-3.5 h-3.5" />
              <span>Live Trend Radar</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scheduler')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 transition-colors ${
                activeTab === 'scheduler'
                  ? 'bg-[#141413] text-white dark:bg-[#F5F3EE] dark:text-[#141413] font-semibold'
                  : 'text-[#44403C] dark:text-[#D6D3CD]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Auto-Wire ({status?.autoPublish.enabled ? 'On' : 'Paused'})</span>
            </button>
          </div>

          <div className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums">
            {status?.autoPublish.totalAiPublished ?? 0} AI dispatches published
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {status && !status.configured && (
            <div
              role="alert"
              className="p-4 bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] rounded-md text-xs text-[#991B1B] dark:text-[#FCA5A5] leading-relaxed"
            >
              Server-side Gemini API access is not active yet. Add a valid <span className="font-mono font-semibold">GEMINI_API_KEY</span> in <span className="font-semibold">Settings &gt; Secrets</span> to enable live Google Search trending dispatch publishing.
            </div>
          )}

          {activeTab === 'publish' && (
            <form onSubmit={handlePublishTrending} className="space-y-5">
              {/* Region Focus Selector */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  1. Geographic Wire Priority (World Most Especially, Europe &amp; Asia)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REGION_OPTIONS.map((opt) => {
                    const active = regionFocus === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRegionFocus(opt.value)}
                        className={`p-3 text-left rounded-md border transition-colors ${
                          active
                            ? 'bg-white dark:bg-[#1C1B19] border-[#991B1B] dark:border-[#F87171]'
                            : 'bg-[#F5F2EB]/70 dark:bg-[#10100F] border-[#E5E2DC] dark:border-[#2C2A26] hover:border-[#141413] dark:hover:border-[#57534E]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          <span className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                            <span>{opt.label}</span>
                          </span>
                          {active && <CheckCircle2 className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />}
                        </div>
                        <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-1 leading-snug">
                          {opt.detail}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Catalog + Batch Count */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="ai-catalog-select" className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1">
                    2. Destination Catalog (Fits Any Catalog Designed)
                  </label>
                  <select
                    id="ai-catalog-select"
                    value={selectedCatalog}
                    onChange={(e) => setSelectedCatalog(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  >
                    <option value="auto">Auto-Match Best Fitting Catalog (Recommended)</option>
                    {ARTICLE_CATALOGS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ai-batch-count" className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1">
                    Stories to Publish
                  </label>
                  <select
                    id="ai-batch-count"
                    value={batchCount}
                    onChange={(e) => setBatchCount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  >
                    <option value={1}>1 Full Dispatch</option>
                    <option value={2}>2 Dispatches</option>
                    <option value={3}>3 Dispatches</option>
                  </select>
                </div>
              </div>

              {/* Optional Topic Focus */}
              <div>
                <label htmlFor="ai-topic-hint" className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1">
                  3. Specific Topic or Beat Focus (Optional)
                </label>
                <input
                  id="ai-topic-hint"
                  type="text"
                  value={topicHint}
                  onChange={(e) => setTopicHint(e.target.value)}
                  placeholder="Leave blank for today's top live trends, or enter e.g. 'Champions League', 'Tokyo AI Summit', 'EU Energy Policy'..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-[#292524] dark:text-[#D6D3CD] cursor-pointer">
                <input
                  type="checkbox"
                  checked={markBreaking}
                  onChange={(e) => setMarkBreaking(e.target.checked)}
                  className="rounded border-[#D6D1C7] text-[#991B1B] focus:ring-[#991B1B]"
                />
                <span>Feature lead trending dispatch on Breaking News Wire Banner</span>
              </label>

              {publishFeedback && (
                <div
                  role="status"
                  className={`p-4 rounded-md border text-xs space-y-2 ${
                    publishFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  <p className="font-semibold">{publishFeedback.text}</p>
                  {publishFeedback.createdArticles && publishFeedback.createdArticles.length > 0 && (
                    <ul className="space-y-1.5 pt-1 border-t border-[#BBF7D0]/60 dark:border-[#166534]/60">
                      {publishFeedback.createdArticles.map((art) => (
                        <li key={art.id} className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            [{art.category}] {art.title}
                          </span>
                          {onOpenArticleById && (
                            <button
                              type="button"
                              onClick={() => onOpenArticleById(art.id)}
                              className="font-semibold underline underline-offset-2 whitespace-nowrap shrink-0"
                            >
                              Read Now →
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Researching &amp; Publishing Live News…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Fetch &amp; Publish Real Trending News</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'radar' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <div>
                  <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Scout Top 5 Real-Time Headlines ({regionFocus})
                  </p>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                    Pulls current Google Search trending topics across Global, European &amp; Asian wires before publishing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleScanRadar()}
                  disabled={scanningRadar}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  {scanningRadar ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Scanning World Wires…</span>
                    </>
                  ) : (
                    <>
                      <Radar className="w-3.5 h-3.5" />
                      <span>Scan Live Trends Now</span>
                    </>
                  )}
                </button>
              </div>

              {radarError && (
                <p role="alert" className="text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] px-4 py-3 rounded-md">
                  {radarError}
                </p>
              )}

              {radarTopics.length === 0 && !scanningRadar ? (
                <div className="p-8 text-center bg-white dark:bg-[#171715] border border-dashed border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Click <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">Scan Live Trends Now</span> to discover verified breaking developments across the World, Europe, and Asia.
                </div>
              ) : (
                <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
                  {radarTopics.map((topic) => (
                    <div
                      key={topic.id}
                      className="p-4 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">
                            {topic.suggestedCatalog}
                          </span>
                          <span aria-hidden="true" className="text-[#78716C]">·</span>
                          <span className="text-[#57534E] dark:text-[#A8A29E]">{topic.region}</span>
                        </div>
                        <button
                          type="button"
                          disabled={publishingTopicId === topic.id}
                          onClick={() => void handlePublishSingleTopic(topic)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-60 whitespace-nowrap"
                        >
                          {publishingTopicId === topic.id ? 'Publishing…' : 'Publish Full Story'}
                        </button>
                      </div>
                      <h4 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                        {topic.headline}
                      </h4>
                      <p className="text-xs text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
                        {topic.summary}
                      </p>
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                        <span className="font-semibold">Why trending:</span> {topic.whyTrending}
                      </p>
                      {topic.sources.length > 0 && (
                        <div className="flex flex-wrap gap-3 pt-1 text-[11px]">
                          {topic.sources.slice(0, 3).map((src, idx) => (
                            <a
                              key={`${src.uri}-${idx}`}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#991B1B] dark:text-[#F87171] hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span className="truncate max-w-[180px]">{src.title}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'scheduler' && (
            <form onSubmit={handleSaveScheduler} className="space-y-5">
              <div className="p-4 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                      Continuous Autonomous Wire Scheduler
                    </h3>
                    <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                      Automatically searches real trending World, European, and Asian headlines and publishes verified articles on schedule.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={schedEnabled}
                      onChange={(e) => setSchedEnabled(e.target.checked)}
                      className="rounded border-[#D6D1C7] text-[#991B1B] focus:ring-[#991B1B]"
                    />
                    <span>{schedEnabled ? 'Active' : 'Enable Auto-Publish'}</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="sched-interval" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Publishing Cadence
                    </label>
                    <select
                      id="sched-interval"
                      value={schedInterval}
                      onChange={(e) => setSchedInterval(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      <option value={30}>Every 30 Minutes</option>
                      <option value={60}>Every 1 Hour</option>
                      <option value={180}>Every 3 Hours</option>
                      <option value={360}>Every 6 Hours</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sched-region" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Region Priority
                    </label>
                    <select
                      id="sched-region"
                      value={schedRegion}
                      onChange={(e) => setSchedRegion(e.target.value as AiRegionFocus)}
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      {REGION_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sched-catalog" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Target Catalog
                    </label>
                    <select
                      id="sched-catalog"
                      value={schedCatalog}
                      onChange={(e) => setSchedCatalog(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      <option value="auto">Auto-Match Any Catalog</option>
                      {ARTICLE_CATALOGS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {schedulerFeedback && (
                  <p
                    role="status"
                    className={`text-xs font-medium px-3 py-2 rounded-md border ${
                      schedulerFeedback.type === 'success'
                        ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                        : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                    }`}
                  >
                    {schedulerFeedback.text}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingScheduler}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] disabled:opacity-60"
                  >
                    {savingScheduler ? 'Updating…' : 'Save Scheduler Settings'}
                  </button>
                </div>
              </div>

              {/* Recent AI Publications Log */}
              <div className="bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
                <div className="px-4 py-2.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Recent AI Trending Publications
                </div>
                {status && status.recentAiArticles.length > 0 ? (
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-48 overflow-y-auto">
                    {status.recentAiArticles.map((item) => (
                      <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                            {item.title}
                          </p>
                          <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                            {item.category} · {item.regionFocus} · {item.sourceCount} sources
                          </p>
                        </div>
                        {onOpenArticleById && (
                          <button
                            type="button"
                            onClick={() => onOpenArticleById(item.id)}
                            className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] hover:underline whitespace-nowrap shrink-0"
                          >
                            Open →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-6 text-xs text-center text-[#57534E] dark:text-[#A8A29E]">
                    No AI trending dispatches published yet. Use the Publish Trending tab to generate your first grounded story.
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
