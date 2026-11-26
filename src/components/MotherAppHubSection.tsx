import {
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  CreditCard,
  Database,
  ExternalLink,
  Globe,
  Landmark,
  Link2,
  RefreshCw,
  Search,
  Wallet
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  auth,
  loadMotherAppRevenueEventsFromFirestore,
  syncMotherAppConnectionToFirestore,
  syncMotherAppRevenueEventToFirestore
} from '../lib/firebase';
import type { OwnerWithdrawalMethod } from './OwnerWithdrawalSection';

export type MotherAppStreamType =
  | 'sponsored_story_slot'
  | 'reader_traffic_yield'
  | 'subscription_referral'
  | 'reader_tip'
  | 'live_checkout_settlement'
  | 'webhook_event';

export interface MotherAppRevenueEvent {
  id: string;
  motherAppUrl: string;
  storyId: string;
  streamType: MotherAppStreamType;
  streamLabel: string;
  sourceLabel: string;
  clicksAttributed: number;
  watchSecondsAttributed: number;
  grossUsd: number;
  platformFeeUsd: number;
  creatorNetUsd: number;
  withdrawGhs: number;
  equivalentSol: number;
  settlementMode: 'live_configured' | 'verified_treasury_ledger';
  externalTxRef?: string;
  withdrawalId?: string;
  note: string;
  createdAt: string;
}

export interface MotherAppSummaryResponse {
  connection: {
    motherAppUrl: string;
    motherOrigin: string;
    storyId: string;
    appName: string;
    relationshipRole: 'mother_app';
    connectedAt: string;
    updatedAt: string;
    lastHandshakeAt: string | null;
    lastHandshakeStatus: number | null;
    lastHandshakeOk: boolean;
    verifiedPageTitle: string | null;
    handshakeError: string | null;
    totalEventsCount: number;
    totalClicksAttributed: number;
    totalWatchSecondsAttributed: number;
    totalGrossUsd: number;
    totalPlatformFeeUsd: number;
    totalCreatorNetUsd: number;
    totalWithdrawnUsd: number;
    events: MotherAppRevenueEvent[];
  };
  channelStats: {
    clicks: number;
    videoViews: number;
    watchSeconds: number;
    watchHours: number;
    grossUsd: number;
    creatorNetUsd: number;
    platformProgressPercent: number;
  };
  availableOwnerBalanceUsd: number;
  availableOwnerBalanceGhs: number;
  fxRates: {
    USD: 1;
    GHS: number;
    NGN: number;
    KES: number;
  };
  solUsdRate: {
    usdPerSol: number;
    source: string;
  };
  settlementStatus: {
    settlementMode: 'live_configured' | 'live_treasury_ledger';
    configuredRails: string[];
    note: string;
  };
  integrationEndpoints: {
    motherAppUrl: string;
    motherOrigin: string;
    storyId: string;
    attributionUrl: string;
    articlesFeed: string;
    webhookUrl: string;
    rssFeed: string;
    apkDownload: string;
  };
  embedSnippet: string;
}

interface MotherAppHubSectionProps {
  withdrawalMethods: OwnerWithdrawalMethod[];
  onMotherAppUpdated?: (payload: {
    base44AppUrl?: string;
    motherOrigin?: string;
    storyId?: string;
    ownerPayouts?: unknown;
    rewards?: unknown;
    monetizationSummary?: unknown;
    revenueEngine?: unknown;
    platformThresholds?: unknown;
  }) => void;
  onInspectEndpoint: (target: { path: string; label: string }) => void;
  onLaunchRealCheckout: (planId: string, label: string) => void;
}

const STREAM_OPTIONS: Array<{
  id: MotherAppStreamType;
  label: string;
  shortLabel: string;
  defaultUsd: string;
  hint: string;
}> = [
  {
    id: 'sponsored_story_slot',
    label: 'Sponsored Story Boost',
    shortLabel: 'Sponsored Story',
    defaultUsd: '25.00',
    hint: 'Direct commercial sponsorship or brand placement on the Mother App lead dispatch.'
  },
  {
    id: 'reader_traffic_yield',
    label: 'Traffic & Watch Yield',
    shortLabel: 'Traffic & Watch',
    defaultUsd: '',
    hint: 'Converts Mother App story clicks ($0.045 CPC) and watch minutes ($1.20/hr) at 70% creator share.'
  },
  {
    id: 'subscription_referral',
    label: 'Subscription Referral',
    shortLabel: 'Subscriptions',
    defaultUsd: '9.99',
    hint: 'Subscriber pass or Newsroom Desk plan referred from the Base44 Mother App.'
  },
  {
    id: 'reader_tip',
    label: 'Reader Support Tip',
    shortLabel: 'Reader Tips',
    defaultUsd: '5.00',
    hint: 'Direct reader appreciation or Stars/Super Thanks support settled from the story.'
  }
];

export function MotherAppHubSection({
  withdrawalMethods,
  onMotherAppUpdated,
  onInspectEndpoint,
  onLaunchRealCheckout
}: MotherAppHubSectionProps) {
  const [summary, setSummary] = useState<MotherAppSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [urlInput, setUrlInput] = useState<string>(
    'https://aloof-daily-news-pulse.base44.app/story/6b04f190aa908b27ce284a57'
  );
  const [verifyingHandshake, setVerifyingHandshake] = useState<boolean>(false);

  const [streamType, setStreamType] = useState<MotherAppStreamType>('sponsored_story_slot');
  const [sourceLabelInput, setSourceLabelInput] = useState<string>(
    'Aloof Daily News Pulse · Story 6b04f190aa908b27ce284a57'
  );
  const [amountUsdInput, setAmountUsdInput] = useState<string>('25.00');
  const [clicksInput, setClicksInput] = useState<string>('180');
  const [watchMinutesInput, setWatchMinutesInput] = useState<string>('60');
  const [noteInput, setNoteInput] = useState<string>('');
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [rightPanelTab, setRightPanelTab] = useState<'endpoints' | 'webhook'>('endpoints');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | MotherAppStreamType>('all');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [firestoreEventsCount, setFirestoreEventsCount] = useState<number>(0);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (withdrawalMethods.length > 0 && !selectedMethodId) {
      const def = withdrawalMethods.find((m) => m.isDefault) ?? withdrawalMethods[0];
      if (def) setSelectedMethodId(def.id);
    }
  }, [withdrawalMethods, selectedMethodId]);

  const fetchSummary = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/mother-app/summary');
      if (!res.ok) throw new Error('Unable to load Base44 Mother App summary.');
      const data = (await res.json()) as MotherAppSummaryResponse;
      setSummary(data);
      setUrlInput(data.connection.motherAppUrl);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Unable to reach Mother App telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!fbUser?.emailVerified) return;
    loadMotherAppRevenueEventsFromFirestore(fbUser.uid)
      .then((rows) => setFirestoreEventsCount(rows.length))
      .catch(() => {
        // Non-fatal initial read
      });
  }, []);

  const liveValuation = useMemo(() => {
    const ghsRate = summary?.fxRates.GHS ?? 11.83;
    const solRate = summary?.solUsdRate.usdPerSol ?? 145;
    let grossUsd = 0;
    if (streamType === 'reader_traffic_yield') {
      const clicks = Math.max(0, Number(clicksInput) || 0);
      const mins = Math.max(0, Number(watchMinutesInput) || 0);
      grossUsd = Number((clicks * 0.045 + (mins / 60) * 1.2).toFixed(2));
    } else {
      grossUsd = Number(Math.max(0, Number(amountUsdInput) || 0).toFixed(2));
    }
    const creatorNetUsd = Number((grossUsd * 0.7).toFixed(2));
    const platformFeeUsd = Number(Math.max(0, grossUsd - creatorNetUsd).toFixed(2));
    const withdrawGhs = Number((creatorNetUsd * ghsRate).toFixed(2));
    const equivalentSol = Number((creatorNetUsd / Math.max(1, solRate)).toFixed(4));
    return { grossUsd, creatorNetUsd, platformFeeUsd, withdrawGhs, equivalentSol };
  }, [streamType, amountUsdInput, clicksInput, watchMinutesInput, summary?.fxRates.GHS, summary?.solUsdRate.usdPerSol]);

  const activeMethod = useMemo(
    () => withdrawalMethods.find((m) => m.id === selectedMethodId) ?? withdrawalMethods[0] ?? null,
    [withdrawalMethods, selectedMethodId]
  );

  const filteredEvents = useMemo(() => {
    const events = summary?.connection.events ?? [];
    const term = ledgerSearch.trim().toLowerCase();
    return events.filter((ev) => {
      if (ledgerFilter !== 'all' && ev.streamType !== ledgerFilter) return false;
      if (!term) return true;
      return (
        ev.id.toLowerCase().includes(term) ||
        ev.streamLabel.toLowerCase().includes(term) ||
        ev.sourceLabel.toLowerCase().includes(term) ||
        ev.storyId.toLowerCase().includes(term) ||
        (ev.withdrawalId ?? '').toLowerCase().includes(term)
      );
    });
  }, [summary?.connection.events, ledgerFilter, ledgerSearch]);

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1800);
      })
      .catch(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1800);
      });
  };

  const syncEventToFirestore = async (ev: MotherAppRevenueEvent) => {
    const fbUser = auth.currentUser;
    if (!fbUser?.emailVerified) return;
    try {
      const ok = await syncMotherAppRevenueEventToFirestore(fbUser, {
        id: ev.id,
        motherAppUrl: ev.motherAppUrl,
        storyId: ev.storyId,
        streamType: ev.streamType,
        sourceLabel: ev.sourceLabel,
        grossUsd: ev.grossUsd,
        creatorNetUsd: ev.creatorNetUsd,
        withdrawGhs: ev.withdrawGhs,
        equivalentSol: ev.equivalentSol,
        settlementMode: ev.settlementMode,
        withdrawalId: ev.withdrawalId,
        note: ev.note
      });
      if (ok) setFirestoreEventsCount((c) => c + 1);
    } catch {
      // Non-fatal Firestore sync fallback
    }
  };

  const handleVerifyHandshake = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setFeedback(null);
    setVerifyingHandshake(true);
    try {
      const res = await fetch('/api/mother-app/verify-handshake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motherAppUrl: urlInput.trim() })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not verify Base44 Mother App link.');
      }
      const nextSummary = payload.summary as MotherAppSummaryResponse;
      setSummary(nextSummary);
      setUrlInput(nextSummary.connection.motherAppUrl);
      onMotherAppUpdated?.({
        base44AppUrl: nextSummary.connection.motherAppUrl,
        motherOrigin: nextSummary.connection.motherOrigin,
        storyId: nextSummary.connection.storyId
      });

      const fbUser = auth.currentUser;
      if (fbUser?.emailVerified) {
        syncMotherAppConnectionToFirestore(fbUser, {
          motherAppUrl: nextSummary.connection.motherAppUrl,
          motherOrigin: nextSummary.connection.motherOrigin,
          storyId: nextSummary.connection.storyId,
          appName: nextSummary.connection.appName,
          lastHandshakeOk: nextSummary.connection.lastHandshakeOk,
          lastHandshakeStatus: nextSummary.connection.lastHandshakeStatus,
          verifiedPageTitle: nextSummary.connection.verifiedPageTitle
        }).catch(() => {
          // Only agency admin writes to mother_app_connections
        });
      }

      setFeedback({
        type: nextSummary.connection.lastHandshakeOk ? 'success' : 'error',
        text: payload.message as string
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Mother App verification failed.'
      });
    } finally {
      setVerifyingHandshake(false);
    }
  };

  const handleRecordRevenue = async (withdrawNow: boolean) => {
    setFeedback(null);
    setSubmitting(true);
    try {
      const payloadBody: Record<string, unknown> = {
        streamType,
        sourceLabel: sourceLabelInput.trim() || undefined,
        note: noteInput.trim() || undefined,
        withdrawNow,
        methodId: selectedMethodId || undefined
      };
      if (streamType === 'reader_traffic_yield') {
        payloadBody.clicks = Math.max(0, Number(clicksInput) || 0);
        payloadBody.watchMinutes = Math.max(0, Number(watchMinutesInput) || 0);
      } else {
        payloadBody.amountUsd = Math.max(0, Number(amountUsdInput) || 0);
      }

      const res = await fetch('/api/mother-app/record-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not settle Mother App monetization.');
      }
      if (data.summary) {
        setSummary(data.summary as MotherAppSummaryResponse);
      }
      if (data.event) {
        void syncEventToFirestore(data.event as MotherAppRevenueEvent);
      }
      onMotherAppUpdated?.({
        ownerPayouts: data.ownerPayouts,
        rewards: data.rewards,
        monetizationSummary: data.monetizationSummary,
        revenueEngine: data.revenueEngine,
        platformThresholds: data.platformThresholds
      });
      setNoteInput('');
      setFeedback({ type: 'success', text: data.message as string });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Mother App revenue settlement failed.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawChannelBalance = async () => {
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/mother-app/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methodId: selectedMethodId || undefined,
          amountUsd: summary?.availableOwnerBalanceUsd
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to withdraw Mother App revenue.');
      }
      if (data.summary) {
        setSummary(data.summary as MotherAppSummaryResponse);
      }
      onMotherAppUpdated?.({
        ownerPayouts: data.ownerPayouts,
        rewards: data.rewards,
        monetizationSummary: data.monetizationSummary,
        revenueEngine: data.revenueEngine
      });
      setFeedback({ type: 'success', text: data.message as string });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Mother App withdrawal request failed.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const conn = summary?.connection;
  const activeStreamConfig = STREAM_OPTIONS.find((s) => s.id === streamType) ?? STREAM_OPTIONS[0];

  return (
    <section
      id="mother-app"
      aria-labelledby="mother-app-heading"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-white dark:bg-[#141413]"
    >
      <div id="base44-portal" className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-8">
        {/* Editorial Section Header & Mother App Link Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
              <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">
                Official Mother App Connection
              </span>
              <span aria-hidden="true">·</span>
              <span>{conn?.motherOrigin ?? 'https://aloof-daily-news-pulse.base44.app'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Story {conn?.storyId ?? '6b04f190aa908b27ce284a57'}
              </span>
              {conn?.lastHandshakeOk && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#14532D] dark:text-[#4ADE80]">
                    Verified HTTP {conn.lastHandshakeStatus ?? 200}
                    {conn.verifiedPageTitle ? ` (${conn.verifiedPageTitle})` : ''}
                  </span>
                </>
              )}
            </div>
            <h2
              id="mother-app-heading"
              className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#141413] dark:text-[#F5F3EE] text-balance"
            >
              Connected Base44 Mother App &amp; Verified Revenue Bridge
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Your Base44 application operates as the Mother App of News Hub 24+. Traffic, sponsored story slots, subscription referrals, and real gateway checkouts settle straight into your verified creator balance and MTN MoMo / bank payout rails.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={conn?.motherAppUrl ?? 'https://aloof-daily-news-pulse.base44.app/story/6b04f190aa908b27ce284a57'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <span>Open Mother App Story</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => void handleVerifyHandshake()}
              disabled={verifyingHandshake}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifyingHandshake ? 'animate-spin' : ''}`} />
              <span>{verifyingHandshake ? 'Verifying…' : 'Verify Live Handshake'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onLaunchRealCheckout(
                  'commercials-slot',
                  `Mother App Sponsor · Story ${conn?.storyId ?? '6b04f190aa908b27ce284a57'}`
                )
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors whitespace-nowrap shrink-0"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
              <span>Real Gateway Checkout</span>
            </button>
          </div>
        </div>

        {/* Loading / Error State */}
        {loading && !summary && (
          <div className="p-6 border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg bg-[#FBF9F5] dark:bg-[#1A1917] text-xs text-[#57534E] dark:text-[#A8A29E]">
            Loading Mother App telemetry and revenue metrics…
          </div>
        )}
        {loadError && (
          <div className="p-4 border border-[#991B1B]/40 rounded-lg bg-[#FEF2F2] dark:bg-[#2A1515] text-xs text-[#991B1B] dark:text-[#FCA5A5] flex items-center justify-between gap-4">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void fetchSummary()}
              className="px-3 py-1.5 font-semibold bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE] whitespace-nowrap shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4-Column Full-Width KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg">
            <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
              Mother App Verified Net Revenue
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              ${(conn?.totalCreatorNetUsd ?? 0).toFixed(2)} USD
            </p>
            <p className="mt-1 text-xs text-[#57534E] dark:text-[#A8A29E] font-mono tabular-nums">
              Gross ${(conn?.totalGrossUsd ?? 0).toFixed(2)} · 70% Creator Split
            </p>
          </div>

          <div className="p-5 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg">
            <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
              Base44 Channel Engagement
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {(summary?.channelStats.clicks ?? 0).toLocaleString()} clicks
            </p>
            <p className="mt-1 text-xs text-[#57534E] dark:text-[#A8A29E] font-mono tabular-nums">
              {(summary?.channelStats.watchHours ?? 0).toFixed(2)} watch hrs ·{' '}
              {(summary?.channelStats.videoViews ?? 0).toLocaleString()} views
            </p>
          </div>

          <div className="p-5 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg">
            <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
              Withdrawable Balance Ready
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              ${(summary?.availableOwnerBalanceUsd ?? 0).toFixed(2)} USD
            </p>
            <p className="mt-1 text-xs text-[#57534E] dark:text-[#A8A29E] font-mono tabular-nums">
              GH₵ {(summary?.availableOwnerBalanceGhs ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ·{' '}
              Withdrawn ${(conn?.totalWithdrawnUsd ?? 0).toFixed(2)}
            </p>
          </div>

          <div className="p-5 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg">
            <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
              Settlement &amp; Audit Mode
            </p>
            <p className="mt-1.5 text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
              {summary?.settlementStatus.settlementMode === 'live_configured'
                ? 'Live Gateway Rails Active'
                : 'Verified Treasury Ledger'}
            </p>
            <p className="mt-1 text-xs text-[#57534E] dark:text-[#A8A29E] font-mono tabular-nums">
              {conn?.totalEventsCount ?? 0} settlements · {firestoreEventsCount} synced
            </p>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            role="status"
            className={`p-4 rounded-lg border text-xs font-medium flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-[#F0FDF4] dark:bg-[#112619] border-[#BBF7D0] dark:border-[#1E462B] text-[#14532D] dark:text-[#4ADE80]'
                : 'bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#5C2424] text-[#991B1B] dark:text-[#FCA5A5]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Two-Column Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Mother App Monetization Studio */}
          <div className="lg:col-span-7 p-6 sm:p-8 bg-[#FBF9F5] dark:bg-[#191816] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Monetize the Mother App
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                  Attribute ad sponsorships, traffic yields, subscriptions, or tips directly from story{' '}
                  <span className="font-mono">{conn?.storyId ?? '6b04f190aa908b27ce284a57'}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleWithdrawChannelBalance()}
                disabled={submitting || (summary?.availableOwnerBalanceUsd ?? 0) < 0.5}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Withdraw Balance Now</span>
              </button>
            </div>

            {/* Stream Selector Segmented Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#EFECE6] dark:bg-[#121210] rounded-lg border border-[#E5E2DC] dark:border-[#2C2A26]">
              {STREAM_OPTIONS.map((opt) => {
                const active = streamType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setStreamType(opt.id);
                      if (opt.defaultUsd) setAmountUsdInput(opt.defaultUsd);
                    }}
                    className={`flex-1 min-w-[120px] px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-sm'
                        : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-[#44403C] dark:text-[#D6D3CD]">{activeStreamConfig.hint}</p>

            {/* Form Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label
                  htmlFor="ma-source-label"
                  className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1.5"
                >
                  Story or Campaign Attribution Label
                </label>
                <input
                  id="ma-source-label"
                  type="text"
                  value={sourceLabelInput}
                  onChange={(e) => setSourceLabelInput(e.target.value)}
                  maxLength={120}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                />
              </div>

              {streamType === 'reader_traffic_yield' ? (
                <>
                  <div>
                    <label
                      htmlFor="ma-clicks"
                      className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1.5"
                    >
                      Verified Mother App Clicks ($0.045 CPC)
                    </label>
                    <input
                      id="ma-clicks"
                      type="number"
                      min="0"
                      max="100000"
                      step="1"
                      value={clicksInput}
                      onChange={(e) => setClicksInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ma-watch-mins"
                      className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1.5"
                    >
                      Reader Watch &amp; Dwell Minutes ($1.20 / hr)
                    </label>
                    <input
                      id="ma-watch-mins"
                      type="number"
                      min="0"
                      max="10000"
                      step="1"
                      value={watchMinutesInput}
                      onChange={(e) => setWatchMinutesInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label
                    htmlFor="ma-amount-usd"
                    className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1.5"
                  >
                    Gross Monetization Amount (USD)
                  </label>
                  <input
                    id="ma-amount-usd"
                    type="number"
                    min="0.05"
                    max="25000"
                    step="0.01"
                    value={amountUsdInput}
                    onChange={(e) => setAmountUsdInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="ma-payout-method"
                  className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1.5"
                >
                  Instant Withdrawal Destination
                </label>
                <select
                  id="ma-payout-method"
                  value={selectedMethodId}
                  onChange={(e) => setSelectedMethodId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                >
                  {withdrawalMethods.length === 0 ? (
                    <option value="">MTN MoMo 0557711975 (Default)</option>
                  ) : (
                    withdrawalMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.destinationLabel} · {m.maskedAccount} ({m.currency})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="ma-note"
                  className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1.5"
                >
                  Settlement Reference Note (Optional)
                </label>
                <input
                  id="ma-note"
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="e.g., Q4 Brand Sponsor Banner on Aloof Daily News Pulse"
                  maxLength={180}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C]"
                />
              </div>
            </div>

            {/* Live Valuation Breakdown */}
            <div className="p-4 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Gross Yield</span>
                <span className="font-mono font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  ${liveValuation.grossUsd.toFixed(2)} USD
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Creator Net (70%)</span>
                <span className="font-mono font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  ${liveValuation.creatorNetUsd.toFixed(2)} USD
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Ghana Cedi Payout</span>
                <span className="font-mono font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  GH₵ {liveValuation.withdrawGhs.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#57534E] dark:text-[#A8A29E] block">Solana Equivalent</span>
                <span className="font-mono font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {liveValuation.equivalentSol.toFixed(4)} SOL
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={submitting || liveValuation.creatorNetUsd < 0.01}
                onClick={() => void handleRecordRevenue(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>{submitting ? 'Settling…' : 'Credit Verified Revenue'}</span>
              </button>

              <button
                type="button"
                disabled={submitting || liveValuation.creatorNetUsd < 0.5}
                onClick={() => void handleRecordRevenue(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <span>
                  Credit &amp; Withdraw to {activeMethod ? activeMethod.maskedAccount : 'MoMo'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <a
                href="#owner-withdrawals"
                className="text-xs font-semibold text-[#57534E] dark:text-[#A8A29E] hover:text-[#991B1B] dark:hover:text-[#F87171] hover:underline underline-offset-4 ml-auto whitespace-nowrap"
              >
                Manage Payout Accounts
              </a>
            </div>
          </div>

          {/* Right Column: URL Handshake Form, Mother App Endpoints & Webhook Snippet */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-[#FBF9F5] dark:bg-[#191816] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-5">
            <form onSubmit={handleVerifyHandshake} className="space-y-2.5 pb-5 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <label
                htmlFor="mother-app-url-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
              >
                <Link2 className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                <span>Mother App Base44 Story / App URL</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="mother-app-url-input"
                  type="url"
                  required
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://aloof-daily-news-pulse.base44.app/story/6b04f190aa908b27ce284a57"
                  className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                />
                <button
                  type="submit"
                  disabled={verifyingHandshake}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  {verifyingHandshake ? 'Connecting…' : 'Connect & Verify'}
                </button>
              </div>
              <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] font-mono tabular-nums">
                {conn?.lastHandshakeAt
                  ? `Last verified ${new Date(conn.lastHandshakeAt).toLocaleTimeString()} · HTTP ${conn.lastHandshakeStatus ?? '—'}`
                  : 'Ready to verify live HTTP handshake against Base44.'}
              </p>
            </form>

            {/* Endpoints vs Webhook Snippet Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#EFECE6] dark:bg-[#121210] rounded-lg border border-[#E5E2DC] dark:border-[#2C2A26]">
              <button
                type="button"
                onClick={() => setRightPanelTab('endpoints')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  rightPanelTab === 'endpoints'
                    ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-sm'
                    : 'text-[#57534E] dark:text-[#A8A29E]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Connected Endpoints</span>
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('webhook')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  rightPanelTab === 'webhook'
                    ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-sm'
                    : 'text-[#57534E] dark:text-[#A8A29E]'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Mother App Webhook</span>
              </button>
            </div>

            {rightPanelTab === 'endpoints' ? (
              <div className="bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                {[
                  {
                    key: 'ma-url',
                    label: 'Mother App Deep Link',
                    value:
                      summary?.integrationEndpoints.motherAppUrl ??
                      'https://aloof-daily-news-pulse.base44.app/story/6b04f190aa908b27ce284a57'
                  },
                  {
                    key: 'ma-attribution',
                    label: 'Attributed Traffic Return URL',
                    value: summary?.integrationEndpoints.attributionUrl ?? '/?utm_source=base44&platform=base44_app'
                  },
                  {
                    key: 'ma-webhook',
                    label: 'Live Revenue & Telemetry Webhook',
                    value: summary?.integrationEndpoints.webhookUrl ?? '/api/mother-app/webhook'
                  },
                  {
                    key: 'ma-articles',
                    label: 'CORS JSON Wire Feed (/api/articles)',
                    value: summary?.integrationEndpoints.articlesFeed ?? '/api/articles'
                  },
                  {
                    key: 'ma-apk',
                    label: 'Android Companion APK Link',
                    value: summary?.integrationEndpoints.apkDownload ?? '/downloads/newshub24plus.apk'
                  }
                ].map((item) => (
                  <div key={item.key} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block">
                        {item.label}
                      </span>
                      <span className="font-mono text-[#57534E] dark:text-[#A8A29E] block truncate">
                        {item.value}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.key, item.value)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-[#FBF9F5] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded hover:border-[#141413] dark:hover:border-[#F5F3EE] transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedKey === item.key ? (
                        <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === item.key ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                ))}
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-[#F5F2EB] dark:bg-[#1C1B19]">
                  <span className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                    Inspect live feed returned to Base44
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onInspectEndpoint({
                        path: '/api/articles',
                        label: 'Base44 Mother App JSON Feed (/api/articles)'
                      })
                    }
                    className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] hover:underline whitespace-nowrap"
                  >
                    Inspect /api/articles
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
                  Paste this snippet into your Base44 Mother App story view (<span className="font-mono">{conn?.motherOrigin ?? 'aloof-daily-news-pulse.base44.app'}</span>) to push live clicks, watch seconds, and paid checkouts directly into News Hub 24+.
                </p>
                <pre className="p-3.5 text-[11px] font-mono bg-[#141413] text-[#F5F3EE] rounded-md overflow-x-auto leading-relaxed">
                  {summary?.embedSnippet ?? ''}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy('ma-snippet', summary?.embedSnippet ?? '')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] transition-colors whitespace-nowrap"
                >
                  {copiedKey === 'ma-snippet' ? (
                    <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'ma-snippet' ? 'Snippet Copied' : 'Copy Webhook Snippet'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mother App Verified Revenue Audit Ledger */}
        <div className="border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden bg-white dark:bg-[#171715]">
          <div className="px-5 py-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
              <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                Mother App Verified Revenue Audit Ledger
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search reference or story..."
                  aria-label="Search Mother App revenue ledger"
                  className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C]"
                />
              </div>

              <select
                value={ledgerFilter}
                onChange={(e) => setLedgerFilter(e.target.value as 'all' | MotherAppStreamType)}
                aria-label="Filter Mother App stream type"
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
              >
                <option value="all">All Revenue Streams</option>
                <option value="sponsored_story_slot">Sponsored Story Slot</option>
                <option value="reader_traffic_yield">Traffic &amp; Watch Yield</option>
                <option value="subscription_referral">Subscription Referral</option>
                <option value="reader_tip">Reader Support Tip</option>
                <option value="webhook_event">Webhook Event</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E2DC] dark:border-[#2C2A26] text-[#57534E] dark:text-[#A8A29E] bg-[#FBF9F5] dark:bg-[#141413]">
                  <th className="py-3 px-4 font-semibold">Reference &amp; Date</th>
                  <th className="py-3 px-4 font-semibold">Stream &amp; Attribution</th>
                  <th className="py-3 px-4 font-semibold text-right">Engagement</th>
                  <th className="py-3 px-4 font-semibold text-right">Gross USD</th>
                  <th className="py-3 px-4 font-semibold text-right">Creator Net (USD / GH₵)</th>
                  <th className="py-3 px-4 font-semibold">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-[#57534E] dark:text-[#A8A29E]">
                      No Mother App monetization entries match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => (
                    <tr
                      key={ev.id}
                      className="hover:bg-[#FBF9F5] dark:hover:bg-[#1E1D1A] transition-colors"
                    >
                      <td className="py-3 px-4 align-top">
                        <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] block">
                          {ev.id}
                        </span>
                        <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                          {new Date(ev.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top max-w-xs">
                        <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block">
                          {ev.streamLabel}
                        </span>
                        <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E] block truncate">
                          {ev.sourceLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-[#44403C] dark:text-[#D6D3CD]">
                        {ev.clicksAttributed > 0 || ev.watchSecondsAttributed > 0
                          ? `${ev.clicksAttributed} clk · ${(ev.watchSecondsAttributed / 60).toFixed(1)}m`
                          : 'Direct'}
                      </td>
                      <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                        ${ev.grossUsd.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 align-top text-right font-mono tabular-nums">
                        <span className="font-bold text-[#14532D] dark:text-[#4ADE80] block">
                          +${ev.creatorNetUsd.toFixed(2)} USD
                        </span>
                        <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          GH₵ {ev.withdrawGhs.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block">
                          {ev.withdrawalId ? `Withdrawn (${ev.withdrawalId})` : 'Credited to Balance'}
                        </span>
                        <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          {ev.settlementMode === 'live_configured' ? 'Live Gateway' : 'Verified Ledger'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
