import {
  Activity,
  Check,
  CheckCircle2,
  Copy,
  Globe,
  Link2,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Target,
  TrendingUp
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { VideoReelItem } from '../data/newsData';

export type ConnectedVideoPlatform =
  | 'website'
  | 'android_apk'
  | 'base44_app'
  | 'meta_facebook'
  | 'meta_instagram'
  | 'meta_threads'
  | 'meta_whatsapp'
  | 'youtube';

export interface ConnectedPlatformThresholdItem {
  platform: ConnectedVideoPlatform;
  label: string;
  shortLabel: string;
  group: 'meta' | 'owned' | 'social';
  enabled: boolean;
  clicks: number;
  videoViews: number;
  watchSeconds: number;
  watchHours: number;
  estimatedCreatorUsd: number;
  clickThreshold: number;
  watchHoursThreshold: number;
  clickProgressPct: number;
  watchHoursProgressPct: number;
  thresholdReached: boolean;
  connectionStatus: 'native_live' | 'utm_webhook_ready' | 'meta_graph_live';
  handleOrPageId: string;
  lastSyncSource: string;
  lastEventAt: string | null;
  trackingLink: string;
  webhookUrl: string;
  collectedCreatorUsd?: number;
  uncollectedUsd?: number;
}

export interface ThresholdCrossingItem {
  id: string;
  scope: 'platform' | 'global';
  platform: ConnectedVideoPlatform | 'all_connected';
  platformLabel: string;
  metric: 'clicks' | 'watch_hours';
  thresholdValue: number;
  actualValue: number;
  estimatedCreatorUsd: number;
  crossedAt: string;
}

export interface PlatformTelemetryItem {
  id: string;
  platform: ConnectedVideoPlatform;
  platformLabel: string;
  reelId?: string;
  clicksDelta: number;
  viewsDelta: number;
  watchSecondsDelta: number;
  creatorNetUsd: number;
  source: 'site_player' | 'utm_referral' | 'meta_webhook' | 'meta_graph_api' | 'api_ingest';
  sourceLabel: string;
  createdAt: string;
}

export interface RevenueCollectionBatchItem {
  id: string;
  totalCollectedUsd: number;
  platformsSweptCount: number;
  creditedToBalanceUsd: number;
  settledAt: string;
}

export interface PlatformThresholdsResponse {
  platforms: ConnectedPlatformThresholdItem[];
  totals: {
    totalClicks: number;
    totalVideoViews: number;
    totalWatchSeconds: number;
    totalWatchHours: number;
    totalEstimatedCreatorUsd: number;
    totalCollectedAllPlatformsUsd?: number;
    totalUncollectedAllPlatformsUsd?: number;
    globalClickThreshold: number;
    globalWatchHoursThreshold: number;
    platformsMeetingThreshold: number;
    totalConnectedPlatforms: number;
  };
  globalThresholds: {
    clickThreshold: number;
    watchHoursThreshold: number;
    autoNotifyOnCross: boolean;
    autoCreditEligibleClicks: boolean;
    updatedAt: string;
  };
  crossings: ThresholdCrossingItem[];
  recentTelemetry: PlatformTelemetryItem[];
  recentCollections?: RevenueCollectionBatchItem[];
  metaIntegration: {
    metaAppSecretConfigured: boolean;
    metaGraphTokenConfigured: boolean;
    metaPageIdConfigured: boolean;
    metaIgUserIdConfigured: boolean;
    webhookVerifyToken: string;
  };
}

interface PlatformThresholdSectionProps {
  data: PlatformThresholdsResponse | null;
  reels: VideoReelItem[];
  onDataUpdated: (payload: {
    platformThresholds: PlatformThresholdsResponse;
    revenueEngine?: unknown;
    monetizationSummary?: unknown;
    ownerPayouts?: unknown;
  }) => void;
}

type GroupFilter = 'all' | 'meta' | 'owned_social';

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function PlatformThresholdSection({
  data,
  reels,
  onDataUpdated
}: PlatformThresholdSectionProps) {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [showGlobalEditor, setShowGlobalEditor] = useState<boolean>(false);
  const [editingPlatform, setEditingPlatform] = useState<ConnectedVideoPlatform | null>(null);
  const [logTab, setLogTab] = useState<'crossings' | 'telemetry'>('crossings');

  // Global config form state
  const [globalClickInput, setGlobalClickInput] = useState<string>('15000');
  const [globalWatchHoursInput, setGlobalWatchHoursInput] = useState<string>('120');
  const [autoNotify, setAutoNotify] = useState<boolean>(true);
  const [autoCredit, setAutoCredit] = useState<boolean>(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Per-platform edit form state
  const [platClickInput, setPlatClickInput] = useState<string>('250');
  const [platWatchInput, setPlatWatchInput] = useState<string>('10');
  const [platHandleInput, setPlatHandleInput] = useState<string>('');
  const [platEnabled, setPlatEnabled] = useState<boolean>(true);

  // Ingest telemetry form state
  const [ingestPlatform, setIngestPlatform] = useState<ConnectedVideoPlatform>('meta_facebook');
  const [ingestReelId, setIngestReelId] = useState<string>(reels[0]?.id ?? '');
  const [ingestClicks, setIngestClicks] = useState<string>('50');
  const [ingestWatchHours, setIngestWatchHours] = useState<string>('1.5');
  const [ingestViews, setIngestViews] = useState<string>('400');
  const [ingestNote, setIngestNote] = useState<string>('');
  const [ingesting, setIngesting] = useState<boolean>(false);

  // Meta Graph sync + Collect Revenue + general feedback
  const [syncingMeta, setSyncingMeta] = useState<boolean>(false);
  const [collectingRevenue, setCollectingRevenue] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.globalThresholds) return;
    setGlobalClickInput(String(data.globalThresholds.clickThreshold));
    setGlobalWatchHoursInput(String(data.globalThresholds.watchHoursThreshold));
    setAutoNotify(data.globalThresholds.autoNotifyOnCross);
    setAutoCredit(data.globalThresholds.autoCreditEligibleClicks);
  }, [data?.globalThresholds]);

  useEffect(() => {
    if (!ingestReelId && reels.length > 0) {
      setIngestReelId(reels[0].id);
    }
  }, [reels, ingestReelId]);

  const platforms = data?.platforms ?? [];
  const totals = data?.totals ?? {
    totalClicks: 0,
    totalVideoViews: 0,
    totalWatchSeconds: 0,
    totalWatchHours: 0,
    totalEstimatedCreatorUsd: 0,
    globalClickThreshold: 15000,
    globalWatchHoursThreshold: 120,
    platformsMeetingThreshold: 0,
    totalConnectedPlatforms: 8
  };

  const filteredPlatforms = platforms.filter((p) => {
    if (groupFilter === 'meta') return p.group === 'meta';
    if (groupFilter === 'owned_social') return p.group !== 'meta';
    return true;
  });

  const globalClickPct =
    totals.globalClickThreshold > 0
      ? Math.min(100, Math.round((totals.totalClicks / totals.globalClickThreshold) * 100))
      : 100;
  const globalWatchPct =
    totals.globalWatchHoursThreshold > 0
      ? Math.min(100, Math.round((totals.totalWatchHours / totals.globalWatchHoursThreshold) * 100))
      : 100;

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  const openPlatformEditor = (item: ConnectedPlatformThresholdItem) => {
    setEditingPlatform(item.platform);
    setPlatClickInput(String(item.clickThreshold));
    setPlatWatchInput(String(item.watchHoursThreshold));
    setPlatHandleInput(item.handleOrPageId);
    setPlatEnabled(item.enabled);
    setFeedback(null);
  };

  const handleSaveGlobalThresholds = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const clickVal = Number(globalClickInput);
    const watchVal = Number(globalWatchHoursInput);
    if (!Number.isFinite(clickVal) || clickVal < 1 || !Number.isFinite(watchVal) || watchVal < 0.1) {
      setFeedback({
        type: 'error',
        text: 'Enter a valid global click threshold (>= 1) and watch-hours threshold (>= 0.1h).'
      });
      return;
    }

    setSavingConfig(true);
    try {
      const res = await fetch('/api/platform-thresholds/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globalThresholds: {
            clickThreshold: clickVal,
            watchHoursThreshold: watchVal,
            autoNotifyOnCross: autoNotify,
            autoCreditEligibleClicks: autoCredit
          }
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to save global thresholds.');
      onDataUpdated({ platformThresholds: payload as PlatformThresholdsResponse });
      setShowGlobalEditor(false);
      setFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save global thresholds.'
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSavePlatformRule = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPlatform) return;
    setFeedback(null);
    const clickVal = Number(platClickInput);
    const watchVal = Number(platWatchInput);
    if (!Number.isFinite(clickVal) || clickVal < 1 || !Number.isFinite(watchVal) || watchVal < 0.1) {
      setFeedback({
        type: 'error',
        text: 'Enter valid per-platform thresholds (clicks >= 1 and watch hours >= 0.1h).'
      });
      return;
    }

    setSavingConfig(true);
    try {
      const res = await fetch('/api/platform-thresholds/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformUpdate: {
            platform: editingPlatform,
            enabled: platEnabled,
            clickThreshold: clickVal,
            watchHoursThreshold: watchVal,
            handleOrPageId: platHandleInput
          }
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to update platform threshold.');
      onDataUpdated({ platformThresholds: payload as PlatformThresholdsResponse });
      setEditingPlatform(null);
      setFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update platform rule.'
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleIngestTelemetry = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const clicks = Number(ingestClicks) || 0;
    const watchHours = Number(ingestWatchHours) || 0;
    const views = Number(ingestViews) || 0;

    if (clicks <= 0 && watchHours <= 0 && views <= 0) {
      setFeedback({
        type: 'error',
        text: 'Enter at least 1 click, qualified view, or watch-time hour to gather.'
      });
      return;
    }

    setIngesting(true);
    try {
      const res = await fetch('/api/platform-thresholds/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: ingestPlatform,
          reelId: ingestReelId || undefined,
          clicksDelta: clicks,
          watchHoursDelta: watchHours,
          viewsDelta: views,
          sourceLabel: ingestNote.trim() || undefined
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Telemetry ingestion failed.');
      onDataUpdated({
        platformThresholds: payload.platformThresholds,
        revenueEngine: payload.revenueEngine,
        monetizationSummary: payload.monetizationSummary,
        ownerPayouts: payload.ownerPayouts
      });
      setIngestNote('');
      setFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to gather platform telemetry.'
      });
    } finally {
      setIngesting(false);
    }
  };

  const handleSyncMetaGraph = async () => {
    setFeedback(null);
    setSyncingMeta(true);
    try {
      const res = await fetch('/api/platform-thresholds/sync-meta', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Meta Graph API credentials not configured.');
      }
      onDataUpdated({
        platformThresholds: payload.platformThresholds,
        revenueEngine: payload.revenueEngine,
        monetizationSummary: payload.monetizationSummary
      });
      setFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to sync Meta Graph insights.'
      });
    } finally {
      setSyncingMeta(false);
    }
  };

  const handleCollectAllPlatformRevenue = async () => {
    setFeedback(null);
    setCollectingRevenue(true);
    try {
      const res = await fetch('/api/platform-thresholds/collect-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not collect connected-platform revenue.');
      }
      if (payload.platformThresholds) {
        onDataUpdated({
          platformThresholds: payload.platformThresholds,
          revenueEngine: payload.revenueEngine,
          monetizationSummary: payload.monetizationSummary,
          ownerPayouts: payload.ownerPayouts
        });
      }
      setFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to collect revenue right now.'
      });
    } finally {
      setCollectingRevenue(false);
    }
  };

  const webhookUrl =
    platforms[0]?.webhookUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/meta-video`
      : '/api/webhooks/meta-video');

  return (
    <section
      id="platform-thresholds"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-white dark:bg-[#111110]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-16 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#991B1B] dark:text-[#F87171] mb-2">
              Connected Platforms &amp; Meta Apps Threshold Engine
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE]">
              Multi-Platform Video Clicks &amp; Watch-Time Hours Thresholds
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] mt-2 leading-relaxed">
              Automatically gathers video clicks, 3s+ qualified views, and watch-time hours across Meta apps (Facebook Reels, Instagram Reels, Threads, WhatsApp Channels), Website, Android APK, Base44 App, and YouTube—triggering real-time SSE alerts and creator earnings whenever configured thresholds are reached.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleCollectAllPlatformRevenue()}
              disabled={collectingRevenue}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] dark:bg-[#059669] dark:hover:bg-[#047857] rounded-md transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                {collectingRevenue
                  ? 'Collecting Revenue…'
                  : `Collect All Platforms ($${(totals.totalUncollectedAllPlatformsUsd ?? 0).toFixed(2)})`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowGlobalEditor((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] hover:border-[#991B1B] whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
              <span>Global Threshold Rules</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSyncMetaGraph()}
              disabled={syncingMeta}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingMeta ? 'animate-spin' : ''}`} />
              <span>{syncingMeta ? 'Syncing Meta Graph…' : 'Sync Meta Graph Insights'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            role="status"
            className={`p-3.5 rounded-md border text-xs flex items-start justify-between gap-3 ${
              feedback.type === 'success'
                ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/30 border-[#A7F3D0] dark:border-[#065F46] text-[#065F46] dark:text-[#34D399]'
                : 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border-[#FECACA] dark:border-[#991B1B] text-[#991B1B] dark:text-[#FCA5A5]'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="font-mono text-[11px] underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Global Threshold Editor Drawer */}
        {showGlobalEditor && (
          <form
            onSubmit={handleSaveGlobalThresholds}
            className="p-5 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                Global Cross-Platform Threshold Configuration
              </h3>
              <button
                type="button"
                onClick={() => setShowGlobalEditor(false)}
                className="text-xs font-mono text-[#57534E] hover:text-[#141413] dark:hover:text-[#F5F3EE]"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="global-click-threshold"
                  className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
                >
                  Global Video Clicks Target
                </label>
                <input
                  id="global-click-threshold"
                  type="number"
                  min={1}
                  step={1}
                  value={globalClickInput}
                  onChange={(e) => setGlobalClickInput(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>
              <div>
                <label
                  htmlFor="global-watch-threshold"
                  className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
                >
                  Global Watch-Time Hours Target
                </label>
                <input
                  id="global-watch-threshold"
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={globalWatchHoursInput}
                  onChange={(e) => setGlobalWatchHoursInput(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>
              <label className="flex items-start gap-2 text-xs pt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoNotify}
                  onChange={(e) => setAutoNotify(e.target.checked)}
                  className="mt-0.5 accent-[#991B1B]"
                />
                <span className="text-[#44403C] dark:text-[#D6D3CD]">
                  <strong className="block text-[#141413] dark:text-[#F5F3EE]">Live SSE Alert on Cross</strong>
                  Send instant alert to Creator Notification Center
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs pt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCredit}
                  onChange={(e) => setAutoCredit(e.target.checked)}
                  className="mt-0.5 accent-[#991B1B]"
                />
                <span className="text-[#44403C] dark:text-[#D6D3CD]">
                  <strong className="block text-[#141413] dark:text-[#F5F3EE]">Auto-Credit Creator Ledger</strong>
                  Credit 70% CPC &amp; Watch-Hour USD on ingest
                </span>
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md disabled:opacity-50"
              >
                {savingConfig ? 'Saving…' : 'Save Global Thresholds'}
              </button>
            </div>
          </form>
        )}

        {/* 4-Column Threshold KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
              <span>Combined Video Clicks</span>
              <span className="font-mono tabular-nums">{globalClickPct}%</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                {totals.totalClicks.toLocaleString()}
              </span>
              <span className="font-mono text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                / {totals.globalClickThreshold.toLocaleString()}
              </span>
            </div>
            <svg viewBox="0 0 100 4" className="w-full h-1.5 mt-2.5 rounded overflow-hidden" aria-hidden="true">
              <rect x="0" y="0" width="100" height="4" className="fill-[#E5E2DC] dark:fill-[#2C2A26]" />
              <rect x="0" y="0" width={globalClickPct} height="4" className="fill-[#991B1B] dark:fill-[#DC2626]" />
            </svg>
          </div>

          <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
              <span>Combined Watch Hours</span>
              <span className="font-mono tabular-nums">{globalWatchPct}%</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                {totals.totalWatchHours.toLocaleString()} hrs
              </span>
              <span className="font-mono text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                / {totals.globalWatchHoursThreshold.toLocaleString()}h
              </span>
            </div>
            <svg viewBox="0 0 100 4" className="w-full h-1.5 mt-2.5 rounded overflow-hidden" aria-hidden="true">
              <rect x="0" y="0" width="100" height="4" className="fill-[#E5E2DC] dark:fill-[#2C2A26]" />
              <rect x="0" y="0" width={globalWatchPct} height="4" className="fill-[#065F46] dark:fill-[#34D399]" />
            </svg>
          </div>

          <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
              <span>Thresholds Qualified</span>
              <Target className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
            </div>
            <div className="mt-1 font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {totals.platformsMeetingThreshold} / {totals.totalConnectedPlatforms}
            </div>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-2">
              {totals.totalVideoViews.toLocaleString()} qualified 3s+ views gathered
            </p>
          </div>

          <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
              <span>Gathered Creator Net (70%)</span>
              <TrendingUp className="w-3.5 h-3.5 text-[#065F46] dark:text-[#34D399]" />
            </div>
            <div className="mt-1 font-serif text-2xl font-bold text-[#065F46] dark:text-[#34D399] tabular-nums">
              ${totals.totalEstimatedCreatorUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-mono text-[#78716C] dark:text-[#A8A29E] mt-2 tabular-nums">
              Collected: ${(totals.totalCollectedAllPlatformsUsd ?? 0).toFixed(2)} · Ready: ${(totals.totalUncollectedAllPlatformsUsd ?? 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Connected Platforms Filter & Matrix */}
        <div className="bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
          <div className="px-5 py-3.5 bg-white dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
              <h3 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                Connected Platforms Video Telemetry &amp; Threshold Matrix
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: 'all', label: `All Platforms (${platforms.length || 8})` },
                  { key: 'meta', label: 'Meta Apps (Facebook, IG, Threads, WhatsApp)' },
                  { key: 'owned_social', label: 'Website, APK, Base44 & YouTube' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setGroupFilter(tab.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                    groupFilter === tab.key
                      ? 'bg-[#141413] dark:bg-[#F5F3EE] text-white dark:text-[#141413] border-[#141413] dark:border-[#F5F3EE]'
                      : 'bg-[#FBF9F5] dark:bg-[#141413] text-[#44403C] dark:text-[#D6D3CD] border-[#E5E2DC] dark:border-[#2C2A26]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E2DC] dark:border-[#2C2A26] text-[#57534E] dark:text-[#A8A29E] bg-[#F5F2EB]/60 dark:bg-[#141413]/60">
                  <th className="py-3 px-4 font-semibold">Connected Platform</th>
                  <th className="py-3 px-4 font-semibold">Connection &amp; Handle</th>
                  <th className="py-3 px-4 font-semibold min-w-[160px]">Clicks vs Threshold</th>
                  <th className="py-3 px-4 font-semibold min-w-[160px]">Watch Hours vs Target</th>
                  <th className="py-3 px-4 font-semibold text-right">Creator Net</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                {filteredPlatforms.map((item) => (
                  <tr
                    key={item.platform}
                    className={`bg-white dark:bg-[#171715] ${!item.enabled ? 'opacity-55' : ''}`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                        {item.label}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded border ${
                            item.thresholdReached
                              ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#065F46] dark:text-[#34D399] border-[#A7F3D0] dark:border-[#065F46]'
                              : 'bg-[#F5F2EB] dark:bg-[#1C1B19] text-[#57534E] dark:text-[#A8A29E] border-[#E5E2DC] dark:border-[#2C2A26]'
                          }`}
                        >
                          {item.thresholdReached ? 'THRESHOLD MET' : item.enabled ? 'GATHERING' : 'PAUSED'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[#141413] dark:text-[#F5F3EE]">
                        {item.handleOrPageId}
                      </div>
                      <div className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                        {item.connectionStatus === 'native_live'
                          ? 'Native Live Stream'
                          : item.connectionStatus === 'meta_graph_live'
                            ? 'Meta Graph API Live'
                            : 'UTM Link & Webhook Ready'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                        <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          {item.clicks.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                          / {item.clickThreshold.toLocaleString()} ({item.clickProgressPct}%)
                        </span>
                      </div>
                      <svg viewBox="0 0 100 3" className="w-full h-1.5 mt-1.5 rounded overflow-hidden" aria-hidden="true">
                        <rect x="0" y="0" width="100" height="3" className="fill-[#E5E2DC] dark:fill-[#2C2A26]" />
                        <rect
                          x="0"
                          y="0"
                          width={item.clickProgressPct}
                          height="3"
                          className={
                            item.clickProgressPct >= 100
                              ? 'fill-[#065F46] dark:fill-[#34D399]'
                              : 'fill-[#991B1B] dark:fill-[#DC2626]'
                          }
                        />
                      </svg>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                        <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          {item.watchHours.toFixed(2)}h
                        </span>
                        <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                          / {item.watchHoursThreshold.toFixed(1)}h ({item.watchHoursProgressPct}%)
                        </span>
                      </div>
                      <svg viewBox="0 0 100 3" className="w-full h-1.5 mt-1.5 rounded overflow-hidden" aria-hidden="true">
                        <rect x="0" y="0" width="100" height="3" className="fill-[#E5E2DC] dark:fill-[#2C2A26]" />
                        <rect
                          x="0"
                          y="0"
                          width={item.watchHoursProgressPct}
                          height="3"
                          className={
                            item.watchHoursProgressPct >= 100
                              ? 'fill-[#065F46] dark:fill-[#34D399]'
                              : 'fill-[#141413] dark:fill-[#D6D3CD]'
                          }
                        />
                      </svg>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-[#065F46] dark:text-[#34D399]">
                      ${item.estimatedCreatorUsd.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleCopy(`utm:${item.platform}`, item.trackingLink)}
                          title="Copy Attribution Link to post in Meta Reels / Bio / Channel"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE] hover:border-[#991B1B]"
                        >
                          {copiedKey === `utm:${item.platform}` ? (
                            <>
                              <Check className="w-3 h-3 text-[#065F46]" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Link2 className="w-3 h-3" />
                              UTM Link
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openPlatformEditor(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE] hover:border-[#991B1B]"
                        >
                          <Settings2 className="w-3 h-3" />
                          Rule
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Inline Per-Platform Threshold Rule Editor */}
          {editingPlatform && (
            <form
              onSubmit={handleSavePlatformRule}
              className="p-4 sm:p-5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-t border-[#E5E2DC] dark:border-[#2C2A26] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Editing Platform
                </label>
                <div className="mt-1 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE]">
                  {platforms.find((p) => p.platform === editingPlatform)?.shortLabel}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Page / Channel Handle
                </label>
                <input
                  type="text"
                  value={platHandleInput}
                  onChange={(e) => setPlatHandleInput(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Click Threshold
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={platClickInput}
                  onChange={(e) => setPlatClickInput(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Watch Hours Threshold
                </label>
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={platWatchInput}
                  onChange={(e) => setPlatWatchInput(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={platEnabled}
                    onChange={(e) => setPlatEnabled(e.target.checked)}
                    className="accent-[#991B1B]"
                  />
                  <span>Active</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingPlatform(null)}
                    className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#991B1B] text-white rounded disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Bottom 2 Columns: Gather / Ingest Form & Webhook Setup + Crossing Log */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 6 Cols: Telemetry Gatherer & Meta Webhook Details */}
          <div className="lg:col-span-6 p-5 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-5">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                Gather Platform Video Clicks &amp; Watch Hours
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
                Ingest video engagement metrics reported by Meta Business Suite, Instagram Insights, Threads, WhatsApp Channels, or connected apps—or push automated batches to the webhook below.
              </p>
            </div>

            <form onSubmit={handleIngestTelemetry} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ingest-platform"
                    className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
                  >
                    Connected Platform
                  </label>
                  <select
                    id="ingest-platform"
                    value={ingestPlatform}
                    onChange={(e) => setIngestPlatform(e.target.value as ConnectedVideoPlatform)}
                    className="mt-1 w-full px-3 py-2 text-xs bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    {platforms.map((p) => (
                      <option key={p.platform} value={p.platform}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ingest-reel"
                    className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
                  >
                    Linked Video Reel (Optional)
                  </label>
                  <select
                    id="ingest-reel"
                    value={ingestReelId}
                    onChange={(e) => setIngestReelId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    <option value="">All Platform Videos</option>
                    {reels.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title.slice(0, 48)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="ingest-clicks"
                    className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
                  >
                    Per Clicks
                  </label>
                  <input
                    id="ingest-clicks"
                    type="number"
                    min={0}
                    step={1}
                    value={ingestClicks}
                    onChange={(e) => setIngestClicks(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ingest-watch-hours"
                    className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
                  >
                    Watch Hours
                  </label>
                  <input
                    id="ingest-watch-hours"
                    type="number"
                    min={0}
                    step={0.25}
                    value={ingestWatchHours}
                    onChange={(e) => setIngestWatchHours(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ingest-views"
                    className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
                  >
                    3s+ Views
                  </label>
                  <input
                    id="ingest-views"
                    type="number"
                    min={0}
                    step={1}
                    value={ingestViews}
                    onChange={(e) => setIngestViews(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ingest-note"
                  className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
                >
                  Campaign / Batch Label
                </label>
                <input
                  id="ingest-note"
                  type="text"
                  value={ingestNote}
                  onChange={(e) => setIngestNote(e.target.value)}
                  placeholder="e.g. Meta Reels Morning Dispatch Insights"
                  className="mt-1 w-full px-3 py-2 text-xs bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <button
                type="submit"
                disabled={ingesting}
                className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#141413] hover:bg-[#292524] dark:bg-[#F5F3EE] dark:text-[#141413] dark:hover:bg-[#E5E2DC] rounded-md transition-colors disabled:opacity-50"
              >
                {ingesting ? 'Gathering & Evaluating Thresholds…' : 'Gather Clicks & Watch Hours into Threshold System'}
              </button>
            </form>

            {/* Meta Webhook Endpoint Box */}
            <div className="p-3.5 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Meta Webhooks Callback Endpoint
                </span>
                <span className="font-mono text-[11px] text-[#065F46] dark:text-[#34D399]">
                  {data?.metaIntegration.metaAppSecretConfigured ? 'HMAC Verified' : 'Verify Token Ready'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2 bg-[#FBF9F5] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded">
                <code className="font-mono text-[11px] text-[#44403C] dark:text-[#D6D3CD] truncate">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopy('webhook-url', webhookUrl)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded shrink-0"
                >
                  {copiedKey === 'webhook-url' ? <Check className="w-3 h-3 text-[#065F46]" /> : <Copy className="w-3 h-3" />}
                  Copy
                </button>
              </div>
              <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                Verify Token: {data?.metaIntegration.webhookVerifyToken ?? 'nh24-meta-video-verify-2026'}
              </p>
            </div>
          </div>

          {/* Right 6 Cols: Threshold Crossings & Live Telemetry Log */}
          <div className="lg:col-span-6 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
            <div className="px-5 py-3.5 bg-white dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                <h3 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Threshold Crossings &amp; Telemetry Stream
                </h3>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLogTab('crossings')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded border ${
                    logTab === 'crossings'
                      ? 'bg-[#991B1B] dark:bg-[#DC2626] text-white border-[#991B1B] dark:border-[#DC2626]'
                      : 'bg-[#FBF9F5] dark:bg-[#141413] text-[#44403C] dark:text-[#D6D3CD] border-[#E5E2DC] dark:border-[#2C2A26]'
                  }`}
                >
                  Crossings ({data?.crossings.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setLogTab('telemetry')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded border ${
                    logTab === 'telemetry'
                      ? 'bg-[#991B1B] dark:bg-[#DC2626] text-white border-[#991B1B] dark:border-[#DC2626]'
                      : 'bg-[#FBF9F5] dark:bg-[#141413] text-[#44403C] dark:text-[#D6D3CD] border-[#E5E2DC] dark:border-[#2C2A26]'
                  }`}
                >
                  Telemetry ({data?.recentTelemetry.length ?? 0})
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-[28rem] overflow-y-auto bg-white dark:bg-[#171715]">
              {logTab === 'crossings' ? (
                (data?.crossings.length ?? 0) === 0 ? (
                  <div className="p-8 text-center text-xs text-[#57534E] dark:text-[#A8A29E]">
                    <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-[#78716C]" />
                    No thresholds crossed yet. Gather clicks or watch-time hours from Meta apps, Website, APK, or Base44 to trigger automated threshold milestones.
                  </div>
                ) : (
                  data!.crossings.map((evt) => (
                    <div key={evt.id} className="px-5 py-3.5 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                          <span className="px-1.5 py-0.5 rounded bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#065F46] dark:text-[#34D399] font-semibold">
                            {evt.metric === 'clicks' ? 'CLICKS THRESHOLD' : 'WATCH HOURS THRESHOLD'}
                          </span>
                          <span className="text-[#78716C] dark:text-[#A8A29E]">
                            {formatShortTime(evt.crossedAt)}
                          </span>
                        </div>
                        <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] mt-1">
                          {evt.platformLabel} reached{' '}
                          {evt.metric === 'clicks'
                            ? `${evt.actualValue.toLocaleString()} clicks`
                            : `${evt.actualValue.toFixed(2)} watch hrs`}
                        </p>
                        <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                          Target: {evt.thresholdValue.toLocaleString()} · {evt.id}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-[#065F46] dark:text-[#34D399] tabular-nums shrink-0">
                        ${evt.estimatedCreatorUsd.toFixed(2)}
                      </span>
                    </div>
                  ))
                )
              ) : (data?.recentTelemetry.length ?? 0) === 0 ? (
                <div className="p-8 text-center text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Play any reel, click any UTM link from Facebook/Instagram/Threads/WhatsApp, or ingest platform metrics to see live telemetry here.
                </div>
              ) : (
                data!.recentTelemetry.map((tel) => (
                  <div key={tel.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                        {tel.platformLabel} — {tel.sourceLabel}
                      </p>
                      <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-0.5 tabular-nums">
                        +{tel.clicksDelta} clicks · +{(tel.watchSecondsDelta / 3600).toFixed(2)}h watch · +{tel.viewsDelta} views · {formatShortTime(tel.createdAt)}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-[#065F46] dark:text-[#34D399] tabular-nums shrink-0">
                      +${tel.creatorNetUsd.toFixed(4)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
