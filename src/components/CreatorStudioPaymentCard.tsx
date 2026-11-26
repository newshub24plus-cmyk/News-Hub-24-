import {
  Activity,
  Award,
  CheckCircle2,
  Coins,
  Gem,
  PlayCircle,
  RefreshCw,
  Smartphone,
  Sparkles,
  Star,
  Tv,
  Video
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { NewsArticle } from '../data/newsData';
import type { AfricaFxRates, MonetizationSummary, MonetizationTransaction } from './PaymentModal';

interface CreatorStudioPaymentOption {
  rank: number;
  id: 'ghana-pay' | 'global-rail' | 'newshub-app-wallet' | string;
  title: string;
  subtitle: string;
  ready: boolean;
}

interface CreatorStudioResponse {
  generatedAt: string;
  fxRates: AfricaFxRates;
  threePaymentOptions: CreatorStudioPaymentOption[];
  recentSupportTxs: MonetizationTransaction[];
}

interface CreatorEarningsOverviewResponse {
  generatedAt: string;
  youtube: {
    subscribers: number;
    publicWatchHours: number;
    longFormViews: number;
    monetizedPlaybacks: number;
    shortsEngagedViews: number;
    premiumWatchMinutes: number;
    activeChannelMembers: number;
    watchPageAdNetUsd: number;
    shortsPoolNetUsd: number;
    membershipsMrrUsd: number;
    superThanksNetUsd: number;
    premiumShareNetUsd: number;
    claimedUsd: number;
    watchPageRpmUsd: number;
    shortsRpmUsd: number;
    tier1FanFundingReady: boolean;
    tier2FullPartnerReady: boolean;
    goals: {
      tier1Subs: number;
      tier1WatchHours: number;
      tier2Subs: number;
      tier2WatchHours: number;
      shortsViewsGoal: number;
    };
    totalEarnedUsd: number;
    claimableUsd: number;
  };
  tiktok: {
    followers: number;
    qualifiedViews60sPlus: number;
    totalWatchSeconds60sPlus: number;
    completedViews60sPlus: number;
    liveGiftCoinsReceived: number;
    diamondsBalance: number;
    seriesSalesCount: number;
    creatorRewardsNetUsd: number;
    liveGiftsDiamondsUsd: number;
    seriesPaywallNetUsd: number;
    sparkAdBoostNetUsd: number;
    claimedUsd: number;
    qualifiedRpmUsd: number;
    completionRatePercent: number;
    avgWatchSeconds: number;
    goals: {
      followersGoal: number;
      monthlyViewsGoal: number;
      minVideoSeconds: number;
    };
    totalEarnedUsd: number;
    claimableUsd: number;
  };
  combined: {
    totalLifetimeCreatorUsd: number;
    totalClaimableUsd: number;
    totalClaimableSol: number;
    verifiedRealExternalUsd: number;
    creatorSharePercent: number;
  };
  recentTransactions: Array<{
    id: string;
    platform: 'youtube' | 'tiktok';
    productType: string;
    label: string;
    targetTitle: string;
    supporterName: string;
    grossUsd: number;
    creatorNetUsd: number;
    coinsOrStarsCount: number;
    diamondsCredited: number;
    paymentRail: string;
    settlementMode: 'live_gateway' | 'live_treasury_rail';
    verifiedRealFunds: boolean;
    settlementReference: string;
    createdAt: string;
  }>;
  recentClaims: Array<{
    id: string;
    youtubeUsd: number;
    tiktokUsd: number;
    totalClaimedUsd: number;
    equivalentSol: number;
    claimedAt: string;
    note: string;
  }>;
}

interface CreatorStudioPaymentCardProps {
  articles?: NewsArticle[];
  externalRefreshKey?: number;
  onSupportSuccess?: (payload: {
    transaction: MonetizationTransaction;
    summary: MonetizationSummary;
    recentTransactions: MonetizationTransaction[];
    revenueEngine?: unknown;
    ownerPayouts?: unknown;
    message: string;
  }) => void;
}

const SUPPORT_PACKS = [
  { usd: 2, coins: 155, label: '$2 · 155 Coins / Super Thanks' },
  { usd: 5, coins: 388, label: '$5 · 388 Coins / Super Thanks' },
  { usd: 10, coins: 775, label: '$10 · 775 Coins / Membership' },
  { usd: 25, coins: 1938, label: '$25 · Series Unlock / Gift' },
  { usd: 50, coins: 3876, label: '$50 · Patron Crown' }
] as const;

type StudioTab = 'overview' | 'engagement' | 'support';

export function CreatorStudioPaymentCard({
  articles = [],
  externalRefreshKey = 0,
  onSupportSuccess
}: CreatorStudioPaymentCardProps) {
  const [studio, setStudio] = useState<CreatorStudioResponse | null>(null);
  const [earnings, setEarnings] = useState<CreatorEarningsOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<StudioTab>('overview');

  // Claim State
  const [claiming, setClaiming] = useState<boolean>(false);

  // Engagement Recording State
  const [engageFormat, setEngageFormat] = useState<'tiktok_60s_plus' | 'youtube_long' | 'youtube_shorts'>(
    'tiktok_60s_plus'
  );
  const [engageViews, setEngageViews] = useState<string>('2500');
  const [engageWatchMins, setEngageWatchMins] = useState<string>('2600');
  const [engageCompleted, setEngageCompleted] = useState<boolean>(true);
  const [engagePremium, setEngagePremium] = useState<boolean>(false);
  const [recordingEngage, setRecordingEngage] = useState<boolean>(false);

  // Fan Support State
  const [productType, setProductType] = useState<
    'tiktok_live_gift' | 'tiktok_series_unlock' | 'youtube_super_thanks' | 'youtube_membership'
  >('tiktok_live_gift');
  const [selectedPackUsd, setSelectedPackUsd] = useState<number>(10);
  const [paymentOption, setPaymentOption] = useState<'ghana-pay' | 'global-rail' | 'newshub-app-wallet'>(
    'ghana-pay'
  );
  const [targetTitle, setTargetTitle] = useState<string>('');
  const [supporterName, setSupporterName] = useState<string>('');
  const [supporterEmail, setSupporterEmail] = useState<string>('');
  const [messageNote, setMessageNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [studioRes, earningsRes] = await Promise.all([
        fetch('/api/monetization/creator-studio'),
        fetch('/api/creator-earnings/overview')
      ]);
      if (studioRes.ok) {
        setStudio((await studioRes.json()) as CreatorStudioResponse);
      }
      if (earningsRes.ok) {
        setEarnings((await earningsRes.json()) as CreatorEarningsOverviewResponse);
      }
    } catch {
      // Preserve last snapshot cleanly
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll, externalRefreshKey]);

  useEffect(() => {
    if (!targetTitle && articles.length > 0) {
      setTargetTitle(articles[0].title);
    }
  }, [articles, targetTitle]);

  const fxGhs = studio?.fxRates?.GHS ?? 15.5;
  const yt = earnings?.youtube;
  const tt = earnings?.tiktok;
  const combined = earnings?.combined;

  const ytSubsPct = Math.min(100, Math.round(((yt?.subscribers ?? 0) / 1000) * 100));
  const ytHoursPct = Math.min(100, Math.round(((yt?.publicWatchHours ?? 0) / 4000) * 100));

  const mapServerOptionToKey = (
    opt: CreatorStudioPaymentOption
  ): 'ghana-pay' | 'global-rail' | 'newshub-app-wallet' => {
    if (opt.rank === 3 || opt.id === 'newshub-app-wallet') return 'newshub-app-wallet';
    if (opt.rank === 1 || opt.id === 'ghana-pay') return 'ghana-pay';
    return 'global-rail';
  };

  const handleClaimToTreasury = async () => {
    setFeedback(null);
    setClaiming(true);
    try {
      const res = await fetch('/api/creator-earnings/claim-to-treasury', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not claim creator earnings.');
      if (data.creatorEarnings) setEarnings(data.creatorEarnings as CreatorEarningsOverviewResponse);
      setFeedback({ type: 'success', text: data.message as string });
      if (data.summary) {
        onSupportSuccess?.({
          transaction: {
            id: data.claim.id,
            planId: 'creator-earnings-claim',
            planName: 'YouTube + TikTok Creator Claim',
            billingCycle: 'one-time',
            amountUsd: data.claim.totalClaimedUsd,
            paymentMethodId: 'newshub-app-wallet',
            paymentMethodName: 'Creator Earnings Engine',
            customerName: 'News Hub 24+ Owner',
            customerEmail: 'newshub24plus@gmail.com',
            accountHint: data.claim.note,
            createdAt: data.claim.claimedAt
          },
          summary: data.summary as MonetizationSummary,
          recentTransactions: [],
          ownerPayouts: data.ownerPayouts,
          message: data.message as string
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to claim earnings to Live Treasury.'
      });
    } finally {
      setClaiming(false);
    }
  };

  const handleRecordEngagement = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setRecordingEngage(true);
    try {
      const res = await fetch('/api/creator-earnings/record-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: engageFormat,
          viewsDelta: Math.max(1, Math.round(Number(engageViews) || 1000)),
          watchSecondsDelta: Math.max(60, Math.round((Number(engageWatchMins) || 600) * 60)),
          completed: engageCompleted,
          premiumViewer: engagePremium
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record engagement metrics.');
      if (data.creatorEarnings) setEarnings(data.creatorEarnings as CreatorEarningsOverviewResponse);
      setFeedback({ type: 'success', text: data.message as string });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to record creator engagement.'
      });
    } finally {
      setRecordingEngage(false);
    }
  };

  const handleSubmitSupport = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (supporterName.trim().length < 2) {
      setFeedback({ type: 'error', text: 'Enter your supporter name (2+ characters).' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/creator-earnings/send-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType,
          targetTitle: targetTitle.trim() || 'News Hub 24+ Creator Studio',
          amountUsd: selectedPackUsd,
          paymentOption,
          supporterName: supporterName.trim(),
          supporterEmail: supporterEmail.trim() || undefined,
          messageNote: messageNote.trim() || undefined
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not settle creator support.');
      }

      if (payload.creatorEarnings) {
        setEarnings(payload.creatorEarnings as CreatorEarningsOverviewResponse);
      }
      setFeedback({ type: 'success', text: payload.message as string });
      setMessageNote('');
      onSupportSuccess?.(payload);
      await loadAll();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send creator support.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
        <div>
          <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1 flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5" />
            <span>Unified YouTube Partner Program &amp; TikTok Creator Rewards Engine · Live Account</span>
          </p>
          <h3 className="font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE]">
            Real Creator Earnings: YouTube Watch/Shorts + TikTok Qualified Views &amp; LIVE Gifts
          </h3>
          <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
            Earn across YouTube Watch Page RPM, Shorts Ad Pool, Channel Memberships, Super Thanks, TikTok 1+ Min Qualified Views (Dynamic RPM), LIVE Diamonds ($0.005/Diamond), and Series Paywalls — with 1-click sweep into your Live Withdrawable Treasury.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="tablist"
            aria-label="Creator earnings studio tabs"
            className="inline-flex items-center gap-1 p-1 bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-xs"
          >
            {(
              [
                ['overview', 'YouTube & TikTok Overview'],
                ['engagement', 'Record Watch & Views'],
                ['support', 'Gifts, Super Thanks & Series']
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1.5 rounded-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'bg-[#141413] text-white dark:bg-[#F5F3EE] dark:text-[#141413] font-semibold'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Claimable Earnings Banner */}
      <div className="p-4 sm:p-5 bg-white dark:bg-[#141413] border border-[#BBF7D0] dark:border-[#166534] rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#14532D] dark:text-[#4ADE80] flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" />
            <span>Unclaimed YouTube + TikTok Creator Earnings Ready for Treasury Sweep</span>
          </span>
          <div className="flex flex-wrap items-baseline gap-4">
            <p className="font-mono text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              ${(combined?.totalClaimableUsd ?? 0).toFixed(2)} USD
            </p>
            <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
              YouTube ${(yt?.claimableUsd ?? 0).toFixed(2)} + TikTok ${(tt?.claimableUsd ?? 0).toFixed(2)} · ≈{' '}
              {(combined?.totalClaimableSol ?? 0).toFixed(4)} SOL · GH₵ {((combined?.totalClaimableUsd ?? 0) * fxGhs).toFixed(2)}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={claiming || (combined?.totalClaimableUsd ?? 0) < 0.01}
          onClick={() => void handleClaimToTreasury()}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {claiming
            ? 'Claiming to Treasury…'
            : `Claim $${(combined?.totalClaimableUsd ?? 0).toFixed(2)} to Live Treasury`}
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-md border text-xs flex items-start gap-2 ${
            feedback.type === 'success'
              ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
              : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* TAB 1: Side-by-Side YouTube Partner Program & TikTok Creator Rewards */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* YouTube Partner Program Panel */}
          <div className="p-5 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                <span className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                  YouTube Partner Program Model
                </span>
              </div>
              <span className="font-mono text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
                {yt?.tier2FullPartnerReady
                  ? 'Tier 2 Ad Revenue Active'
                  : yt?.tier1FanFundingReady
                    ? 'Tier 1 Fan Funding Ready'
                    : 'Watch Page + Shorts Metering'}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#44403C] dark:text-[#D6D3CD]">
                    Public Watch Hours (Tier 1: 3,000 · Tier 2: 4,000)
                  </span>
                  <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    {(yt?.publicWatchHours ?? 0).toLocaleString()} / 4,000 hrs ({ytHoursPct}%)
                  </span>
                </div>
                <svg
                  viewBox="0 0 100 6"
                  preserveAspectRatio="none"
                  role="progressbar"
                  aria-valuenow={ytHoursPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="YouTube public watch hours progress"
                  className="w-full h-2 rounded-xs bg-[#EFECE5] dark:bg-[#242320]"
                >
                  <rect
                    x={0}
                    y={0}
                    width={Math.max(2, ytHoursPct)}
                    height={6}
                    rx={1}
                    className="fill-[#991B1B] dark:fill-[#DC2626]"
                  />
                </svg>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#44403C] dark:text-[#D6D3CD]">
                    Subscribers (Tier 1: 500 · Tier 2: 1,000)
                  </span>
                  <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    {(yt?.subscribers ?? 0).toLocaleString()} / 1,000 ({ytSubsPct}%)
                  </span>
                </div>
                <svg
                  viewBox="0 0 100 6"
                  preserveAspectRatio="none"
                  role="progressbar"
                  aria-valuenow={ytSubsPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="YouTube subscribers progress"
                  className="w-full h-2 rounded-xs bg-[#EFECE5] dark:bg-[#242320]"
                >
                  <rect
                    x={0}
                    y={0}
                    width={Math.max(2, ytSubsPct)}
                    height={6}
                    rx={1}
                    className="fill-[#14532D] dark:fill-[#16A34A]"
                  />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26] text-xs">
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Watch Page RPM</span>
                <span className="font-mono text-base font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  ${(yt?.watchPageRpmUsd ?? 3.85).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Watch Ads + Premium</span>
                <span className="font-mono text-base font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  ${((yt?.watchPageAdNetUsd ?? 0) + (yt?.premiumShareNetUsd ?? 0)).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Shorts Ad Pool (45%)</span>
                <span className="font-mono text-base font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  ${(yt?.shortsPoolNetUsd ?? 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Memberships MRR</span>
                <span className="font-mono text-base font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  ${(yt?.membershipsMrrUsd ?? 0).toFixed(2)} ({yt?.activeChannelMembers ?? 0})
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Super Thanks</span>
                <span className="font-mono text-base font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  ${(yt?.superThanksNetUsd ?? 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Total YouTube Net</span>
                <span className="font-mono text-base font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  ${(yt?.totalEarnedUsd ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* TikTok Creator Rewards & LIVE Panel */}
          <div className="p-5 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-[#14532D] dark:text-[#4ADE80]" />
                <span className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                  TikTok Creator Rewards &amp; LIVE Diamonds
                </span>
              </div>
              <span className="font-mono text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
                1+ Min Qualified RPM ${(tt?.qualifiedRpmUsd ?? 0.58).toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Qualified Views (60s+)</span>
                <span className="font-mono text-base font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {(tt?.qualifiedViews60sPlus ?? 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Completion Rate</span>
                <span className="font-mono text-base font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {(tt?.completionRatePercent ?? 0).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Avg Watch Depth</span>
                <span className="font-mono text-base font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {(tt?.avgWatchSeconds ?? 0).toFixed(1)}s
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Creator Rewards Net</span>
                <span className="font-mono text-base font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  ${(tt?.creatorRewardsNetUsd ?? 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">LIVE Diamonds ($0.005)</span>
                <span className="font-mono text-base font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums flex items-center gap-1">
                  <Gem className="w-3.5 h-3.5 shrink-0" />
                  <span>{(tt?.diamondsBalance ?? 0).toLocaleString()} (${(tt?.liveGiftsDiamondsUsd ?? 0).toFixed(2)})</span>
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Series Paywall Unlocks</span>
                <span className="font-mono text-base font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  ${(tt?.seriesPaywallNetUsd ?? 0).toFixed(2)} ({tt?.seriesSalesCount ?? 0})
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
              <span className="text-[#57534E] dark:text-[#A8A29E]">
                Coins Received: {(tt?.liveGiftCoinsReceived ?? 0).toLocaleString()} · Claimed: ${(tt?.claimedUsd ?? 0).toFixed(2)}
              </span>
              <span className="font-mono font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                Total TikTok Net: ${(tt?.totalEarnedUsd ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Record Live Engagement (TikTok 60s+ Qualified Views / YouTube Long / Shorts) */}
      {activeTab === 'engagement' && (
        <form
          onSubmit={handleRecordEngagement}
          className="p-5 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
            <Activity className="w-4 h-4 text-[#14532D] dark:text-[#4ADE80]" />
            <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
              Meter Verified Video Watch Time &amp; Qualified Views into Creator Earnings
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="engage-format" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Creator Format
              </label>
              <select
                id="engage-format"
                value={engageFormat}
                onChange={(e) =>
                  setEngageFormat(
                    e.target.value as 'tiktok_60s_plus' | 'youtube_long' | 'youtube_shorts'
                  )
                }
                className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
              >
                <option value="tiktok_60s_plus">TikTok 1+ Min Original Video (Dynamic RPM)</option>
                <option value="youtube_long">YouTube Watch Page Long-Form (RPM + Hours)</option>
                <option value="youtube_shorts">YouTube Shorts Feed Ad Pool (45% Split)</option>
              </select>
            </div>

            <div>
              <label htmlFor="engage-views" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Qualified / Engaged Views
              </label>
              <input
                id="engage-views"
                type="number"
                min={1}
                max={10000}
                value={engageViews}
                onChange={(e) => setEngageViews(e.target.value)}
                className="w-full px-3 py-2 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>

            <div>
              <label htmlFor="engage-mins" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Total Watch Time (Minutes)
              </label>
              <input
                id="engage-mins"
                type="number"
                min={1}
                max={600}
                value={engageWatchMins}
                onChange={(e) => setEngageWatchMins(e.target.value)}
                className="w-full px-3 py-2 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-[#292524] dark:text-[#D6D3CD]">
              <input
                type="checkbox"
                checked={engageCompleted}
                onChange={(e) => setEngageCompleted(e.target.checked)}
              />
              <span>Full video completion factor (boosts TikTok Dynamic RPM)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[#292524] dark:text-[#D6D3CD]">
              <input
                type="checkbox"
                checked={engagePremium}
                onChange={(e) => setEngagePremium(e.target.checked)}
              />
              <span>Includes YouTube Premium watch-time pool</span>
            </label>
          </div>

          <div className="pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26] flex justify-end">
            <button
              type="submit"
              disabled={recordingEngage}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-50"
            >
              {recordingEngage ? 'Metering Engagement…' : 'Record Engagement & Accrue Earnings'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Fan Support (TikTok LIVE Gifts, Series Paywall, YouTube Super Thanks & Memberships) */}
      {activeTab === 'support' && (
        <form
          onSubmit={handleSubmitSupport}
          noValidate
          className="p-5 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-5 text-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
            <div className="flex items-center gap-2 font-semibold text-[#141413] dark:text-[#F5F3EE]">
              <Star className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
              <span>Fan Monetization: TikTok Gifts / Series &amp; YouTube Super Thanks / Memberships</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['tiktok_live_gift', 'TikTok LIVE Gift'],
                  ['tiktok_series_unlock', 'TikTok Series'],
                  ['youtube_super_thanks', 'YouTube Super Thanks'],
                  ['youtube_membership', 'YouTube Membership']
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setProductType(key)}
                  className={`px-3 py-1 rounded-sm border transition-colors ${
                    productType === key
                      ? 'bg-[#141413] text-white border-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] font-semibold'
                      : 'bg-[#FBF9F5] dark:bg-[#0D0D0C] text-[#57534E] dark:text-[#A8A29E] border-[#E5E2DC] dark:border-[#2C2A26]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 3 Live Payment Options */}
          <div>
            <span className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-2">
              Select Live Settlement Option (News Hub 24+ App Wallet Available as Option 3)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {(studio?.threePaymentOptions ?? [
                {
                  rank: 1,
                  id: 'ghana-pay',
                  title: 'Option 1 · GhanaPay & MTN MoMo (0557711975)',
                  subtitle: 'Direct GH₵ Mobile Money & Third-Party',
                  ready: true
                },
                {
                  rank: 2,
                  id: 'global-rail',
                  title: 'Option 2 · Card, PayPal & Flutterwave',
                  subtitle: 'Global YouTube / TikTok Live Gateway Rails',
                  ready: false
                },
                {
                  rank: 3,
                  id: 'newshub-app-wallet',
                  title: 'Option 3 · News Hub 24+ App Wallet',
                  subtitle: 'In-App APK / Base44 Wallet · $0 Fee',
                  ready: true
                }
              ]).map((opt) => {
                const key = mapServerOptionToKey(opt);
                const active = paymentOption === key;
                const isThirdAppOption = key === 'newshub-app-wallet';
                return (
                  <button
                    key={opt.title}
                    type="button"
                    onClick={() => setPaymentOption(key)}
                    className={`p-3 text-left rounded-md border transition-colors flex flex-col justify-between gap-1.5 ${
                      active
                        ? 'bg-[#FBF9F5] dark:bg-[#1C1B19] border-[#991B1B] dark:border-[#F87171]'
                        : 'bg-white dark:bg-[#10100F] border-[#E5E2DC] dark:border-[#2C2A26] hover:border-[#A8A29E]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] font-semibold text-[#991B1B] dark:text-[#F87171]">
                        {isThirdAppOption ? 'Option 3 · The App' : `Option ${opt.rank}`}
                      </span>
                      {isThirdAppOption ? (
                        <Smartphone className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
                      ) : (
                        <Coins className="w-3.5 h-3.5 text-[#57534E] dark:text-[#A8A29E]" />
                      )}
                    </div>
                    <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] leading-snug">
                      {opt.title.replace(/^Option \d+\s*·\s*/, '')}
                    </span>
                    <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E] leading-tight">
                      {opt.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pack Picker */}
          <div>
            <span className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1.5">
              Select Amount (≈ GH₵ {(selectedPackUsd * fxGhs).toFixed(2)})
            </span>
            <div className="flex flex-wrap gap-2">
              {SUPPORT_PACKS.map((pack) => {
                const active = selectedPackUsd === pack.usd;
                return (
                  <button
                    key={pack.usd}
                    type="button"
                    onClick={() => setSelectedPackUsd(pack.usd)}
                    className={`px-3 py-1.5 font-mono text-xs font-semibold rounded-sm border transition-colors tabular-nums ${
                      active
                        ? 'bg-[#141413] text-white border-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] dark:border-[#F5F3EE]'
                        : 'bg-[#FBF9F5] dark:bg-[#10100F] text-[#141413] dark:text-[#F5F3EE] border-[#D6D1C7] dark:border-[#3A3732] hover:border-[#141413]'
                    }`}
                  >
                    {pack.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="creator-target-dispatch" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Supported Dispatch / Video Series
              </label>
              {articles.length > 0 ? (
                <select
                  id="creator-target-dispatch"
                  value={targetTitle}
                  onChange={(e) => setTargetTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                >
                  {articles.slice(0, 10).map((a) => (
                    <option key={a.id} value={a.title}>
                      {a.title}
                    </option>
                  ))}
                  <option value="News Hub 24+ Creator Studio">News Hub 24+ Creator Studio</option>
                </select>
              ) : (
                <input
                  id="creator-target-dispatch"
                  type="text"
                  value={targetTitle}
                  onChange={(e) => setTargetTitle(e.target.value)}
                  placeholder="News Hub 24+ Creator Studio"
                  className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              )}
            </div>

            <div>
              <label htmlFor="creator-supporter-name" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Supporter Name *
              </label>
              <input
                id="creator-supporter-name"
                type="text"
                required
                value={supporterName}
                onChange={(e) => setSupporterName(e.target.value)}
                placeholder="e.g. Kwame Boateng"
                className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>

            <div>
              <label htmlFor="creator-supporter-email" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Receipt Email (Optional)
              </label>
              <input
                id="creator-supporter-email"
                type="email"
                value={supporterEmail}
                onChange={(e) => setSupporterEmail(e.target.value)}
                placeholder="supporter@example.com"
                className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>

            <div>
              <label htmlFor="creator-support-note" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Comment / Shoutout Note
              </label>
              <input
                id="creator-support-note"
                type="text"
                value={messageNote}
                onChange={(e) => setMessageNote(e.target.value)}
                placeholder="Keep up the investigative reporting!"
                className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
            <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
              <span>
                {paymentOption === 'newshub-app-wallet'
                  ? 'Option 3: Live News Hub 24+ App Wallet ($0 gateway fee · Instant Creator Credit)'
                  : paymentOption === 'ghana-pay'
                    ? 'Option 1: Live GhanaPay / MTN MoMo (0557711975) Settlement'
                    : 'Option 2: Live Global Card / PayPal / Flutterwave Gateway (API Credentials Required)'}
              </span>
            </span>

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {submitting ? 'Settling Creator Support…' : `Settle $${selectedPackUsd} Support`}
            </button>
          </div>
        </form>
      )}

      {/* Recent Creator Earnings & Claims Ledger */}
      {((earnings?.recentTransactions?.length ?? 0) > 0 || (earnings?.recentClaims?.length ?? 0) > 0) && (
        <div className="bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
          <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
            <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
              Recent YouTube / TikTok Earnings &amp; Claims Ledger
            </span>
            <span className="font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
              {(earnings?.recentTransactions.length ?? 0)} transactions · {(earnings?.recentClaims.length ?? 0)} claims
            </span>
          </div>
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
            {(earnings?.recentClaims ?? []).slice(0, 3).map((clm) => (
              <div
                key={clm.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-[#F0FDF4]/50 dark:bg-[#0E2416]/40"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-[#14532D] dark:text-[#4ADE80] block truncate">
                    Treasury Claim {clm.id} · YouTube ${clm.youtubeUsd.toFixed(2)} + TikTok ${clm.tiktokUsd.toFixed(2)}
                  </span>
                  <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] block truncate">
                    {clm.note}
                  </span>
                </div>
                <div className="sm:text-right font-mono tabular-nums shrink-0">
                  <span className="font-bold text-[#14532D] dark:text-[#4ADE80] block">
                    +${clm.totalClaimedUsd.toFixed(2)} Swept
                  </span>
                  <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                    ≈ {clm.equivalentSol.toFixed(4)} SOL
                  </span>
                </div>
              </div>
            ))}
            {(earnings?.recentTransactions ?? []).slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block truncate">
                    [{tx.platform.toUpperCase()}] {tx.supporterName} · {tx.label}
                  </span>
                  <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] block truncate">
                    {tx.id} · {tx.paymentRail} · Ref {tx.settlementReference}
                    {tx.diamondsCredited > 0 ? ` · ${tx.diamondsCredited} Diamonds` : ''}
                  </span>
                </div>
                <div className="sm:text-right font-mono tabular-nums shrink-0">
                  <span className="font-semibold text-[#14532D] dark:text-[#4ADE80] block">
                    +${tx.creatorNetUsd.toFixed(2)} net (${tx.grossUsd.toFixed(2)} gross)
                  </span>
                  <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                    {tx.verifiedRealFunds ? 'Live Gateway Verified' : 'Live Treasury Rail'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
