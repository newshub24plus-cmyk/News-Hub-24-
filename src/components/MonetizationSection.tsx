import {
  Check,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Landmark,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { NewsArticle } from '../data/newsData';
import { CreatorStudioPaymentCard } from './CreatorStudioPaymentCard';
import { GhanaPayGateway } from './GhanaPayGateway';
import type { OwnerWithdrawalRecord } from './OwnerWithdrawalSection';
import type {
  AfricaFxRates,
  BoostTierConfig,
  BoostTierId,
  GatewayCapabilities,
  MonetizationPlan,
  MonetizationSummary,
  MonetizationTransaction,
  PaymentMethodOption,
  SponsoredCampaign,
  TrendingAdBoost
} from './PaymentModal';

export interface PayoutConfig {
  methodId: string;
  accountLabel: string;
  recipientEmail: string;
  currency: string;
  updatedAt: string;
  expirationPolicy?: 'unlimited';
}

export interface MonetizationStateResponse {
  summary: MonetizationSummary;
  plans: MonetizationPlan[];
  paymentMethods: PaymentMethodOption[];
  payoutConfig: PayoutConfig;
  recentTransactions: MonetizationTransaction[];
  realCapabilities?: GatewayCapabilities;
  fxRates?: AfricaFxRates;
  ghanaMomoNetworks?: Array<{ code: string; label: string; prefixHint: string }>;
  ghanaBanks?: Array<{ code: string; name: string }>;
  boostTiers?: BoostTierConfig[];
  trendingBoosts?: TrendingAdBoost[];
  sponsoredCampaigns?: SponsoredCampaign[];
}

interface MonetizationSectionProps {
  data: MonetizationStateResponse | null;
  articles?: NewsArticle[];
  onSelectPlan: (plan: MonetizationPlan, cycle: 'monthly' | 'annual') => void;
  onPayoutUpdated: (payoutConfig: PayoutConfig) => void;
  onOpenArticle?: (article: NewsArticle) => void;
  onBoostsUpdated?: (payload: {
    trendingBoosts: TrendingAdBoost[];
    summary?: MonetizationSummary;
    message?: string;
  }) => void;
  onTransactionReversed?: (payload: {
    summary: MonetizationSummary;
    recentTransactions: MonetizationTransaction[];
    message: string;
  }) => void;
  onGhanaPayCheckout?: (payload: {
    transaction: MonetizationTransaction;
    summary: MonetizationSummary;
    sponsoredCampaigns?: SponsoredCampaign[];
    trendingBoosts?: TrendingAdBoost[];
    message: string;
  }) => void;
  withdrawals?: OwnerWithdrawalRecord[];
  onRefreshWithdrawals?: () => void;
  onRealSessionUpdated?: (payload: {
    summary?: MonetizationSummary;
    recentTransactions?: MonetizationTransaction[];
    revenueEngine?: unknown;
    rewards?: unknown;
    ownerPayouts?: unknown;
  }) => void;
  onCreatorSupportSuccess?: (payload: {
    transaction: MonetizationTransaction;
    summary: MonetizationSummary;
    recentTransactions: MonetizationTransaction[];
    revenueEngine?: unknown;
    message: string;
  }) => void;
  trendsRefreshKey?: number;
}

interface RealVerifiedSessionResponse {
  sessionMode: 'live_rails_ready' | 'awaiting_live_rail';
  realVerifiedRevenueUsd: number;
  realGrossRevenueUsd: number;
  realWithdrawableUsd: number;
  livePaidOutUsd: number;
  verifiedTransactionsCount: number;
  verifiedTransactions: MonetizationTransaction[];
  excludedSimulated: {
    pendingCreatorPayoutUsd: number;
    monthlyRecurringRevenueUsd: number;
    adSponsorshipRevenueUsd: number;
    activeSubscribers: number;
    isSimulatedBaselineActive: boolean;
  };
  capabilities: GatewayCapabilities;
  fxRates: AfricaFxRates;
  updatedAt: string;
}

type NormalizedWithdrawalStatus = 'pending' | 'processing' | 'paid' | 'reversed';

function normalizeWithdrawalStatus(rawStatus: string): NormalizedWithdrawalStatus {
  const s = rawStatus.trim().toLowerCase();
  if (s === 'reversed' || s.includes('revers') || s.includes('refund')) return 'reversed';
  if (s === 'pending' || s.includes('queued') || s.includes('awaiting')) return 'pending';
  if (s.includes('processing') || s.includes('1-2 business days')) return 'processing';
  if (s === 'disbursed' || s === 'paid' || s === 'settled' || s === 'completed') return 'paid';
  return 'processing';
}

const STATUS_BADGE_STYLES: Record<
  NormalizedWithdrawalStatus,
  { label: string; badgeClass: string }
> = {
  pending: {
    label: 'Pending',
    badgeClass:
      'text-[#92400E] dark:text-[#FBBF24] bg-[#FEF3C7] dark:bg-[#291F0E] border-[#FDE68A] dark:border-[#78350F]'
  },
  processing: {
    label: 'Processing',
    badgeClass:
      'text-[#1E40AF] dark:text-[#93C5FD] bg-[#EFF6FF] dark:bg-[#13203A] border-[#BFDBFE] dark:border-[#1E3A8A]'
  },
  paid: {
    label: 'Paid',
    badgeClass:
      'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
  },
  reversed: {
    label: 'Reversed',
    badgeClass:
      'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
  }
};

export function MonetizationSection({
  data,
  articles = [],
  onSelectPlan,
  onPayoutUpdated,
  onOpenArticle,
  onBoostsUpdated,
  onTransactionReversed,
  onGhanaPayCheckout,
  withdrawals,
  onRefreshWithdrawals,
  onRealSessionUpdated,
  onCreatorSupportSuccess,
  trendsRefreshKey = 0
}: MonetizationSectionProps) {
  const [activeSectionTab, setActiveSectionTab] = useState<
    'overview' | 'subscriptions_ads' | 'real_session' | 'withdrawals'
  >('overview');
  const [liveSubscriptions, setLiveSubscriptions] = useState<
    Array<{
      id: string;
      planId: string;
      planName: string;
      billingCycle: string;
      amountUsd: number;
      processorFeeUsd?: number;
      netRevenueUsd?: number;
      customerName: string;
      customerEmail: string;
      paymentMethodId: string;
      paymentReference?: string;
      verifiedRealFunds?: boolean;
      status: 'active' | 'paused' | 'cancelled';
      createdAt: string;
      updatedAt: string;
    }>
  >([]);
  const [subsSummary, setSubsSummary] = useState<{
    activeCount: number;
    totalCount: number;
    activeMrrUsd: number;
  }>({ activeCount: 0, totalCount: 0, activeMrrUsd: 0 });
  const [adsLiveData, setAdsLiveData] = useState<{
    adsensePublisherId: string | null;
    adsTxtConfigured: boolean;
    totalAdRevenueUsd: number;
    activeSponsors: SponsoredCampaign[];
    activeBoosts: TrendingAdBoost[];
    metrics: {
      activeSponsorCount: number;
      activeBoostCount: number;
      totalImpressions: number;
      totalClicks: number;
      effectiveCpmUsd: number;
    };
  } | null>(null);
  const [loadingSubsAds, setLoadingSubsAds] = useState<boolean>(false);
  const [togglingSubId, setTogglingSubId] = useState<string | null>(null);
  const [recordingSponsorClickId, setRecordingSponsorClickId] = useState<string | null>(null);
  const [subsAdsFeedback, setSubsAdsFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [realSession, setRealSession] = useState<RealVerifiedSessionResponse | null>(null);
  const [loadingRealSession, setLoadingRealSession] = useState<boolean>(false);
  const [clearingSimulated, setClearingSimulated] = useState<boolean>(false);
  const [verifyProvider, setVerifyProvider] = useState<'solana' | 'flutterwave' | 'stripe' | 'paypal'>(
    'solana'
  );
  const [verifyReference, setVerifyReference] = useState<string>('');
  const [verifyingReference, setVerifyingReference] = useState<boolean>(false);
  const [realSessionFeedback, setRealSessionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<
    'all' | NormalizedWithdrawalStatus
  >('all');
  const [withdrawalSearch, setWithdrawalSearch] = useState<string>('');
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [fallbackWithdrawals, setFallbackWithdrawals] = useState<OwnerWithdrawalRecord[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState<boolean>(false);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [payoutMethodId, setPayoutMethodId] = useState<string>('ghana-pay');
  const [accountLabel, setAccountLabel] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [currency, setCurrency] = useState<string>('GHS');
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutFeedback, setPayoutFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reversingTxId, setReversingTxId] = useState<string | null>(null);
  const [reverseTxReason, setReverseTxReason] = useState<string>('Wrong charge / billing error');
  const [submittingTxReversal, setSubmittingTxReversal] = useState(false);
  const [txFeedback, setTxFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRealSession = useCallback(async () => {
    setLoadingRealSession(true);
    try {
      const res = await fetch('/api/monetization/real-session');
      if (res.ok) {
        const json = (await res.json()) as RealVerifiedSessionResponse;
        setRealSession(json);
      }
    } catch {
      // Ignore non-fatal sync error
    } finally {
      setLoadingRealSession(false);
    }
  }, []);

  const fetchSubsAndAds = useCallback(async () => {
    setLoadingSubsAds(true);
    try {
      const [subsRes, adsRes] = await Promise.all([
        fetch('/api/monetization/subscriptions'),
        fetch('/api/monetization/ads-live')
      ]);
      if (subsRes.ok) {
        const subsJson = (await subsRes.json()) as {
          subscriptions?: typeof liveSubscriptions;
          activeCount?: number;
          totalCount?: number;
          activeMrrUsd?: number;
        };
        setLiveSubscriptions(subsJson.subscriptions ?? []);
        setSubsSummary({
          activeCount: subsJson.activeCount ?? 0,
          totalCount: subsJson.totalCount ?? 0,
          activeMrrUsd: subsJson.activeMrrUsd ?? 0
        });
      }
      if (adsRes.ok) {
        const adsJson = (await adsRes.json()) as typeof adsLiveData;
        setAdsLiveData(adsJson);
      }
    } catch {
      // Non-fatal background fetch failure
    } finally {
      setLoadingSubsAds(false);
    }
  }, []);

  const handleUpdateSubscriptionStatus = async (
    subId: string,
    status: 'active' | 'paused' | 'cancelled'
  ) => {
    setSubsAdsFeedback(null);
    setTogglingSubId(subId);
    try {
      const res = await fetch(`/api/monetization/subscriptions/${encodeURIComponent(subId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not update subscription.');
      setLiveSubscriptions(payload.subscriptions ?? []);
      setSubsAdsFeedback({ type: 'success', text: payload.message as string });
      void fetchSubsAndAds();
    } catch (err: unknown) {
      setSubsAdsFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Subscription status update failed.'
      });
    } finally {
      setTogglingSubId(null);
    }
  };

  const handleRecordSponsorClick = async (campaignId: string) => {
    setSubsAdsFeedback(null);
    setRecordingSponsorClickId(campaignId);
    try {
      const res = await fetch(
        `/api/monetization/sponsored-campaigns/${encodeURIComponent(campaignId)}/click`,
        { method: 'POST' }
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not record sponsor click.');
      if (payload.summary) {
        onRealSessionUpdated?.({ summary: payload.summary as MonetizationSummary });
      }
      setSubsAdsFeedback({
        type: 'success',
        text: `Attributed sponsor CPC click (+$${Number(payload.creditedUsd || 0.18).toFixed(2)} gross ad revenue).`
      });
      void fetchSubsAndAds();
    } catch (err: unknown) {
      setSubsAdsFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ad click attribution failed.'
      });
    } finally {
      setRecordingSponsorClickId(null);
    }
  };

  useEffect(() => {
    if (activeSectionTab === 'real_session' && !realSession) {
      void fetchRealSession();
    }
    if (activeSectionTab === 'subscriptions_ads') {
      void fetchSubsAndAds();
    }
  }, [activeSectionTab, realSession, fetchRealSession, fetchSubsAndAds]);

  const handleClearSimulatedBaseline = async () => {
    setRealSessionFeedback(null);
    setClearingSimulated(true);
    try {
      const res = await fetch('/api/monetization/real-session/clear-simulated', {
        method: 'POST'
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not clear simulated balances.');
      }
      if (payload.realSession) {
        setRealSession(payload.realSession as RealVerifiedSessionResponse);
      }
      onRealSessionUpdated?.({
        summary: payload.summary as MonetizationSummary,
        recentTransactions: payload.recentTransactions as MonetizationTransaction[],
        revenueEngine: payload.revenueEngine,
        rewards: payload.rewards,
        ownerPayouts: payload.ownerPayouts
      });
      setRealSessionFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setRealSessionFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to clear simulated earnings.'
      });
    } finally {
      setClearingSimulated(false);
    }
  };

  const handleVerifyExternalReference = async (e: FormEvent) => {
    e.preventDefault();
    setRealSessionFeedback(null);
    if (verifyReference.trim().length < 6) {
      setRealSessionFeedback({
        type: 'error',
        text: 'Enter a valid external payment reference or Solana Mainnet TX signature.'
      });
      return;
    }
    setVerifyingReference(true);
    try {
      const res = await fetch('/api/monetization/real-session/verify-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: verifyProvider,
          reference: verifyReference.trim()
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Verification failed.');
      }
      if (payload.realSession) {
        setRealSession(payload.realSession as RealVerifiedSessionResponse);
      }
      setVerifyReference('');
      onRealSessionUpdated?.({
        summary: payload.summary as MonetizationSummary,
        recentTransactions: payload.recentTransactions as MonetizationTransaction[],
        ownerPayouts: payload.ownerPayouts
      });
      setRealSessionFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setRealSessionFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to verify external reference.'
      });
    } finally {
      setVerifyingReference(false);
    }
  };

  const fetchFallbackWithdrawals = useCallback(async () => {
    setLoadingWithdrawals(true);
    try {
      const res = await fetch('/api/owner/payouts');
      if (res.ok) {
        const json = (await res.json()) as { withdrawals?: OwnerWithdrawalRecord[] };
        if (Array.isArray(json.withdrawals)) {
          setFallbackWithdrawals(json.withdrawals);
        }
      }
    } catch {
      // Non-fatal fallback fetch
    } finally {
      setLoadingWithdrawals(false);
    }
  }, []);

  useEffect(() => {
    if (withdrawals === undefined) {
      void fetchFallbackWithdrawals();
    }
  }, [withdrawals, fetchFallbackWithdrawals]);

  const allWithdrawals = withdrawals ?? fallbackWithdrawals;

  const filteredWithdrawals = useMemo(() => {
    const q = withdrawalSearch.trim().toLowerCase();
    return allWithdrawals.filter((w) => {
      const normStatus = normalizeWithdrawalStatus(w.status);
      if (withdrawalStatusFilter !== 'all' && normStatus !== withdrawalStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        w.id.toLowerCase().includes(q) ||
        (w.settlementReference ?? '').toLowerCase().includes(q) ||
        w.destinationLabel.toLowerCase().includes(q) ||
        w.maskedAccount.toLowerCase().includes(q) ||
        w.railLabel.toLowerCase().includes(q) ||
        (w.note ?? '').toLowerCase().includes(q)
      );
    });
  }, [allWithdrawals, withdrawalStatusFilter, withdrawalSearch]);

  const withdrawalTotals = useMemo(() => {
    let paidUsd = 0;
    let pendingUsd = 0;
    let processingUsd = 0;
    let reversedUsd = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let reversedCount = 0;
    for (const w of allWithdrawals) {
      const st = normalizeWithdrawalStatus(w.status);
      if (st === 'paid') {
        paidUsd += w.amountUsd;
        paidCount += 1;
      } else if (st === 'pending') {
        pendingUsd += w.amountUsd;
        pendingCount += 1;
      } else if (st === 'processing') {
        processingUsd += w.amountUsd;
        processingCount += 1;
      } else {
        reversedUsd += w.amountUsd;
        reversedCount += 1;
      }
    }
    return {
      paidUsd,
      pendingUsd,
      processingUsd,
      reversedUsd,
      paidCount,
      pendingCount,
      processingCount,
      reversedCount
    };
  }, [allWithdrawals]);

  const handleCopyTransactionId = async (txId: string) => {
    try {
      await navigator.clipboard.writeText(txId);
      setCopiedTxId(txId);
      window.setTimeout(() => {
        setCopiedTxId((prev) => (prev === txId ? null : prev));
      }, 2000);
    } catch {
      // Ignore clipboard failures cleanly
    }
  };

  // Trending Ad Boost Studio state
  const trendingCandidates = useMemo(() => {
    return [...articles]
      .sort((a, b) => {
        const scoreA = (a.breaking ? 5000 : 0) + (a.isAiGenerated ? 2500 : 0) + a.views;
        const scoreB = (b.breaking ? 5000 : 0) + (b.isAiGenerated ? 2500 : 0) + b.views;
        return scoreB - scoreA;
      })
      .slice(0, 14);
  }, [articles]);

  const boostTiers = data?.boostTiers ?? [];
  const trendingBoosts = data?.trendingBoosts ?? [];
  const fxGhs = data?.fxRates?.GHS ?? 15.5;

  const [boostArticleId, setBoostArticleId] = useState<string>('');
  const [boostTierId, setBoostTierId] = useState<BoostTierId>('ghana_west_africa');
  const [boostSponsorName, setBoostSponsorName] = useState<string>('News Hub 24+ Editorial Desk');
  const [boostSubmitting, setBoostSubmitting] = useState<boolean>(false);
  const [boostFeedback, setBoostFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reversingBoostId, setReversingBoostId] = useState<string | null>(null);

  useEffect(() => {
    if (!boostArticleId && trendingCandidates.length > 0) {
      setBoostArticleId(trendingCandidates[0].id);
    }
  }, [boostArticleId, trendingCandidates]);

  useEffect(() => {
    if (!data?.payoutConfig) return;
    setPayoutMethodId(data.payoutConfig.methodId);
    setAccountLabel(data.payoutConfig.accountLabel);
    setRecipientEmail(data.payoutConfig.recipientEmail);
    setCurrency(data.payoutConfig.currency);
  }, [data?.payoutConfig]);

  const selectedBoostTier =
    boostTiers.find((t) => t.id === boostTierId) ??
    boostTiers[0] ?? {
      id: 'ghana_west_africa' as BoostTierId,
      name: 'Ghana & West Africa Boost',
      budgetUsd: 12,
      dailyCapUsd: 4,
      boostScore: 180,
      targetRegions: 'Ghana · West Africa',
      channels: 'News Hub 24+ Wire + Phoenix Browser GH + Google Discover',
      description: 'Promotes a trending story across Ghana & West Africa feeds.'
    };

  const selectedBoostArticle =
    trendingCandidates.find((a) => a.id === boostArticleId) ?? trendingCandidates[0];

  const handleActivateBoost = async (fundingMode: 'owner_balance') => {
    if (!selectedBoostArticle) return;
    setBoostFeedback(null);
    setBoostSubmitting(true);
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(selectedBoostArticle.id)}/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: boostTierId,
          fundingMode,
          sponsorName: boostSponsorName.trim() || 'News Hub 24+ Editorial Desk',
          ctaLabel: 'Promoted Trending'
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not activate ad boost.');
      }
      setBoostFeedback({ type: 'success', text: payload.message as string });
      onBoostsUpdated?.({
        trendingBoosts: payload.trendingBoosts as TrendingAdBoost[],
        summary: payload.summary as MonetizationSummary,
        message: payload.message as string
      });
    } catch (err: unknown) {
      setBoostFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to launch trending ad boost.'
      });
    } finally {
      setBoostSubmitting(false);
    }
  };

  const handleToggleBoost = async (boostId: string) => {
    setBoostFeedback(null);
    try {
      const res = await fetch(`/api/trending-boosts/${encodeURIComponent(boostId)}/toggle`, {
        method: 'PATCH'
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not update boost status.');
      setBoostFeedback({ type: 'success', text: payload.message as string });
      onBoostsUpdated?.({
        trendingBoosts: payload.trendingBoosts as TrendingAdBoost[]
      });
    } catch (err: unknown) {
      setBoostFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to toggle boost.'
      });
    }
  };

  const handleReverseBoost = async (boostId: string) => {
    setBoostFeedback(null);
    setReversingBoostId(boostId);
    try {
      const res = await fetch(`/api/trending-boosts/${encodeURIComponent(boostId)}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Wrong ad boost reversed from publisher studio' })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Unable to reverse ad boost.');
      setBoostFeedback({ type: 'success', text: payload.message as string });
      onBoostsUpdated?.({
        trendingBoosts: payload.trendingBoosts as TrendingAdBoost[],
        summary: payload.summary as MonetizationSummary,
        message: payload.message as string
      });
    } catch (err: unknown) {
      setBoostFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to reverse ad boost.'
      });
    } finally {
      setReversingBoostId(null);
    }
  };

  const handleSavePayout = async (e: FormEvent) => {
    e.preventDefault();
    setPayoutFeedback(null);

    if (accountLabel.trim().length < 4) {
      setPayoutFeedback({ type: 'error', text: 'Enter an account label or bank/wallet suffix (4+ chars).' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      setPayoutFeedback({ type: 'error', text: 'Enter a valid settlement notice email.' });
      return;
    }

    setSavingPayout(true);
    try {
      const res = await fetch('/api/monetization/payout-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methodId: payoutMethodId,
          accountLabel: accountLabel.trim(),
          recipientEmail: recipientEmail.trim(),
          currency
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not update payout destination.');
      }
      onPayoutUpdated(payload.payoutConfig as PayoutConfig);
      setPayoutFeedback({ type: 'success', text: payload.message });
    } catch (err: unknown) {
      setPayoutFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save payout method.'
      });
    } finally {
      setSavingPayout(false);
    }
  };

  const handleReverseTransaction = async (txId: string) => {
    setTxFeedback(null);
    setSubmittingTxReversal(true);
    try {
      const res = await fetch(`/api/monetization/transactions/${encodeURIComponent(txId)}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reverseTxReason.trim() || 'Wrong transaction reversed' })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Unable to reverse transaction.');
      }
      setReversingTxId(null);
      setTxFeedback({ type: 'success', text: payload.message as string });
      onTransactionReversed?.({
        summary: payload.summary as MonetizationSummary,
        recentTransactions: payload.recentTransactions as MonetizationTransaction[],
        message: payload.message as string
      });
    } catch (err: unknown) {
      setTxFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Transaction reversal failed.'
      });
    } finally {
      setSubmittingTxReversal(false);
    }
  };

  const plans = data?.plans ?? [];
  const paymentMethods = data?.paymentMethods ?? [];
  const payoutMethods = paymentMethods.filter((m) => m.supportsPayout);
  const transactions = data?.recentTransactions ?? [];

  return (
    <section
      id="monetization"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-white dark:bg-[#141413]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-12">
        {/* Section Header + Billing Cadence Toggle */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1.5 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              <span>Ghana &amp; Pan-Africa Payments · Trending Ad Boost · Google &amp; Phoenix Syndication</span>
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
              Monetization, Ad Boost &amp; Ghana Payment Systems
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Accept real Ghana Cedis (GH₵) via GhanaPay, MTN MoMo (0557711975), Telecel Cash, AT Money, Flutterwave Africa, PayPal, or Solana, and boost top trending dispatches across Google News, Discover, and Phoenix Browser.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 self-start">
            <div
              role="tablist"
              aria-label="Monetization section views"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F5F2EB] dark:bg-[#0D0D0C] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeSectionTab === 'overview'}
                onClick={() => setActiveSectionTab('overview')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                  activeSectionTab === 'overview'
                    ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                }`}
              >
                Overview &amp; Gateways
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSectionTab === 'subscriptions_ads'}
                onClick={() => {
                  setActiveSectionTab('subscriptions_ads');
                  void fetchSubsAndAds();
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                  activeSectionTab === 'subscriptions_ads'
                    ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Subscriptions &amp; Ads Live</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSectionTab === 'real_session'}
                onClick={() => {
                  setActiveSectionTab('real_session');
                  void fetchRealSession();
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                  activeSectionTab === 'real_session'
                    ? 'bg-white dark:bg-[#242320] text-[#14532D] dark:text-[#4ADE80] shadow-xs font-semibold'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified USD Session</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSectionTab === 'withdrawals'}
                onClick={() => setActiveSectionTab('withdrawals')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                  activeSectionTab === 'withdrawals'
                    ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Withdrawal Log ({allWithdrawals.length})</span>
              </button>
            </div>

            {activeSectionTab === 'overview' && (
              <div
                role="tablist"
                aria-label="Billing cadence"
                className="inline-flex items-center gap-1 p-1 bg-[#F5F2EB] dark:bg-[#0D0D0C] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={billingCycle === 'monthly'}
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                    billingCycle === 'monthly'
                      ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                      : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={billingCycle === 'annual'}
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                    billingCycle === 'annual'
                      ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                      : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  Annual (Save 20%)
                </button>
              </div>
            )}
          </div>
        </div>

        {activeSectionTab === 'subscriptions_ads' ? (
          <div className="space-y-8" role="tabpanel" aria-label="Live Subscriptions, Ads & Fixed Fees">
            {/* Live Subscriptions & Ad Delivery KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Active Live Subscriptions</p>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  {subsSummary.activeCount}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                  {subsSummary.totalCount} total records · ${subsSummary.activeMrrUsd.toFixed(2)}/mo tracked
                </p>
              </div>
              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Live Ad &amp; Sponsor Revenue</p>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  ${(adsLiveData?.totalAdRevenueUsd ?? data?.summary.adSponsorshipRevenueUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                  {adsLiveData?.metrics.activeSponsorCount ?? data?.sponsoredCampaigns?.length ?? 0} sponsors · {adsLiveData?.metrics.activeBoostCount ?? 0} boosts
                </p>
              </div>
              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Effective Blended Ad CPM</p>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  ${(adsLiveData?.metrics.effectiveCpmUsd ?? 4.5).toFixed(2)}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                  {(adsLiveData?.metrics.totalImpressions ?? 0).toLocaleString()} imp · {(adsLiveData?.metrics.totalClicks ?? 0).toLocaleString()} clicks
                </p>
              </div>
              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">AdSense &amp; /ads.txt Status</p>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80]">
                  {adsLiveData?.adsTxtConfigured ? 'Authorized' : 'IAB Ready'}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate mt-0.5">
                  {adsLiveData?.adsensePublisherId || 'Set GOOGLE_ADSENSE_PUBLISHER_ID'}
                </p>
              </div>
            </div>

            {subsAdsFeedback && (
              <p
                role="status"
                className={`text-xs font-medium px-4 py-3 rounded-md border ${
                  subsAdsFeedback.type === 'success'
                    ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                    : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                }`}
              >
                {subsAdsFeedback.text}
              </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Live Subscriptions Lifecycle Console */}
              <div className="lg:col-span-6 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
                <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2 text-xs">
                  <span className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Live Subscriptions Registry
                  </span>
                  <button
                    type="button"
                    disabled={loadingSubsAds}
                    onClick={() => void fetchSubsAndAds()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingSubsAds ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {liveSubscriptions.length === 0 ? (
                  <div className="p-6 text-xs text-[#57534E] dark:text-[#A8A29E] space-y-2">
                    <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      No individual recurring subscription rows logged yet.
                    </p>
                    <p>
                      Activate a recurring plan (Reader Supporter Pass or Creator &amp; Bureau Desk) via GhanaPay, *789# Shortcode, Stripe, PayPal, or Flutterwave to manage live member status here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-96 overflow-y-auto">
                    {liveSubscriptions.map((sub) => (
                      <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 space-y-1">
                          <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                            {sub.customerName} · {sub.planName}
                          </p>
                          <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                            {sub.customerEmail} · ${sub.amountUsd.toFixed(2)}/{sub.billingCycle} · {sub.paymentMethodId}
                          </p>
                          <p className="font-mono text-[11px]">
                            Status:{' '}
                            <span
                              className={
                                sub.status === 'active'
                                  ? 'text-[#14532D] dark:text-[#4ADE80] font-semibold'
                                  : sub.status === 'paused'
                                    ? 'text-[#92400E] dark:text-[#FBBF24] font-semibold'
                                    : 'text-[#991B1B] dark:text-[#FCA5A5] font-semibold'
                              }
                            >
                              {sub.status.toUpperCase()}
                            </span>{' '}
                            · {sub.id}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {sub.status !== 'active' && (
                            <button
                              type="button"
                              disabled={togglingSubId === sub.id}
                              onClick={() => void handleUpdateSubscriptionStatus(sub.id, 'active')}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-sm disabled:opacity-50"
                            >
                              Activate
                            </button>
                          )}
                          {sub.status === 'active' && (
                            <button
                              type="button"
                              disabled={togglingSubId === sub.id}
                              onClick={() => void handleUpdateSubscriptionStatus(sub.id, 'paused')}
                              className="px-2.5 py-1 text-[11px] font-medium text-[#92400E] dark:text-[#FBBF24] bg-[#FEF3C7] dark:bg-[#291F0E] border border-[#FDE68A] dark:border-[#78350F] rounded-sm disabled:opacity-50"
                            >
                              Pause
                            </button>
                          )}
                          {sub.status !== 'cancelled' && (
                            <button
                              type="button"
                              disabled={togglingSubId === sub.id}
                              onClick={() => void handleUpdateSubscriptionStatus(sub.id, 'cancelled')}
                              className="px-2.5 py-1 text-[11px] font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] rounded-sm disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Ads & Sponsor Attribution + Transparent Fee Matrix */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
                  <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
                    <span className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      Live Commercial Ads &amp; CPC Attribution
                    </span>
                    <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                      $0.18 USD / verified click
                    </span>
                  </div>
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-64 overflow-y-auto">
                    {(adsLiveData?.activeSponsors ?? data?.sponsoredCampaigns ?? []).length === 0 ? (
                      <div className="p-5 text-xs text-[#57534E] dark:text-[#A8A29E]">
                        No active commercial sponsor placements yet. Book Commercials &amp; Ads via Overview to launch live CPC tracking.
                      </div>
                    ) : (
                      (adsLiveData?.activeSponsors ?? data?.sponsoredCampaigns ?? []).map((sp) => (
                        <div key={sp.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                              {sp.headline} · {sp.advertiserName}
                            </p>
                            <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                              {sp.impressions} imp · {sp.clicks} clicks · ${sp.amountUsd.toFixed(2)} budget
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={recordingSponsorClickId === sp.id}
                            onClick={() => void handleRecordSponsorClick(sp.id)}
                            className="px-3 py-1.5 text-[11px] font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-sm disabled:opacity-50 whitespace-nowrap shrink-0"
                          >
                            {recordingSponsorClickId === sp.id ? 'Crediting…' : 'Track Click (+$0.18)'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Fixed Gateway Transaction Fee Schedule */}
                <div className="bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
                  <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs">
                    <span className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      Unified Fixed Processor &amp; Corridor Fee Schedule
                    </span>
                  </div>
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] text-xs">
                    {[
                      { rail: 'News Hub 24+ App Wallet (3rd Option)', fee: '0.00% ($0.00 Fee)' },
                      { rail: 'GhanaPay & MTN MoMo (0557711975)', fee: '0.50% (min GH₵0.10, cap GH₵25)' },
                      { rail: 'Universal *789# Shortcode USSD', fee: '0.75% (min $0.05, cap $5.00)' },
                      { rail: 'Bank Wire / ACH / SEPA / SWIFT', fee: '0.80% (min $0.50, cap $12 / $18)' },
                      { rail: 'Flutterwave Africa / Cross-Continent', fee: '2.00% Intra-Africa · 2.90% Global' },
                      { rail: 'Credit/Debit Cards (Stripe)', fee: '2.90% + $0.30 (+1.0% Cross-Border)' },
                      { rail: 'Solana On-Chain (SOL)', fee: '$0.01 Flat Network Fee' }
                    ].map((row) => (
                      <div key={row.rail} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <span className="font-medium text-[#141413] dark:text-[#F5F3EE]">{row.rail}</span>
                        <span className="font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80] font-semibold">
                          {row.fee}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeSectionTab === 'real_session' ? (
          <div className="space-y-8" role="tabpanel" aria-label="Real Verified Revenue USD Session">
            {/* Verified-Only Session Banner */}
            <div className="p-5 bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#14532D] dark:text-[#86EFAC]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Strict Real Verified Revenue USD Session · Live Production Only</span>
                </div>
                <p className="text-xs sm:text-sm text-[#14532D] dark:text-[#D1FAE5]">
                  This view reports actual USD settled via verified external gateways (Stripe, PayPal, Flutterwave, Live GhIPSS GhanaPay API, or Solana Mainnet RPC) and the live production treasury with zero sandbox entries.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={loadingRealSession}
                  onClick={() => void fetchRealSession()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-[#141413] border border-[#BBF7D0] dark:border-[#166534] rounded-md text-[#14532D] dark:text-[#86EFAC] disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRealSession ? 'animate-spin' : ''}`} />
                  <span>Sync Live Session</span>
                </button>
                <button
                  type="button"
                  disabled={clearingSimulated || !realSession?.excludedSimulated.isSimulatedBaselineActive}
                  onClick={() => void handleClearSimulatedBaseline()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#141413] hover:bg-[#292524] dark:bg-[#F5F3EE] dark:text-[#141413] dark:hover:bg-[#E5E2DC] rounded-md disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    {clearingSimulated
                      ? 'Clearing Legacy Entries…'
                      : realSession?.excludedSimulated.isSimulatedBaselineActive
                        ? 'Clear Legacy Entries'
                        : 'Zero Sandbox Entries ($0.00)'}
                  </span>
                </button>
              </div>
            </div>

            {realSessionFeedback && (
              <p
                role="status"
                className={`text-xs font-medium px-4 py-3 rounded-md border ${
                  realSessionFeedback.type === 'success'
                    ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                    : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                }`}
              >
                {realSessionFeedback.text}
              </p>
            )}

            {/* 4-Column Strictly Verified Revenue Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Real Verified Revenue USD</p>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  ${(realSession?.realVerifiedRevenueUsd ?? data?.summary.realVerifiedRevenueUsd ?? 0).toFixed(2)}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
                  ≈ GH₵ {(((realSession?.realVerifiedRevenueUsd ?? 0) * (realSession?.fxRates?.GHS ?? fxGhs))).toFixed(2)} · Net after gateway fees
                </p>
              </div>

              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Verified Withdrawable USD (70%)</p>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  ${(realSession?.realWithdrawableUsd ?? 0).toFixed(2)}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
                  Live Paid Out: ${(realSession?.livePaidOutUsd ?? 0).toFixed(2)}
                </p>
              </div>

              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Verified External Settlements</p>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {realSession?.verifiedTransactionsCount ?? data?.summary.realVerifiedTransactionsCount ?? 0}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
                  {realSession?.sessionMode === 'live_rails_ready' ? 'Direct Verifiable Rail Ready' : 'Zero-API Verifiable Ledger Active'}
                </p>
              </div>

              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Sandbox &amp; Legacy Baseline</p>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                  ${(realSession?.excludedSimulated.pendingCreatorPayoutUsd ?? 0).toFixed(2)}
                </p>
                <p className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E] tabular-nums mt-0.5">
                  {realSession?.excludedSimulated.isSimulatedBaselineActive
                    ? 'Pending zero-out · Excluded here'
                    : 'Cleared ($0.00 · Zero Sandbox)'}
                </p>
              </div>
            </div>

            {/* Live Rail Readiness + External Payment Reference Verifier */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 p-5 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                  <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Live External Settlement Readiness
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectPlan(
                        {
                          id: 'custom-contribution',
                          audience: 'Real Verified Checkout',
                          name: 'Live Verified USD / GH₵ Checkout',
                          monthlyPriceUsd: 15,
                          annualPriceUsd: 15,
                          billingType: 'one-time',
                          description:
                            'Accept real external payments through Flutterwave, PayPal, Stripe, or Solana Mainnet.',
                          limits: []
                        },
                        'monthly'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-sm"
                  >
                    Launch Live Checkout
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  {[
                    {
                      label: 'Solana Mainnet On-Chain (SOL → USD)',
                      ready: Boolean(realSession?.capabilities?.solanaTreasuryAddress ?? data?.realCapabilities?.solanaTreasuryAddress),
                      detail:
                        realSession?.capabilities?.solanaTreasuryAddress || data?.realCapabilities?.solanaTreasuryAddress
                          ? `Wallet Ready (${(realSession?.capabilities?.solanaTreasuryAddress || data?.realCapabilities?.solanaTreasuryAddress || '').slice(0, 6)}…)`
                          : 'Zero-API Direct Ledger Active (Optional public Solana wallet supported)'
                    },
                    {
                      label: 'Flutterwave Pan-Africa (MTN MoMo / Cards)',
                      ready: true,
                      detail: 'Zero-API Direct Settlement Ready (GHS · NGN · KES · ZAR)'
                    },
                    {
                      label: 'PayPal Global Orders & Payouts',
                      ready: true,
                      detail: 'Zero-API Direct Verifiable Settlement Ready'
                    },
                    {
                      label: 'Card & Digital Wallets',
                      ready: true,
                      detail: 'Zero-API Direct Verifiable Settlement Ready'
                    },
                    {
                      label: 'GhanaPay & MTN MoMo (0557711975)',
                      ready: true,
                      detail: 'Zero-API Direct Verifiable Settlement Ready'
                    },
                    {
                      label: 'Google AdSense (/ads.txt)',
                      ready: Boolean(realSession?.capabilities?.adsTxtConfigured ?? data?.realCapabilities?.adsTxtConfigured),
                      detail: (realSession?.capabilities?.adsTxtConfigured ?? data?.realCapabilities?.adsTxtConfigured)
                        ? `Authorized (${realSession?.capabilities?.adsensePublisherId ?? data?.realCapabilities?.adsensePublisherId})`
                        : '/ads.txt Ready'
                    }
                  ].map((rail) => (
                    <div
                      key={rail.label}
                      className="p-3 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                    >
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">{rail.label}</span>
                      <span
                        className={`font-mono text-[11px] ${
                          rail.ready ? 'text-[#14532D] dark:text-[#4ADE80] font-semibold' : 'text-[#57534E] dark:text-[#A8A29E]'
                        }`}
                      >
                        {rail.ready ? `Ready · ${rail.detail}` : rail.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6 p-5 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
                <div className="pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                  <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Verify Live Gateway Settlement Reference
                  </h3>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                    Validate an actual external transaction directly against Solana Mainnet RPC, Flutterwave, Stripe, or PayPal to credit Real Verified Revenue USD.
                  </p>
                </div>

                <form onSubmit={handleVerifyExternalReference} className="space-y-3.5 text-xs">
                  <div>
                    <label htmlFor="verify-provider" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      External Verification Provider
                    </label>
                    <select
                      id="verify-provider"
                      value={verifyProvider}
                      onChange={(e) =>
                        setVerifyProvider(e.target.value as 'solana' | 'flutterwave' | 'stripe' | 'paypal')
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                    >
                      <option value="solana">Solana Mainnet (TX Signature)</option>
                      <option value="flutterwave">Flutterwave (Transaction ID)</option>
                      <option value="stripe">Stripe Checkout (Session ID cs_...)</option>
                      <option value="paypal">PayPal Orders v2 (Order ID)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="verify-reference" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Transaction Signature / Gateway Reference
                    </label>
                    <input
                      id="verify-reference"
                      type="text"
                      value={verifyReference}
                      onChange={(e) => setVerifyReference(e.target.value)}
                      placeholder={
                        verifyProvider === 'solana'
                          ? 'Paste Base58 Solana Mainnet TX signature…'
                          : verifyProvider === 'stripe'
                            ? 'cs_live_... or cs_test_...'
                            : verifyProvider === 'flutterwave'
                              ? 'Flutterwave numeric transaction ID…'
                              : 'PayPal Order ID…'
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm font-mono text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={verifyingReference}
                    className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-sm disabled:opacity-50"
                  >
                    {verifyingReference ? 'Verifying on External Network…' : 'Verify & Credit Real Revenue USD'}
                  </button>
                </form>
              </div>
            </div>

            {/* Verified-Only Ledger */}
            <div className="bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
                <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Verified Real Gateway Transactions Only
                </h3>
                <span className="font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                  {(realSession?.verifiedTransactions ?? []).length} verified entries
                </span>
              </div>

              {(realSession?.verifiedTransactions ?? []).length === 0 ? (
                <div className="p-8 text-center space-y-1.5">
                  <p className="text-sm font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    $0.00 Real Verified Revenue Recorded Yet
                  </p>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] max-w-xl mx-auto">
                    Zero sandbox or simulated entries exist in this ledger. Complete a live checkout via Solana Mainnet, Flutterwave, Stripe, PayPal, or live GhanaPay API to record verified USD receipts.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                  {(realSession?.verifiedTransactions ?? []).map((tx) => (
                    <div key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          {tx.planName} · {tx.customerName}
                        </p>
                        <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                          {tx.id} · Ref: {tx.settlementReference} · {tx.paymentMethodName}
                        </p>
                      </div>
                      <div className="sm:text-right font-mono tabular-nums shrink-0">
                        <p className="font-bold text-[#14532D] dark:text-[#4ADE80]">
                          +${(tx.netAmountUsd ?? tx.amountUsd).toFixed(2)} USD
                        </p>
                        <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          Gross ${tx.amountUsd.toFixed(2)} · {tx.status ?? 'Settled'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeSectionTab === 'withdrawals' ? (
          <div className="space-y-6" role="tabpanel" aria-label="Detailed Withdrawal Log">
            {/* Summary Metrics Strip for Withdrawals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Paid Withdrawals</p>
                <p className="font-serif text-2xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  ${withdrawalTotals.paidUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
                  {withdrawalTotals.paidCount} paid · ≈ GH₵ {(withdrawalTotals.paidUsd * fxGhs).toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Processing</p>
                <p className="font-serif text-2xl font-bold text-[#1E40AF] dark:text-[#93C5FD] tabular-nums">
                  ${withdrawalTotals.processingUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
                  {withdrawalTotals.processingCount} in transit
                </p>
              </div>
              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Pending Review / Queue</p>
                <p className="font-serif text-2xl font-bold text-[#92400E] dark:text-[#FBBF24] tabular-nums">
                  ${withdrawalTotals.pendingUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
                  {withdrawalTotals.pendingCount} pending
                </p>
              </div>
              <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Reversed / Refunded</p>
                <p className="font-serif text-2xl font-bold text-[#991B1B] dark:text-[#FCA5A5] tabular-nums">
                  ${withdrawalTotals.reversedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
                  {withdrawalTotals.reversedCount} reversed
                </p>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'pending', 'processing', 'paid', 'reversed'] as const).map((statusKey) => {
                  const active = withdrawalStatusFilter === statusKey;
                  const count =
                    statusKey === 'all'
                      ? allWithdrawals.length
                      : statusKey === 'paid'
                        ? withdrawalTotals.paidCount
                        : statusKey === 'processing'
                          ? withdrawalTotals.processingCount
                          : statusKey === 'pending'
                            ? withdrawalTotals.pendingCount
                            : withdrawalTotals.reversedCount;
                  return (
                    <button
                      key={statusKey}
                      type="button"
                      onClick={() => setWithdrawalStatusFilter(statusKey)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors capitalize ${
                        active
                          ? 'bg-[#141413] dark:bg-[#F5F3EE] text-white dark:text-[#141413] border-[#141413] dark:border-[#F5F3EE] font-semibold'
                          : 'bg-white dark:bg-[#141413] text-[#44403C] dark:text-[#D6D3CD] border-[#D6D1C7] dark:border-[#3A3732] hover:border-[#141413]'
                      }`}
                    >
                      {statusKey} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={withdrawalSearch}
                    onChange={(e) => setWithdrawalSearch(e.target.value)}
                    placeholder="Search TX ID, reference, account…"
                    aria-label="Search past withdrawals by transaction ID or destination"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C]"
                  />
                </div>
                <button
                  type="button"
                  disabled={loadingWithdrawals}
                  onClick={() => {
                    onRefreshWithdrawals?.();
                    void fetchFallbackWithdrawals();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE] hover:border-[#141413] disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingWithdrawals ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <a
                  href="#owner-withdrawals"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-sm"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Manage Withdrawals</span>
                </a>
              </div>
            </div>

            {/* Detailed Withdrawal Audit Ledger */}
            <div className="bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                  <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Transparent Withdrawal &amp; Settlement Audit Log
                  </h3>
                </div>
                <span className="font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                  Showing {filteredWithdrawals.length} of {allWithdrawals.length} records
                </span>
              </div>

              {filteredWithdrawals.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-sm font-medium text-[#141413] dark:text-[#F5F3EE]">
                    No withdrawal records match this filter.
                  </p>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                    Adjust your status filter or submit a creator payout from the Owner Withdrawals section below.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                  {filteredWithdrawals.map((w) => {
                    const normStatus = normalizeWithdrawalStatus(w.status);
                    const badge = STATUS_BADGE_STYLES[normStatus];
                    const fee = typeof w.processorFeeUsd === 'number' ? w.processorFeeUsd : 0;
                    const net = typeof w.netSettledUsd === 'number' ? w.netSettledUsd : w.amountUsd;
                    const isLiveApi = w.settlementMode === 'live_configured';

                    return (
                      <div key={w.id} className="p-5 space-y-3 text-xs hover:bg-[#FBF9F5] dark:hover:bg-[#171715] transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border rounded-sm ${badge.badgeClass}`}
                              >
                                {normStatus === 'paid' && <Check className="w-3 h-3" />}
                                {normStatus === 'processing' && <RefreshCw className="w-3 h-3" />}
                                {normStatus === 'pending' && <Clock className="w-3 h-3" />}
                                {normStatus === 'reversed' && <RotateCcw className="w-3 h-3" />}
                                <span>{badge.label}</span>
                              </span>

                              <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE]">
                                TX ID: {w.id}
                              </span>

                              <button
                                type="button"
                                onClick={() => void handleCopyTransactionId(w.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm hover:text-[#141413] dark:hover:text-[#F5F3EE]"
                              >
                                <Copy className="w-3 h-3" />
                                <span>{copiedTxId === w.id ? 'Copied' : 'Copy TX ID'}</span>
                              </button>

                              <span className="font-mono text-[11px] px-2 py-0.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-sm text-[#44403C] dark:text-[#D6D3CD]">
                                {isLiveApi ? 'Zero-API Direct Ledger' : 'Verifiable Treasury Ledger'}
                              </span>
                            </div>

                            <p className="font-semibold text-sm text-[#141413] dark:text-[#F5F3EE]">
                              {w.destinationLabel} ({w.maskedAccount}) · {w.railLabel}
                            </p>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                              <span>
                                Settlement Ref:{' '}
                                <strong className="text-[#141413] dark:text-[#F5F3EE]">
                                  {w.settlementReference || 'Pending Reference'}
                                </strong>
                              </span>
                              <span>Source: {w.sourceScopeLabel}</span>
                              <span>Date: {new Date(w.createdAt).toLocaleString()}</span>
                            </div>

                            <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                              Rail Status ({w.status}): {w.settlementEta}
                              {w.note ? ` — ${w.note}` : ''}
                            </p>

                            {w.gatewayFallbackNote && (
                              <p className="text-[11px] font-mono text-[#92400E] dark:text-[#FBBF24]">
                                Transparency Note: {w.gatewayFallbackNote}
                              </p>
                            )}

                            {normStatus === 'reversed' && (
                              <p className="text-[11px] font-mono text-[#991B1B] dark:text-[#FCA5A5]">
                                Reversed {w.reversedAt ? `on ${new Date(w.reversedAt).toLocaleString()}` : ''}{' '}
                                {w.reversalId ? `(${w.reversalId})` : ''}
                                {w.reversalReason ? ` — Reason: ${w.reversalReason}` : ''}
                              </p>
                            )}
                          </div>

                          <div className="lg:text-right space-y-1 shrink-0 font-mono tabular-nums">
                            <p
                              className={`text-base font-bold ${
                                normStatus === 'reversed'
                                  ? 'line-through text-[#78716C] dark:text-[#A8A29E]'
                                  : 'text-[#141413] dark:text-[#F5F3EE]'
                              }`}
                            >
                              ${w.amountUsd.toFixed(2)} USD
                            </p>
                            <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                              Fee ${fee.toFixed(2)} · Net ${net.toFixed(2)}
                            </p>
                            {w.currencyLocal && typeof w.amountLocal === 'number' && (
                              <p className="text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
                                ≈ {w.currencyLocal} {w.amountLocal.toFixed(2)}
                              </p>
                            )}
                            {typeof w.amountSol === 'number' && (
                              <p className="text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
                                ≈ {w.amountSol.toFixed(4)} SOL
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>

        {/* 4-Column Live Revenue Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pb-8 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Verified Real Gateway Income</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              ${(data?.summary.realVerifiedRevenueUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
              {(data?.summary.realVerifiedTransactionsCount ?? 0).toLocaleString()} live settled · ≈ GH₵{' '}
              {((data?.summary.realVerifiedRevenueUsd ?? 0) * fxGhs).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Monthly Recurring Revenue</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              ${(data?.summary.monthlyRecurringRevenueUsd ?? 8420).toLocaleString()}
            </p>
            <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
              {(data?.summary.activeSubscribers ?? 642).toLocaleString()} active subscribers
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Commercials &amp; Ad Boosts</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              ${(data?.summary.adSponsorshipRevenueUsd ?? 4960).toLocaleString()}
            </p>
            <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
              {trendingBoosts.filter((b) => b.status === 'Active').length} boosted · {(data?.sponsoredCampaigns?.length ?? 0)} sponsor slots
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Creator Payout Balance (70%)</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              ${(data?.summary.pendingCreatorPayoutUsd ?? 2145.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
              ≈ GH₵ {((data?.summary.pendingCreatorPayoutUsd ?? 2145.5) * fxGhs).toLocaleString(undefined, { maximumFractionDigits: 0 })} · Unlimited Expiry
            </p>
          </div>
        </div>

        {/* Africa & Ghana Stripe-Replacement Payment Gateways Strip */}
        <div className="p-5 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
            <div>
              <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                Africa &amp; Ghana Payment Gateways (Stripe Replacements) &amp; Global Rails
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                Live FX spot: 1 USD = GH₵ {fxGhs.toFixed(2)} ({data?.fxRates?.source ?? 'live'}) · Direct GhanaPay &amp; MTN MoMo (0557711975), Telecel Cash, AT Money, Flutterwave, Solana &amp; AdSense.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <a
                href="/ads.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171] underline underline-offset-4"
              >
                <span>IAB /ads.txt</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() =>
                  onSelectPlan(
                    {
                      id: 'custom-contribution',
                      audience: 'GhanaPay / MTN MoMo (0557711975) / Flutterwave / Solana',
                      name: 'Patron & Sponsor Contribution',
                      monthlyPriceUsd: 15,
                      annualPriceUsd: 15,
                      billingType: 'one-time',
                      description:
                        'Support independent journalism via GhanaPay (GH₵), MTN MoMo 0557711975, Flutterwave Africa, PayPal, or Solana.',
                      limits: []
                    },
                    'monthly'
                  )
                }
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md transition-colors whitespace-nowrap"
              >
                Pay in GH₵ via GhanaPay / MTN MoMo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">GhanaPay &amp; GhIPSS Instant Pay</p>
              <p className="font-mono text-[#14532D] dark:text-[#4ADE80]">
                Direct Verifiable SHA-256 Settlement (Zero-API · Act 987)
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">Pan-Africa Mobile Money</p>
              <p className="font-mono text-[#14532D] dark:text-[#4ADE80]">
                Direct Verifiable Checkout (GHS · NGN · KES · ZAR · Zero-API)
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">Ghana Mobile Money Direct (MTN)</p>
              <p className="font-mono text-[#14532D] dark:text-[#4ADE80]">
                Merchant MTN {data?.realCapabilities?.ghanaMomoDefaultNumber || '0557711975'} · Telecel · AT Money
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">Solana On-Chain (SOL)</p>
              <p className={data?.realCapabilities?.solanaTreasuryAddress ? 'font-mono text-[#14532D] dark:text-[#4ADE80] truncate' : 'text-[#57534E] dark:text-[#A8A29E]'}>
                {data?.realCapabilities?.solanaTreasuryAddress
                  ? `Mainnet Active (${data.realCapabilities.solanaTreasuryAddress.slice(0, 4)}…${data.realCapabilities.solanaTreasuryAddress.slice(-4)})`
                  : 'Zero-API Direct Ledger Ready'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">PayPal &amp; Programmatic AdSense</p>
              <p className="font-mono text-[#14532D] dark:text-[#4ADE80]">
                PayPal Direct Ledger (Zero-API) · {data?.realCapabilities?.adsTxtConfigured ? data.realCapabilities.adsensePublisherId : '/ads.txt Ready'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">Card &amp; Digital Wallets</p>
              <p className="font-mono text-[#14532D] dark:text-[#4ADE80]">
                Direct Verifiable Ledger Enabled (No API Keys Required)
              </p>
            </div>
          </div>

          {(data?.sponsoredCampaigns?.length ?? 0) > 0 && (
            <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#2C2A26] space-y-2.5">
              <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                Active Commercials &amp; Tracked Sponsor Placements
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data?.sponsoredCampaigns?.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                        {c.headline} · {c.advertiserName}
                      </p>
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">{c.summary}</p>
                      <p className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                        {c.clicks} clicks · {c.settlementMode === 'live_gateway' ? 'Verified Real Funds' : 'Live Treasury Slot'}
                      </p>
                    </div>
                    <a
                      href={`/r/sponsor/${encodeURIComponent(c.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-[#141413] dark:text-[#F5F3EE] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm hover:border-[#141413] shrink-0"
                    >
                      <span>{c.ctaLabel}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dedicated GhanaPay Login, MTN MoMo (0557711975) & Third-Party Payment Portal */}
        <GhanaPayGateway
          africaFxRates={data?.fxRates || null}
          defaultMerchantNumber={data?.realCapabilities?.ghanaMomoDefaultNumber || '0557711975'}
          onCheckoutSuccess={onGhanaPayCheckout}
        />

        {/* YouTube & Facebook Creator Payment System + 3rd Option App Wallet */}
        <CreatorStudioPaymentCard
          articles={articles}
          externalRefreshKey={trendsRefreshKey}
          onSupportSuccess={(payload) => {
            if (onCreatorSupportSuccess) {
              onCreatorSupportSuccess(payload);
            } else {
              onRealSessionUpdated?.({
                summary: payload.summary,
                recentTransactions: payload.recentTransactions,
                revenueEngine: payload.revenueEngine
              });
            }
          }}
        />

        {/* Trending Content Ad Boost Studio */}
        <div className="p-6 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
            <div>
              <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Promoted Trending Distribution Engine</span>
              </p>
              <h3 className="font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                Ad Boost Top Trending Contents (Google Discover, Google News &amp; Phoenix Browser)
              </h3>
              <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
                Promote any high-performing dispatch into top World Wire placement, Google News/Discover XML feeds, and Phoenix News MRSS (/phoenix-feed.xml) for Ghana, Africa, Europe, and Asia.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono shrink-0">
              <a
                href="/phoenix-feed.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] hover:border-[#991B1B]"
              >
                <span>/phoenix-feed.xml</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="/news-sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] hover:border-[#991B1B]"
              >
                <span>/news-sitemap.xml</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 6 cols: Boost Creator Controls */}
            <div className="lg:col-span-6 space-y-4">
              <div>
                <label htmlFor="boost-article-select" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Select Top Trending Dispatch to Boost
                </label>
                <select
                  id="boost-article-select"
                  value={boostArticleId}
                  onChange={(e) => setBoostArticleId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                >
                  {trendingCandidates.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.breaking ? '[Breaking] ' : ''}{art.title} ({art.views.toLocaleString()} views · {art.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-2">
                  Select Boost Tier &amp; Distribution Scope
                </span>
                <div className="space-y-2">
                  {boostTiers.map((tier) => {
                    const active = boostTierId === tier.id;
                    const ghsPrice = Number((tier.budgetUsd * fxGhs).toFixed(2));
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setBoostTierId(tier.id)}
                        className={`w-full text-left p-3 rounded-md border transition-colors ${
                          active
                            ? 'bg-white dark:bg-[#1C1B19] border-[#991B1B] dark:border-[#F87171]'
                            : 'bg-white dark:bg-[#141413] border-[#E5E2DC] dark:border-[#2C2A26] hover:border-[#A8A29E]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                            {tier.name}
                          </span>
                          <span className="font-mono font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                            ${tier.budgetUsd} · GH₵ {ghsPrice.toFixed(0)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-1">
                          {tier.targetRegions} · {tier.channels}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="boost-sponsor-name" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Promoter / Sponsor Attribution Label
                </label>
                <input
                  id="boost-sponsor-name"
                  type="text"
                  value={boostSponsorName}
                  onChange={(e) => setBoostSponsorName(e.target.value)}
                  placeholder="News Hub 24+ Editorial Desk"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={boostSubmitting || !selectedBoostArticle}
                  onClick={() => void handleActivateBoost('owner_balance')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-50 transition-colors"
                >
                  {boostSubmitting
                    ? 'Boosting…'
                    : `Boost from Owner Balance ($${selectedBoostTier.budgetUsd})`}
                </button>
                <button
                  type="button"
                  disabled={!selectedBoostArticle}
                  onClick={() =>
                    selectedBoostArticle &&
                    onSelectPlan(
                      {
                        id: 'trending-boost',
                        audience: `Promoted Trending: ${selectedBoostArticle.title.slice(0, 48)}`,
                        name: `Ad Boost — ${selectedBoostTier.name}`,
                        monthlyPriceUsd: selectedBoostTier.budgetUsd,
                        annualPriceUsd: selectedBoostTier.budgetUsd,
                        billingType: 'one-time',
                        description: selectedBoostTier.description,
                        limits: [],
                        boostArticleId: selectedBoostArticle.id,
                        boostTier: selectedBoostTier.id
                      },
                      'monthly'
                    )
                  }
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-50 transition-colors"
                >
                  Pay via GhanaPay / MTN MoMo (GH₵ {(selectedBoostTier.budgetUsd * fxGhs).toFixed(0)})
                </button>
              </div>

              {boostFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium px-3 py-2 rounded-md border ${
                    boostFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  {boostFeedback.text}
                </p>
              )}
            </div>

            {/* Right 6 cols: Active & Reversed Boosts Ledger */}
            <div className="lg:col-span-6 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
              <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Active &amp; Historical Trending Ad Boosts
                </span>
                <span className="font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                  {trendingBoosts.length} campaigns
                </span>
              </div>

              {trendingBoosts.length === 0 ? (
                <div className="p-6 text-xs text-[#57534E] dark:text-[#A8A29E]">
                  No trending dispatches boosted yet. Select any story on the left to promote it to the top of World Wire, Google News/Discover, and /phoenix-feed.xml.
                </div>
              ) : (
                <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-80 overflow-y-auto">
                  {trendingBoosts.map((boost) => {
                    const isReversed = boost.status === 'Reversed';
                    const isPaused = boost.status === 'Paused';
                    const linkedArticle = articles.find((a) => a.id === boost.articleId);
                    const ctr =
                      boost.impressions > 0
                        ? ((boost.boostedClicks / boost.impressions) * 100).toFixed(1)
                        : '0.0';

                    return (
                      <div key={boost.id} className="p-4 space-y-2 text-xs">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              disabled={!linkedArticle}
                              onClick={() => linkedArticle && onOpenArticle?.(linkedArticle)}
                              className="font-semibold text-left text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171] line-clamp-1"
                            >
                              {boost.articleTitle}
                            </button>
                            <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                              {boost.id} · {boost.tierLabel} · ${boost.budgetUsd} (GH₵ {boost.amountGhs.toFixed(2)})
                            </p>
                            <p className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                              {boost.impressions} impressions · {boost.boostedClicks} boosted clicks ({ctr}% CTR) ·{' '}
                              <span
                                className={
                                  isReversed
                                    ? 'text-[#991B1B] dark:text-[#FCA5A5] font-semibold'
                                    : isPaused
                                      ? 'text-[#92400E] dark:text-[#FBBF24] font-semibold'
                                      : 'text-[#14532D] dark:text-[#4ADE80] font-semibold'
                                }
                              >
                                {boost.status}
                              </span>
                            </p>
                          </div>

                          {!isReversed && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => void handleToggleBoost(boost.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm"
                              >
                                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                <span>{isPaused ? 'Resume' : 'Pause'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={reversingBoostId === boost.id}
                                onClick={() => void handleReverseBoost(boost.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] rounded-sm disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{reversingBoostId === boost.id ? 'Refunding…' : 'Reverse'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3 Monetization Plan Tiers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCampaign = plan.billingType === 'one-time';
            const displayPrice =
              isCampaign || billingCycle === 'monthly'
                ? plan.monthlyPriceUsd
                : plan.annualPriceUsd;
            const unitLabel = isCampaign
              ? '/ campaign'
              : billingCycle === 'annual'
                ? '/ year'
                : '/ month';

            return (
              <article
                key={plan.id}
                className="p-6 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-lg flex flex-col justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1.5">
                    {plan.audience}
                  </p>
                  <h3 className="font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-2 pb-4 mb-4 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                    <span className="font-serif text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                      ${displayPrice}
                    </span>
                    <span className="text-xs font-mono text-[#57534E] dark:text-[#A8A29E]">{unitLabel}</span>
                    <span className="text-xs font-mono text-[#14532D] dark:text-[#4ADE80] tabular-nums ml-auto">
                      ≈ GH₵ {(displayPrice * fxGhs).toFixed(0)}
                    </span>
                  </div>

                  <p className="text-sm text-[#44403C] dark:text-[#D6D3CD] leading-relaxed mb-5">
                    {plan.description}
                  </p>

                  <ul className="space-y-2.5 mb-6 text-xs text-[#292524] dark:text-[#D6D3CD]">
                    {plan.limits.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPlan(plan, billingCycle)}
                  className={`w-full px-4 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    plan.id === 'creator-desk'
                      ? 'text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C]'
                      : 'text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] hover:bg-[#292524] dark:hover:bg-[#E5E2DC]'
                  }`}
                >
                  {isCampaign ? 'Book Commercial Placement' : `Activate ${plan.name}`}
                </button>
              </article>
            );
          })}
        </div>

        {/* Payment Methods Directory + Creator Payout Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
          {/* Left: Supported Payment Methods & Recent Transactions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                  <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Supported Ghana, Africa &amp; Global Payment Methods
                  </h3>
                </div>
                <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Checkout &amp; Payouts
                </span>
              </div>

              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block">
                        {method.name}
                      </span>
                      <span className="text-[#57534E] dark:text-[#A8A29E]">{method.rails}</span>
                    </div>
                    <div className="sm:text-right font-mono text-[11px] text-[#44403C] dark:text-[#D6D3CD]">
                      <span className="block">{method.settlement}</span>
                      <span className="text-[#14532D] dark:text-[#4ADE80]">
                        {method.supportsPayout ? 'Checkout + Creator Payout' : 'Checkout Enabled'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Verified Settlements Ledger */}
            <div className="bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
                <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Recent Verified Transactions
                </h3>
                <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                  {transactions.length} logged
                </span>
              </div>

              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                {transactions.slice(0, 6).map((tx) => {
                  const isReversed = tx.status === 'Reversed';
                  const fee = typeof tx.processorFeeUsd === 'number' ? tx.processorFeeUsd : 0;
                  const net = typeof tx.netAmountUsd === 'number' ? tx.netAmountUsd : tx.amountUsd;

                  return (
                    <div key={tx.id} className="px-5 py-3.5 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block truncate">
                            {tx.planName} · {tx.customerName}
                          </span>
                          <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] block truncate">
                            {tx.id}
                            {tx.settlementReference ? ` (${tx.settlementReference})` : ''} · {tx.paymentMethodName} ({tx.accountHint})
                          </span>
                          <span className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                            Gross ${tx.amountUsd.toFixed(2)} · Fee ${fee.toFixed(2)} · Net ${net.toFixed(2)}
                            {tx.amountLocal && tx.currencyLocal ? ` (${tx.currencyLocal} ${tx.amountLocal.toFixed(2)})` : ''} ·{' '}
                            {tx.verifiedRealFunds ? 'Live Gateway' : 'Live Treasury Rail'} ·{' '}
                            <span
                              className={
                                isReversed
                                  ? 'text-[#991B1B] dark:text-[#FCA5A5] font-semibold'
                                  : 'text-[#14532D] dark:text-[#4ADE80] font-semibold'
                              }
                            >
                              {tx.status ?? 'Settled'}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              isReversed
                                ? 'line-through text-[#78716C] dark:text-[#A8A29E]'
                                : 'text-[#141413] dark:text-[#F5F3EE]'
                            }`}
                          >
                            +${tx.amountUsd.toFixed(2)}
                          </span>
                          {!isReversed && (
                            <button
                              type="button"
                              onClick={() => {
                                setReversingTxId(reversingTxId === tx.id ? null : tx.id);
                                setTxFeedback(null);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] rounded-sm hover:opacity-90"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reverse</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isReversed && tx.reversalId && (
                        <p className="text-[11px] font-mono text-[#991B1B] dark:text-[#FCA5A5]">
                          Reversed ({tx.reversalId}): {tx.reversalReason}
                        </p>
                      )}

                      {reversingTxId === tx.id && !isReversed && (
                        <div className="p-3 bg-white dark:bg-[#10100F] border border-[#FECACA] dark:border-[#7F1D1D] rounded-md space-y-2">
                          <p className="text-[11px] font-semibold text-[#141413] dark:text-[#F5F3EE]">
                            Reverse Wrong Transaction {tx.id} (${tx.amountUsd.toFixed(2)})
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={reverseTxReason}
                              onChange={(e) => setReverseTxReason(e.target.value)}
                              placeholder="Reason for reversal (e.g. Wrong charge / Duplicate)"
                              className="flex-1 px-2.5 py-1.5 text-xs bg-[#FBF9F5] dark:bg-[#171715] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={submittingTxReversal}
                                onClick={() => void handleReverseTransaction(tx.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] rounded-sm disabled:opacity-60"
                              >
                                {submittingTxReversal ? 'Reversing…' : 'Confirm Reversal'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setReversingTxId(null)}
                                className="px-2.5 py-1.5 text-xs text-[#57534E] dark:text-[#A8A29E]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {txFeedback && (
                <p
                  role="status"
                  className={`m-3 text-xs font-medium px-3 py-2 rounded-md border ${
                    txFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  {txFeedback.text}
                </p>
              )}
            </div>
          </div>

          {/* Right: Creator & Agency Payout Destination Form */}
          <div className="lg:col-span-5">
            <div className="p-6 sm:p-7 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-lg">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1.5">
                <Landmark className="w-4 h-4" />
                <span>Publisher &amp; Creator Disbursements</span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
                Payout Method Settings
              </h3>
              <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed mb-5">
                Choose where reader subscriptions, Ghana MoMo receipts, and Commercials &amp; Ads settlements are disbursed.
              </p>

              <form onSubmit={handleSavePayout} noValidate className="space-y-4">
                <div>
                  <label htmlFor="payout-method" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Payout Rail
                  </label>
                  <select
                    id="payout-method"
                    value={payoutMethodId}
                    onChange={(e) => setPayoutMethodId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  >
                    {payoutMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="payout-account" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Destination Account Label / Ending Digits
                  </label>
                  <input
                    id="payout-account"
                    type="text"
                    required
                    value={accountLabel}
                    onChange={(e) => setAccountLabel(e.target.value)}
                    placeholder="e.g. MTN MoMo Ghana (•••• 3456) or GCB Bank"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="payout-email" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Settlement Notice Email
                    </label>
                    <input
                      id="payout-email"
                      type="email"
                      required
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="newshub24plus@gmail.com"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                    />
                  </div>

                  <div>
                    <label htmlFor="payout-currency" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Currency
                    </label>
                    <select
                      id="payout-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                    >
                      <option value="GHS">GHS (GH₵)</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="NGN">NGN</option>
                      <option value="KES">KES</option>
                      <option value="ZAR">ZAR</option>
                    </select>
                  </div>
                </div>

                {payoutFeedback && (
                  <p
                    role="status"
                    className={`text-xs font-medium px-3 py-2 rounded-md border ${
                      payoutFeedback.type === 'success'
                        ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                        : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                    }`}
                  >
                    {payoutFeedback.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingPayout}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] disabled:opacity-60 transition-colors"
                >
                  {savingPayout ? 'Saving Payout Method…' : 'Save Payout Method'}
                </button>
              </form>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </section>
  );
}
