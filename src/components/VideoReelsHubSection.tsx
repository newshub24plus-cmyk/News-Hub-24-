import {
  ArrowUpRight,
  CheckCircle2,
  Coins,
  Eye,
  Film,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Smartphone,
  Trash2,
  UploadCloud,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EDITORIAL_IMAGES } from '../data/clientAssets';
import type { ImageKey, NewsArticle, VideoReelItem } from '../data/newsData';
import type { PayoutConfig } from './MonetizationSection';

export type RevenueChannel = 'website' | 'android_apk' | 'base44_app';

export interface RevenueChannelMetric {
  channel: RevenueChannel;
  label: string;
  clicks: number;
  videoViews: number;
  watchSeconds: number;
  grossUsd: number;
  creatorNetUsd: number;
}

export interface ReelPerformance extends VideoReelItem {
  views: number;
  watchSeconds: number;
  clicks: number;
  earnedUsd: number;
}

export interface RevenueEventItem {
  id: string;
  eventType:
    | 'click_article'
    | 'click_ad'
    | 'click_app'
    | 'video_qualified'
    | 'video_watch'
    | 'video_instream_ad'
    | 'withdrawal'
    | 'reversal';
  platform: RevenueChannel;
  sourceLabel: string;
  grossUsd: number;
  creatorNetUsd: number;
  createdAt: string;
}

export interface RevenueEngineResponse {
  rates: {
    webClickCpc: number;
    appClickCpc: number;
    adClickCpc: number;
    videoQualifiedRpm: number;
    videoQualifiedViewUsd: number;
    watchSlice5sUsd: number;
    inStreamAdBonusUsd: number;
    creatorSharePercent: number;
  };
  totals: {
    totalClicks: number;
    totalVideoViews: number;
    totalWatchHours: number;
    totalGrossUsd: number;
    totalCreatorNetUsd: number;
    pendingPayoutUsd: number;
    totalPaidOutUsd: number;
  };
  channels: RevenueChannelMetric[];
  reels: ReelPerformance[];
  recentEvents: RevenueEventItem[];
  payoutConfig: PayoutConfig;
}

interface VideoReelsHubSectionProps {
  data: RevenueEngineResponse | null;
  articles: NewsArticle[];
  onRecordClick: (
    sourceType: 'article' | 'ad_link' | 'app_apk',
    platform: RevenueChannel,
    targetId?: string,
    targetLabel?: string
  ) => Promise<RevenueEventItem | null>;
  onRecordVideoWatch: (
    reelId: string,
    platform: RevenueChannel,
    secondsDelta: number,
    milestone: 'qualified_view' | 'watch_slice' | 'instream_ad_complete'
  ) => Promise<RevenueEventItem | null>;
  onWithdrawSuccess: (payload: {
    withdrawalId: string;
    amountUsd: number;
    message: string;
    revenueEngine: RevenueEngineResponse;
    ownerPayouts?: unknown;
    rewards?: unknown;
    monetizationSummary?: unknown;
  }) => void;
  onOpenArticle: (article: NewsArticle) => void;
  onOpenUploadModal: () => void;
  onDeleteUploadedVideo: (videoId: string) => void;
  featuredReelId?: string | null;
}

const CHANNEL_LABELS: Record<RevenueChannel, string> = {
  website: 'News Hub 24+.com Web',
  android_apk: 'Android APK App',
  base44_app: 'Base44 Official App'
};

function formatClock(sec: number): string {
  const whole = Math.max(0, Math.floor(sec));
  const mins = Math.floor(whole / 60);
  const rem = whole % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export function VideoReelsHubSection({
  data,
  articles,
  onRecordClick,
  onRecordVideoWatch,
  onWithdrawSuccess,
  onOpenArticle,
  onOpenUploadModal,
  onDeleteUploadedVideo,
  featuredReelId
}: VideoReelsHubSectionProps) {
  const reels = data?.reels ?? [];
  const [selectedReelId, setSelectedReelId] = useState<string>('reel-001');
  const [activePlatform, setActivePlatform] = useState<RevenueChannel>('website');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [qualifiedFiredForReel, setQualifiedFiredForReel] = useState<boolean>(false);
  const [adBonusFiredForReel, setAdBonusFiredForReel] = useState<boolean>(false);
  const [lastSliceSec, setLastSliceSec] = useState<number>(0);
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const imageCacheRef = useRef<Partial<Record<ImageKey, HTMLImageElement>>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);

  const activeReel = useMemo(() => {
    if (reels.length === 0) return null;
    return reels.find((r) => r.id === selectedReelId) ?? reels[0];
  }, [reels, selectedReelId]);

  const linkedArticle = useMemo(() => {
    if (!activeReel) return undefined;
    return articles.find((a) => a.id === activeReel.linkedArticleId);
  }, [articles, activeReel]);

  // Focus newly uploaded video in player automatically
  useEffect(() => {
    if (featuredReelId) {
      setSelectedReelId(featuredReelId);
      setElapsedSec(0);
      setQualifiedFiredForReel(false);
      setAdBonusFiredForReel(false);
      setLastSliceSec(0);
      setStatusNote(null);
      setIsPlaying(false);
    }
  }, [featuredReelId]);

  // Preload reel backdrop images safely from local assets
  useEffect(() => {
    (Object.keys(EDITORIAL_IMAGES) as ImageKey[]).forEach((key) => {
      if (!imageCacheRef.current[key]) {
        const img = new Image();
        img.src = EDITORIAL_IMAGES[key];
        imageCacheRef.current[key] = img;
      }
    });
  }, []);

  // Reset per-reel milestone trackers cleanly when switching reels
  const selectReel = (reelId: string, autoPlay = false) => {
    setSelectedReelId(reelId);
    setElapsedSec(0);
    setQualifiedFiredForReel(false);
    setAdBonusFiredForReel(false);
    setLastSliceSec(0);
    setStatusNote(null);
    setIsPlaying(autoPlay);
  };

  // Sync Play/Pause state for uploaded native HTML5 <video> streams
  useEffect(() => {
    const vid = videoElRef.current;
    if (!vid || !activeReel?.videoUrl) return;
    if (isPlaying) {
      void vid.play().catch(() => {
        // Autoplay restriction handled cleanly
      });
    } else {
      vid.pause();
    }
  }, [isPlaying, activeReel]);

  // Smooth playback timer for studio canvas reels (native <video> updates elapsedSec via onTimeUpdate)
  useEffect(() => {
    if (!isPlaying || !activeReel || activeReel.videoUrl) return;

    const interval = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = Number((prev + 0.25).toFixed(2));
        if (next >= activeReel.durationSec) {
          setIsPlaying(false);
          return activeReel.durationSec;
        }
        return next;
      });
    }, 250);

    return () => window.clearInterval(interval);
  }, [isPlaying, activeReel]);

  // Dispatch server revenue events when watch milestones cross 3s, +5s, 12s
  useEffect(() => {
    if (!isPlaying || !activeReel) return;

    if (!qualifiedFiredForReel && elapsedSec >= 3) {
      setQualifiedFiredForReel(true);
      setLastSliceSec(3);
      onRecordVideoWatch(activeReel.id, activePlatform, 3, 'qualified_view').then((evt) => {
        if (evt) {
          setStatusNote(
            `3s Qualified View credited via ${CHANNEL_LABELS[activePlatform]} (+$${evt.creatorNetUsd.toFixed(4)} net)`
          );
        }
      });
      return;
    }

    if (!adBonusFiredForReel && elapsedSec >= 12) {
      setAdBonusFiredForReel(true);
      setLastSliceSec(12);
      onRecordVideoWatch(activeReel.id, activePlatform, 4, 'instream_ad_complete').then((evt) => {
        if (evt) {
          setStatusNote(
            `12s In-Stream Ad bonus credited via ${CHANNEL_LABELS[activePlatform]} (+$${evt.creatorNetUsd.toFixed(4)} net)`
          );
        }
      });
      return;
    }

    if (qualifiedFiredForReel && elapsedSec - lastSliceSec >= 5) {
      const sliceStep = Math.floor(elapsedSec);
      setLastSliceSec(sliceStep);
      onRecordVideoWatch(activeReel.id, activePlatform, 5, 'watch_slice').then((evt) => {
        if (evt) {
          setStatusNote(
            `+5s Watch-Time slice credited (+$${evt.creatorNetUsd.toFixed(4)} net)`
          );
        }
      });
    }
  }, [
    elapsedSec,
    isPlaying,
    activeReel,
    activePlatform,
    qualifiedFiredForReel,
    adBonusFiredForReel,
    lastSliceSec,
    onRecordVideoWatch
  ]);

  // Gentle optional studio pulse tone when unmuted
  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      if (!nextMuted) {
        try {
          const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctx) {
            if (!audioCtxRef.current) {
              audioCtxRef.current = new Ctx();
            }
            const ctx = audioCtxRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 528;
            gain.gain.setValueAtTime(0.015, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.18);
          }
        } catch {
          // AudioContext unavailable cleanly ignored
        }
      }
      return nextMuted;
    });
  };

  // Render live kinetic broadcast video frame onto HTML5 canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeReel) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const drawFrame = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const img = imageCacheRef.current[activeReel.imageKey];
      const progress = activeReel.durationSec > 0 ? elapsedSec / activeReel.durationSec : 0;

      // Background dark slate
      ctx.fillStyle = '#141413';
      ctx.fillRect(0, 0, w, h);

      if (img && img.complete && img.naturalWidth > 0) {
        const zoom = 1.04 + progress * 0.12;
        const panX = (progress - 0.5) * 32;
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = w / h;

        let drawW = w * zoom;
        let drawH = h * zoom;
        if (imgAspect > canvasAspect) {
          drawH = h * zoom;
          drawW = drawH * imgAspect;
        } else {
          drawW = w * zoom;
          drawH = drawW / imgAspect;
        }

        const dx = (w - drawW) / 2 - panX;
        const dy = (h - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      }

      // Broadcast vignette gradient for clear readability
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(13, 13, 12, 0.55)');
      grad.addColorStop(0.45, 'rgba(13, 13, 12, 0.15)');
      grad.addColorStop(1, 'rgba(13, 13, 12, 0.92)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Top-left live broadcast indicator
      ctx.fillStyle = isPlaying ? '#991B1B' : '#292524';
      ctx.fillRect(28, 24, isPlaying ? 154 : 138, 30);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(isPlaying ? '● ON AIR · REEL' : '❚❚ PAUSED · REEL', 40, 44);

      // Top-right channel + RPM telemetry badge
      ctx.fillStyle = 'rgba(20, 20, 19, 0.85)';
      ctx.fillRect(w - 270, 24, 242, 30);
      ctx.fillStyle = '#E5E2DC';
      ctx.font = '500 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`${CHANNEL_LABELS[activePlatform]} · $4.50 RPM`, w - 256, 43);

      // Animated audio level bars when playing
      const barCount = 12;
      const baseBarX = 28;
      const baseBarY = h - 140;
      for (let i = 0; i < barCount; i += 1) {
        const pulse = isPlaying
          ? 8 + Math.abs(Math.sin(elapsedSec * 7 + i * 0.9)) * 22
          : 6;
        ctx.fillStyle = i < 9 ? '#DC2626' : '#FBBF24';
        ctx.fillRect(baseBarX + i * 7, baseBarY - pulse, 4, pulse);
      }

      // Lower-third editorial headline + caption
      ctx.fillStyle = '#F87171';
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${activeReel.category.toUpperCase()}  ·  ${activeReel.bureau.toUpperCase()}`, 124, h - 142);

      ctx.fillStyle = '#FBF9F5';
      ctx.font = '700 24px Georgia, Cambria, serif';
      const titleText =
        activeReel.title.length > 64 ? `${activeReel.title.slice(0, 61)}…` : activeReel.title;
      ctx.fillText(titleText, 28, h - 98);

      ctx.fillStyle = '#D6D3CD';
      ctx.font = '400 16px system-ui, -apple-system, sans-serif';
      ctx.fillText(activeReel.caption, 28, h - 64);

      // In-stream Ad milestone banner when crossing 12s
      if (elapsedSec >= 12) {
        ctx.fillStyle = 'rgba(20, 83, 45, 0.92)';
        ctx.fillRect(28, h - 42, 355, 26);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText('IN-STREAM SPONSOR CREDITED · +$0.025 GROSS', 40, h - 25);
      } else if (elapsedSec >= 3) {
        ctx.fillStyle = 'rgba(20, 20, 19, 0.85)';
        ctx.fillRect(28, h - 42, 318, 26);
        ctx.fillStyle = '#86EFAC';
        ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText('3S+ QUALIFIED VIEW · RPM ACTIVE', 40, h - 25);
      }

      if (isPlaying) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [activeReel, activePlatform, elapsedSec, isPlaying]);

  const handleSponsorCtaClick = async () => {
    if (!activeReel) return;
    const evt = await onRecordClick(
      'ad_link',
      activePlatform,
      activeReel.id,
      activeReel.sponsorCtaLabel
    );
    if (evt) {
      setStatusNote(
        `Sponsored Click tracked on ${CHANNEL_LABELS[activePlatform]} (+$${evt.creatorNetUsd.toFixed(2)} net creator payout)`
      );
    }
  };

  const handleWithdraw = async () => {
    setWithdrawFeedback(null);
    setWithdrawing(true);
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `hub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const res = await fetch('/api/revenue-engine/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Unable to process creator withdrawal.');
      }
      onWithdrawSuccess({
        withdrawalId: payload.withdrawalId,
        amountUsd: payload.amountUsd,
        message: payload.message,
        revenueEngine: payload.revenueEngine as RevenueEngineResponse,
        ownerPayouts: payload.ownerPayouts,
        rewards: payload.rewards,
        monetizationSummary: payload.monetizationSummary
      });
      setWithdrawFeedback({ type: 'success', text: payload.message });
    } catch (err: unknown) {
      setWithdrawFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to complete withdrawal.'
      });
    } finally {
      setWithdrawing(false);
    }
  };

  const rates = data?.rates;
  const totals = data?.totals;
  const channels = data?.channels ?? [];
  const events = data?.recentEvents ?? [];

  const progressPct = activeReel
    ? Math.min(100, Math.round((elapsedSec / activeReel.durationSec) * 100))
    : 0;

  return (
    <section
      id="video-hub"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-[#FBF9F5] dark:bg-[#0D0D0C]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-10">
        {/* Section Header + Channel Context Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1.5 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" />
              <span>Creator &amp; Reader Engagement Monetization (Web + App)</span>
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
              Video Reels &amp; Per-Click Revenue Hub
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Watch news reels, movie snippets, sports highlights, and sponsored commercials to earn real-time watch-time RPM payouts alongside per-click reader revenue across News Hub 24+.com Web, Android APK, and Base44 App.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-4 self-start lg:self-end">
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Video (Unlimited Size)</span>
            </button>

            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E]">
                Playback &amp; Click Attribution Channel
              </span>
              <div
                role="tablist"
                aria-label="Select revenue attribution channel"
                className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F5F2EB] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md"
              >
                {(['website', 'android_apk', 'base44_app'] as RevenueChannel[]).map((ch) => {
                  const active = activePlatform === ch;
                  return (
                    <button
                      key={ch}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActivePlatform(ch)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                          : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                      }`}
                    >
                      {CHANNEL_LABELS[ch]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 5-Column Mechanism-to-Outcome Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 pb-8 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1 flex items-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
              <span>Verified Reader Clicks</span>
            </p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {(totals?.totalClicks ?? 13450).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
              <span>Qualified Video Views</span>
            </p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {(totals?.totalVideoViews ?? 23060).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Watch Hours Logged</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {(totals?.totalWatchHours ?? 108.3).toLocaleString()} hrs
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Pending Creator Balance</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              ${(totals?.pendingPayoutUsd ?? 2145.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
              <span>Total Paid Out</span>
            </p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              ${(totals?.totalPaidOutUsd ?? 1840).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Main Video Broadcast Player + Interactive Reel Playlist */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Columns: Broadcast Player + Sponsored CTA */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-lg overflow-hidden">
              <div className="relative bg-[#141413]">
                {activeReel?.videoUrl ? (
                  <video
                    ref={videoElRef}
                    src={activeReel.videoUrl}
                    playsInline
                    muted={isMuted}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => {
                      const t = e.currentTarget.currentTime;
                      setElapsedSec(Number(t.toFixed(2)));
                    }}
                    onEnded={() => setIsPlaying(false)}
                    className="w-full aspect-video block bg-black object-contain"
                  />
                ) : (
                  <canvas
                    ref={canvasRef}
                    width={960}
                    height={540}
                    className="w-full aspect-video block"
                  />
                )}

                {!isPlaying && elapsedSec === 0 && (
                  <button
                    type="button"
                    onClick={() => setIsPlaying(true)}
                    aria-label={`Play ${activeReel?.title ?? 'video reel'}`}
                    className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors group"
                  >
                    <span className="inline-flex items-center gap-2.5 px-5 py-3 rounded-md bg-[#991B1B] group-hover:bg-[#7F1D1D] text-white text-sm font-semibold shadow-lg">
                      <Play className="w-4 h-4 fill-current" />
                      <span>Watch Dispatch Reel (Earn RPM)</span>
                    </span>
                  </button>
                )}
              </div>

              {/* Video Transport & Milestone Progress Bar */}
              <div className="p-4 sm:p-5 space-y-3.5 bg-white dark:bg-[#171715] border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeReel && elapsedSec >= activeReel.durationSec) {
                        setElapsedSec(0);
                        setQualifiedFiredForReel(false);
                        setAdBonusFiredForReel(false);
                        setLastSliceSec(0);
                        if (videoElRef.current) videoElRef.current.currentTime = 0;
                      }
                      setIsPlaying((prev) => !prev);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] transition-colors whitespace-nowrap shrink-0"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Pause' : elapsedSec > 0 ? 'Resume' : 'Play'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (videoElRef.current) videoElRef.current.currentTime = 0;
                      if (activeReel) selectReel(activeReel.id, true);
                    }}
                    aria-label="Replay reel from start"
                    className="p-2 text-[#44403C] dark:text-[#D6D3CD] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:text-[#141413] dark:hover:text-[#F5F3EE] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex-1 flex items-center gap-2.5 min-w-0">
                    <input
                      type="range"
                      min={0}
                      max={activeReel?.durationSec ?? 24}
                      step={0.5}
                      value={elapsedSec}
                      aria-label="Seek video timeline"
                      onChange={(e) => {
                        const t = Number(e.target.value);
                        setElapsedSec(t);
                        if (videoElRef.current && activeReel?.videoUrl) {
                          videoElRef.current.currentTime = t;
                        }
                      }}
                      className="w-full accent-[#991B1B] cursor-pointer"
                    />
                    <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums whitespace-nowrap shrink-0">
                      {formatClock(elapsedSec)} / {formatClock(activeReel?.durationSec ?? 24)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleMute}
                    aria-label={isMuted ? 'Unmute audio cue' : 'Mute audio'}
                    className="p-2 text-[#44403C] dark:text-[#D6D3CD] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:text-[#141413] dark:hover:text-[#F5F3EE] transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (reels.length === 0 || !activeReel) return;
                      const idx = reels.findIndex((r) => r.id === activeReel.id);
                      const next = reels[(idx + 1) % reels.length];
                      selectReel(next.id, true);
                    }}
                    aria-label="Next reel"
                    className="p-2 text-[#44403C] dark:text-[#D6D3CD] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:text-[#141413] dark:hover:text-[#F5F3EE] transition-colors"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* SVG Progress & Milestone Indicator */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className={qualifiedFiredForReel ? 'text-[#14532D] dark:text-[#4ADE80] font-semibold' : 'text-[#57534E] dark:text-[#A8A29E]'}>
                      {qualifiedFiredForReel ? '✓ 3s View RPM Earned' : '○ 3s Qualified View'}
                    </span>
                    <span className={adBonusFiredForReel ? 'text-[#14532D] dark:text-[#4ADE80] font-semibold' : 'text-[#57534E] dark:text-[#A8A29E]'}>
                      {adBonusFiredForReel ? '✓ 12s In-Stream Ad Bonus Earned' : '○ 12s In-Stream Ad Bonus'}
                    </span>
                    <span className="text-[#57534E] dark:text-[#A8A29E] tabular-nums">{progressPct}% watched</span>
                  </div>
                  <svg viewBox="0 0 100 2" className="w-full h-1.5 rounded-sm overflow-hidden bg-[#EFECE6] dark:bg-[#262420]" aria-hidden="true">
                    <rect x="0" y="0" width={progressPct} height="2" className="fill-[#991B1B] dark:fill-[#DC2626]" />
                  </svg>
                </div>

                {/* Sponsored CPC Action Bar */}
                {activeReel && (
                  <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#2C2A26] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                        {activeReel.creator} · {activeReel.views.toLocaleString()} views · {activeReel.clicks.toLocaleString()} clicks
                      </p>
                      <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                        {activeReel.sponsorUrlLabel} · ${activeReel.earnedUsd.toFixed(2)} reel earnings
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleSponsorCtaClick}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap"
                      >
                        <span>{activeReel.sponsorCtaLabel}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                      {linkedArticle && (
                        <button
                          type="button"
                          onClick={() => onOpenArticle(linkedArticle)}
                          className="px-3 py-2 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] transition-colors whitespace-nowrap"
                        >
                          Open Story
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {statusNote && (
                  <p
                    role="status"
                    className="flex items-center gap-2 text-xs font-medium text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] px-3 py-2 rounded-md"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{statusNote}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Watchable Reel Queue */}
          <div className="lg:col-span-5 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
              <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                Monetized Video Reels Queue
              </h3>
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#991B1B] dark:text-[#F87171] hover:underline underline-offset-4 whitespace-nowrap"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>+ Upload ({reels.length})</span>
              </button>
            </div>

            <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-[34rem] overflow-y-auto">
              {reels.map((reel) => {
                const isSelected = activeReel?.id === reel.id;
                return (
                  <div
                    key={reel.id}
                    className={`px-5 py-3.5 transition-colors flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#FEF2F2] dark:bg-[#2A1515]/60'
                        : 'hover:bg-[#F5F2EB]/60 dark:hover:bg-[#1F1E1B]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectReel(reel.id, true)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#57534E] dark:text-[#A8A29E] mb-1">
                        <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">
                          {reel.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{formatClock(reel.durationSec)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{reel.views.toLocaleString()} views</span>
                        {reel.fileSizeFormatted && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-[#14532D] dark:text-[#4ADE80]">
                              {reel.fileSizeFormatted}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="font-serif text-sm font-semibold text-[#141413] dark:text-[#F5F3EE] leading-snug line-clamp-2">
                        {reel.title}
                      </p>
                      <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-1 tabular-nums">
                        {reel.clicks.toLocaleString()} clicks · {Math.round(reel.watchSeconds / 60).toLocaleString()} watch min
                      </p>
                    </button>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="font-mono text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                        ${reel.earnedUsd.toFixed(2)}
                      </span>
                      {reel.isUserUploaded && (
                        <button
                          type="button"
                          onClick={() => onDeleteUploadedVideo(reel.id)}
                          aria-label={`Delete uploaded video ${reel.title}`}
                          className="p-1 text-[#78716C] hover:text-[#991B1B] dark:hover:text-[#F87171] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Grid: Rate Card + Web/APK/Base44 Breakdown + Live Revenue Ledger & Withdraw */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Rate Card & Cross-Platform Table */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                  <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Website, Android APK &amp; Base44 Revenue Breakdown
                  </h3>
                </div>
                <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E]">
                  70% Creator Share
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E2DC] dark:border-[#2C2A26] text-[#57534E] dark:text-[#A8A29E]">
                      <th className="py-3 px-4 font-semibold">Platform Channel</th>
                      <th className="py-3 px-4 font-semibold text-right">Clicks</th>
                      <th className="py-3 px-4 font-semibold text-right">Video Views</th>
                      <th className="py-3 px-4 font-semibold text-right">Watch Hrs</th>
                      <th className="py-3 px-4 font-semibold text-right">Creator Net (70%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                    {channels.map((ch) => (
                      <tr key={ch.channel} className="hover:bg-[#F5F2EB]/60 dark:hover:bg-[#1F1E1B]">
                        <td className="py-3 px-4 font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          {ch.label}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#292524] dark:text-[#D6D3CD]">
                          {ch.clicks.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#292524] dark:text-[#D6D3CD]">
                          {ch.videoViews.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                          {(ch.watchSeconds / 3600).toFixed(1)}h
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-[#14532D] dark:text-[#4ADE80]">
                          ${ch.creatorNetUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monetization Payout Schedule Card */}
            <div className="p-5 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
              <h4 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE] mb-3">
                News Hub 24+ Per-Click &amp; Video Watch Rate Schedule
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[#57534E] dark:text-[#A8A29E] block">Web Dispatch Click</span>
                  <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    ${(rates?.webClickCpc ?? 0.18).toFixed(2)} / click
                  </span>
                </div>
                <div>
                  <span className="text-[#57534E] dark:text-[#A8A29E] block">APK &amp; Base44 Click</span>
                  <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    ${(rates?.appClickCpc ?? 0.22).toFixed(2)} / click
                  </span>
                </div>
                <div>
                  <span className="text-[#57534E] dark:text-[#A8A29E] block">Sponsored CTA Click</span>
                  <span className="font-mono font-semibold text-[#991B1B] dark:text-[#F87171] tabular-nums">
                    ${(rates?.adClickCpc ?? 0.45).toFixed(2)} / click
                  </span>
                </div>
                <div>
                  <span className="text-[#57534E] dark:text-[#A8A29E] block">Qualified Video View (3s+)</span>
                  <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    ${(rates?.videoQualifiedRpm ?? 4.5).toFixed(2)} RPM
                  </span>
                </div>
                <div>
                  <span className="text-[#57534E] dark:text-[#A8A29E] block">Watch-Time Retention</span>
                  <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    +$0.0025 / 5s slice
                  </span>
                </div>
                <div>
                  <span className="text-[#57534E] dark:text-[#A8A29E] block">In-Stream Ad Completion (12s+)</span>
                  <span className="font-mono font-semibold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                    +$0.025 / bonus
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Live Click/Watch Payout Ledger + Withdraw Balance */}
          <div className="lg:col-span-5 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-lg overflow-hidden flex flex-col justify-between">
            <div>
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
                <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Live Click &amp; Watch Revenue Stream
                </h3>
                <span className="font-mono text-xs text-[#14532D] dark:text-[#4ADE80]">
                  Synced to Treasury
                </span>
              </div>

              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-80 overflow-y-auto">
                {events.slice(0, 8).map((ev) => (
                  <div key={ev.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block truncate">
                        {ev.sourceLabel}
                      </span>
                      <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                        {ev.id} · {CHANNEL_LABELS[ev.platform]}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-semibold tabular-nums shrink-0 ${
                        ev.eventType === 'withdrawal'
                          ? 'text-[#991B1B] dark:text-[#F87171]'
                          : ev.eventType === 'reversal'
                            ? 'text-[#B45309] dark:text-[#FBBF24]'
                            : 'text-[#14532D] dark:text-[#4ADE80]'
                      }`}
                    >
                      {ev.eventType === 'withdrawal'
                        ? '-'
                        : ev.eventType === 'reversal'
                          ? 'REV '
                          : '+'}
                      ${ev.creatorNetUsd.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 bg-[#FBF9F5] dark:bg-[#1C1B19] border-t border-[#E5E2DC] dark:border-[#2C2A26] space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[#57534E] dark:text-[#A8A29E]">Active Payout Rail</span>
                <span className="font-mono font-medium text-[#141413] dark:text-[#F5F3EE] truncate">
                  {data?.payoutConfig.accountLabel ?? 'News Hub 24+ Treasury'}
                </span>
              </div>

              {withdrawFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium px-3 py-2 rounded-md border ${
                    withdrawFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  {withdrawFeedback.text}
                </p>
              )}

              <button
                type="button"
                disabled={withdrawing || (totals?.pendingPayoutUsd ?? 0) < 0.01}
                onClick={handleWithdraw}
                className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] dark:hover:bg-[#16A34A] rounded-md disabled:opacity-50 transition-colors"
              >
                {withdrawing
                  ? 'Disbursing Funds…'
                  : `Withdraw Creator Balance ($${(totals?.pendingPayoutUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
