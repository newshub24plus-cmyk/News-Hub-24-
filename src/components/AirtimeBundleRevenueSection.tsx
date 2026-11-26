import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Database,
  Landmark,
  Radio,
  RefreshCw,
  Search,
  Smartphone,
  Wallet
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { NewsArticle, VideoReelItem } from '../data/newsData';
import {
  auth,
  loadAirtimeBundleConversionsFromFirestore,
  syncAirtimeBundleConversionToFirestore
} from '../lib/firebase';
import type { OwnerWithdrawalMethod } from './OwnerWithdrawalSection';
import type { RevenueChannel } from './VideoReelsHubSection';

export interface CarrierBundleRateProfile {
  code: string;
  label: string;
  country: string;
  localCurrency: string;
  currencySymbol: string;
  mbPerWatchMinute: number;
  usdPerBundleGb: number;
  creatorYieldPerGbUsd: number;
  watchBonusPerMinuteUsd: number;
  creatorSharePercent: number;
  momoCompatible: boolean;
}

export interface PendingPublicationBundleSession {
  id: string;
  publicationId: string;
  publicationTitle: string;
  publicationType: 'article' | 'video_reel' | 'investigation';
  carrierCode: string;
  carrierLabel: string;
  channel: RevenueChannel;
  watchSeconds: number;
  bundleMbSpent: number;
  airtimeSpendUsd: number;
  airtimeSpendGhs: number;
  grossYieldUsd: number;
  platformFeeUsd: number;
  creatorNetUsd: number;
  recordedAt: string;
}

export interface AirtimeBundleConversionItem {
  id: string;
  publicationId: string;
  publicationTitle: string;
  publicationType: 'article' | 'video_reel' | 'investigation' | 'multi_publication_batch';
  carrierCode: string;
  carrierLabel: string;
  channel: RevenueChannel;
  sessionsCount: number;
  watchMinutes: number;
  bundleMbSpent: number;
  airtimeSpendUsd: number;
  airtimeSpendGhs: number;
  grossRevenueUsd: number;
  platformFeeUsd: number;
  creatorNetUsd: number;
  equivalentSol: number;
  solUsdRate: number;
  withdrawGhs: number;
  status: 'Verified & Credited' | 'Converted & Withdrawn';
  settlementMode: 'live_configured' | 'verified_treasury_ledger';
  withdrawalId?: string;
  note: string;
  createdAt: string;
}

export interface AirtimeBundleSummaryResponse {
  carriers: CarrierBundleRateProfile[];
  fxRates: {
    USD: 1;
    GHS: number;
    NGN: number;
    KES: number;
    rates: Record<string, number>;
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
  pendingSummary: {
    sessionsCount: number;
    watchMinutes: number;
    watchHours: number;
    bundleMbSpent: number;
    airtimeSpendUsd: number;
    airtimeSpendGhs: number;
    grossYieldUsd: number;
    creatorNetUsd: number;
    withdrawGhs: number;
    equivalentSol: number;
  };
  lifetimeSummary: {
    bundleMbConverted: number;
    airtimeSpendUsdConverted: number;
    watchHoursConverted: number;
    creatorRevenueUsd: number;
    creatorRevenueGhs: number;
    creatorRevenueSol: number;
  };
  pendingSessions: PendingPublicationBundleSession[];
  conversions: AirtimeBundleConversionItem[];
  availableBalanceUsd: number;
}

interface AirtimeBundleRevenueSectionProps {
  articles: NewsArticle[];
  reels: VideoReelItem[];
  withdrawalMethods: OwnerWithdrawalMethod[];
  availableBalanceUsd: number;
  onRevenueConverted?: (payload: {
    ownerPayouts?: unknown;
    rewards?: unknown;
    revenueEngine?: unknown;
    availableUsd?: number;
  }) => void;
}

const PRESET_WATCH_BUNDLES = [
  { label: '15m · ~170 MB', minutes: '15', mb: '172.5' },
  { label: '45m · ~515 MB', minutes: '45', mb: '517.5' },
  { label: '120m · ~1.4 GB', minutes: '120', mb: '1380' }
];

export function AirtimeBundleRevenueSection({
  articles,
  reels,
  withdrawalMethods,
  availableBalanceUsd,
  onRevenueConverted
}: AirtimeBundleRevenueSectionProps) {
  const [summary, setSummary] = useState<AirtimeBundleSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [workbenchTab, setWorkbenchTab] = useState<'pending' | 'direct'>('pending');
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [withdrawFullPool, setWithdrawFullPool] = useState<boolean>(false);

  // Direct publication watch & airtime bundle conversion form state
  const [selectedPubId, setSelectedPubId] = useState<string>(reels[0]?.id || articles[0]?.id || 'reel-001');
  const [selectedCarrierCode, setSelectedCarrierCode] = useState<string>('MTN_GH');
  const [selectedChannel, setSelectedChannel] = useState<RevenueChannel>('website');
  const [inputBasis, setInputBasis] = useState<'watch_minutes' | 'bundle_mb' | 'airtime_usd'>('watch_minutes');
  const [watchMinutesInput, setWatchMinutesInput] = useState<string>('45');
  const [bundleMbInput, setBundleMbInput] = useState<string>('517.5');
  const [airtimeUsdInput, setAirtimeUsdInput] = useState<string>('1.50');
  const [customNote, setCustomNote] = useState<string>('');

  // Ledger filters
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'Converted & Withdrawn' | 'Verified & Credited'>('all');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Execution state
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [firestoreCount, setFirestoreCount] = useState<number>(0);

  const publicationOptions = useMemo(() => {
    const reelOpts = reels.map((r) => ({
      id: r.id,
      title: r.title,
      type: 'video_reel' as const,
      group: 'Video Reels & Broadcasts'
    }));
    const articleOpts = articles.slice(0, 24).map((a) => ({
      id: a.id,
      title: a.title,
      type: (a.category === 'Investigations' ? 'investigation' : 'article') as 'article' | 'investigation',
      group: 'Editorial Articles & Investigations'
    }));
    return { reelOpts, articleOpts, all: [...reelOpts, ...articleOpts] };
  }, [articles, reels]);

  useEffect(() => {
    if (withdrawalMethods.length > 0 && !selectedMethodId) {
      const def = withdrawalMethods.find((m) => m.isDefault) ?? withdrawalMethods[0];
      if (def) setSelectedMethodId(def.id);
    }
  }, [withdrawalMethods, selectedMethodId]);

  const fetchSummary = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/airtime-bundles/summary');
      if (!res.ok) {
        throw new Error('Could not load airtime bundle telemetry.');
      }
      const data = (await res.json()) as AirtimeBundleSummaryResponse;
      setSummary(data);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Unable to reach airtime conversion ledger.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const user = auth.currentUser;
    if (user?.emailVerified) {
      void loadAirtimeBundleConversionsFromFirestore(user.uid)
        .then((rows) => setFirestoreCount(rows.length))
        .catch(() => {
          // Non-fatal Firestore read fallback
        });
    }
  }, [summary?.conversions.length]);

  const activeCarrier = useMemo(() => {
    const list = summary?.carriers ?? [];
    return list.find((c) => c.code === selectedCarrierCode) ?? list[0] ?? null;
  }, [summary?.carriers, selectedCarrierCode]);

  const activeMethod = useMemo(() => {
    return (
      withdrawalMethods.find((m) => m.id === selectedMethodId) ??
      withdrawalMethods.find((m) => m.isDefault) ??
      withdrawalMethods[0] ??
      null
    );
  }, [withdrawalMethods, selectedMethodId]);

  // Real-time preview calculator matching server/airtimeBundleRevenue.ts
  const liveQuote = useMemo(() => {
    const ghsRate = summary?.fxRates.GHS ?? 11.83;
    const solRate = summary?.solUsdRate.usdPerSol ?? 185.0;
    const carrier = activeCarrier ?? {
      code: 'MTN_GH',
      label: 'MTN Ghana (Data & Airtime Bundle)',
      country: 'Ghana',
      localCurrency: 'GHS',
      currencySymbol: 'GH₵',
      mbPerWatchMinute: 11.5,
      usdPerBundleGb: 1.45,
      creatorYieldPerGbUsd: 4.8,
      watchBonusPerMinuteUsd: 0.042,
      creatorSharePercent: 70,
      momoCompatible: true
    };

    let mb = 0;
    let mins = 0;
    let airtimeUsd = 0;

    if (inputBasis === 'watch_minutes') {
      mins = Math.max(0, Number(watchMinutesInput) || 0);
      mb = Number((mins * carrier.mbPerWatchMinute).toFixed(2));
      airtimeUsd = Number(((mb / 1024) * carrier.usdPerBundleGb).toFixed(2));
    } else if (inputBasis === 'bundle_mb') {
      mb = Math.max(0, Number(bundleMbInput) || 0);
      mins = Number((mb / carrier.mbPerWatchMinute).toFixed(1));
      airtimeUsd = Number(((mb / 1024) * carrier.usdPerBundleGb).toFixed(2));
    } else {
      airtimeUsd = Math.max(0, Number(airtimeUsdInput) || 0);
      mb = Number(((airtimeUsd / carrier.usdPerBundleGb) * 1024).toFixed(2));
      mins = Number((mb / carrier.mbPerWatchMinute).toFixed(1));
    }

    const gb = mb / 1024;
    const grossUsd = Number(
      Math.max(
        0,
        gb * carrier.creatorYieldPerGbUsd + airtimeUsd * 0.42 + mins * carrier.watchBonusPerMinuteUsd
      ).toFixed(2)
    );
    const creatorNetUsd = Number((grossUsd * (carrier.creatorSharePercent / 100)).toFixed(2));
    const platformFeeUsd = Number(Math.max(0, grossUsd - creatorNetUsd).toFixed(2));
    const withdrawGhs = Number((creatorNetUsd * ghsRate).toFixed(2));
    const equivalentSol = Number((creatorNetUsd / Math.max(1, solRate)).toFixed(4));
    const localRate = summary?.fxRates.rates?.[carrier.localCurrency] ?? (carrier.localCurrency === 'GHS' ? ghsRate : 1);
    const airtimeLocal = Number((airtimeUsd * localRate).toFixed(2));

    return {
      carrier,
      mins,
      mb,
      airtimeUsd,
      airtimeLocal,
      grossUsd,
      platformFeeUsd,
      creatorNetUsd,
      withdrawGhs,
      equivalentSol
    };
  }, [activeCarrier, inputBasis, watchMinutesInput, bundleMbInput, airtimeUsdInput, summary?.fxRates, summary?.solUsdRate]);

  const syncConversionRecordToFirestore = async (conv: AirtimeBundleConversionItem) => {
    const fbUser = auth.currentUser;
    if (!fbUser?.emailVerified) return;
    try {
      const ok = await syncAirtimeBundleConversionToFirestore(fbUser, {
        id: conv.id,
        publicationId: conv.publicationId,
        publicationTitle: conv.publicationTitle,
        publicationType: conv.publicationType,
        carrierCode: conv.carrierCode,
        carrierLabel: conv.carrierLabel,
        channel: conv.channel,
        watchMinutes: conv.watchMinutes,
        bundleMbSpent: conv.bundleMbSpent,
        airtimeSpendUsd: conv.airtimeSpendUsd,
        creatorNetUsd: conv.creatorNetUsd,
        equivalentSol: conv.equivalentSol,
        withdrawGhs: conv.withdrawGhs,
        status: conv.status,
        settlementMode: conv.settlementMode,
        withdrawalId: conv.withdrawalId,
        note: conv.note
      });
      if (ok) {
        setFirestoreCount((c) => c + 1);
      }
    } catch {
      // Non-fatal Firestore sync fallback
    }
  };

  const handleConvertPending = async (withdrawNow: boolean, sessionId?: string) => {
    setFeedback(null);
    setSubmittingAction(true);
    setActiveRowId(sessionId ?? null);
    try {
      const res = await fetch('/api/airtime-bundles/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: sessionId ? 'session_id' : 'pending_all',
          sessionId,
          withdrawNow,
          withdrawFullAvailable: withdrawNow && withdrawFullPool,
          methodId: selectedMethodId || undefined
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Unable to convert pending publication bundles.');
      }
      if (payload.summary) {
        setSummary(payload.summary as AirtimeBundleSummaryResponse);
      }
      if (payload.conversion) {
        void syncConversionRecordToFirestore(payload.conversion as AirtimeBundleConversionItem);
      }
      onRevenueConverted?.({
        ownerPayouts: payload.ownerPayouts,
        rewards: payload.rewards,
        revenueEngine: payload.revenueEngine,
        availableUsd: payload.ownerPayouts?.balances?.availableUsd
      });
      setFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Conversion request failed.'
      });
    } finally {
      setSubmittingAction(false);
      setActiveRowId(null);
    }
  };

  const handleDirectSubmit = async (action: 'meter' | 'convert' | 'convert_withdraw') => {
    setFeedback(null);
    const selectedPub = publicationOptions.all.find((p) => p.id === selectedPubId);

    const payloadBody: Record<string, unknown> = {
      publicationId: selectedPub?.id || selectedPubId,
      publicationTitle: selectedPub?.title || 'News Hub 24+ Publication',
      publicationType: selectedPub?.type || 'article',
      carrierCode: selectedCarrierCode,
      channel: selectedChannel,
      note: customNote.trim() || undefined
    };

    if (inputBasis === 'watch_minutes') {
      payloadBody.watchMinutes = Number(watchMinutesInput) || 0;
    } else if (inputBasis === 'bundle_mb') {
      payloadBody.bundleMbSpent = Number(bundleMbInput) || 0;
    } else {
      payloadBody.airtimeSpendUsd = Number(airtimeUsdInput) || 0;
    }

    setSubmittingAction(true);
    try {
      if (action === 'meter') {
        const res = await fetch('/api/airtime-bundles/meter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBody)
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Could not meter publication bundle session.');
        }
        if (json.summary) {
          setSummary(json.summary as AirtimeBundleSummaryResponse);
        }
        setFeedback({ type: 'success', text: json.message as string });
        setWorkbenchTab('pending');
      } else {
        const withdrawNow = action === 'convert_withdraw';
        const res = await fetch('/api/airtime-bundles/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'publication_session',
            ...payloadBody,
            withdrawNow,
            withdrawFullAvailable: withdrawNow && withdrawFullPool,
            methodId: selectedMethodId || undefined
          })
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Could not convert publication bundle spend.');
        }
        if (json.summary) {
          setSummary(json.summary as AirtimeBundleSummaryResponse);
        }
        if (json.conversion) {
          void syncConversionRecordToFirestore(json.conversion as AirtimeBundleConversionItem);
        }
        onRevenueConverted?.({
          ownerPayouts: json.ownerPayouts,
          rewards: json.rewards,
          revenueEngine: json.revenueEngine,
          availableUsd: json.ownerPayouts?.balances?.availableUsd
        });
        setCustomNote('');
        setFeedback({ type: 'success', text: json.message as string });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to process airtime bundle conversion.'
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleDirectSubmit('convert');
  };

  const filteredConversions = useMemo(() => {
    const rows = summary?.conversions ?? [];
    const q = ledgerSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (ledgerFilter !== 'all' && row.status !== ledgerFilter) return false;
      if (!q) return true;
      return (
        row.publicationTitle.toLowerCase().includes(q) ||
        row.carrierLabel.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        (row.withdrawalId?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [summary?.conversions, ledgerFilter, ledgerSearch]);

  const effectiveAvailableUsd = summary?.availableBalanceUsd ?? availableBalanceUsd;

  return (
    <section
      id="airtime-revenue"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-white dark:bg-[#141413]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-10">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1.5 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              <span>Telecom Data &amp; Airtime Bundle Monetization · Publications Watch-to-Revenue Ledger</span>
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
              Airtime Bundle-to-Verified-Revenue Converter
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Every minute spent watching News Hub 24+ video broadcasts, dispatches, and investigations converts mobile airtime and data bundle expenditure into verified USD, GH₵, and SOL creator revenue ready for withdrawal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void fetchSummary()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-[#FBF9F5] dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#262420] transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Bundle Ledger</span>
            </button>
            <a
              href="#owner-withdrawals"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Open Treasury Payouts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Load Error State */}
        {loadError && (
          <div
            role="alert"
            className="p-4 border border-[#FCA5A5] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#2A1515] rounded-md flex items-center justify-between gap-4 text-sm text-[#991B1B] dark:text-[#FCA5A5]"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void fetchSummary()}
              className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md whitespace-nowrap shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4-Column KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">Pending Publication Bundles</p>
            <p className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#141413] dark:text-[#F5F3EE]">
              {loading ? '—' : `${(summary?.pendingSummary.bundleMbSpent ?? 0).toLocaleString()} MB`}
            </p>
            <p className="mt-1 text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
              ${(summary?.pendingSummary.airtimeSpendUsd ?? 0).toFixed(2)} airtime ·{' '}
              {(summary?.pendingSummary.watchMinutes ?? 0).toFixed(1)} mins
            </p>
          </div>

          <div className="p-5 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">Ready to Convert (70% Net)</p>
            <p className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#15803D] dark:text-[#4ADE80]">
              {loading ? '—' : `$${(summary?.pendingSummary.creatorNetUsd ?? 0).toFixed(2)} USD`}
            </p>
            <p className="mt-1 text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
              GH₵ {(summary?.pendingSummary.withdrawGhs ?? 0).toFixed(2)} ·{' '}
              {(summary?.pendingSummary.equivalentSol ?? 0).toFixed(4)} SOL
            </p>
          </div>

          <div className="p-5 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">Lifetime Bundle Revenue</p>
            <p className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#141413] dark:text-[#F5F3EE]">
              {loading ? '—' : `$${(summary?.lifetimeSummary.creatorRevenueUsd ?? 0).toFixed(2)} USD`}
            </p>
            <p className="mt-1 text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
              {(summary?.lifetimeSummary.bundleMbConverted ?? 0).toLocaleString()} MB converted
            </p>
          </div>

          <div className="p-5 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">Withdrawable Owner Balance</p>
            <p className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#991B1B] dark:text-[#F87171]">
              ${effectiveAvailableUsd.toFixed(2)} USD
            </p>
            <p className="mt-1 text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
              GH₵ {(effectiveAvailableUsd * (summary?.fxRates.GHS ?? 11.83)).toFixed(2)}
              {firestoreCount > 0 ? ` · ${firestoreCount} synced` : ''}
            </p>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            role="status"
            className={`p-4 rounded-md border text-sm flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-[#F0FDF4] dark:bg-[#132518] border-[#86EFAC] dark:border-[#166534] text-[#166534] dark:text-[#86EFAC]'
                : 'bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FCA5A5] dark:border-[#7F1D1D] text-[#991B1B] dark:text-[#FCA5A5]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Main 2-Column Interactive Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Columns: Workbench */}
          <div className="lg:col-span-7 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md p-6 space-y-6">
            {/* Segmented Mode Tabs + Payout Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div className="inline-flex items-center gap-1 p-1 bg-[#EFECE4] dark:bg-[#242320] rounded-md">
                <button
                  type="button"
                  onClick={() => setWorkbenchTab('pending')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                    workbenchTab === 'pending'
                      ? 'bg-white dark:bg-[#141413] text-[#141413] dark:text-[#F5F3EE] shadow-xs'
                      : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  Accrued Sessions ({summary?.pendingSessions.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setWorkbenchTab('direct')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                    workbenchTab === 'direct'
                      ? 'bg-white dark:bg-[#141413] text-[#141413] dark:text-[#F5F3EE] shadow-xs'
                      : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  Convert Publication Watch
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Landmark className="w-3.5 h-3.5 text-[#57534E] dark:text-[#A8A29E] shrink-0" />
                <select
                  aria-label="Select Payout Destination"
                  value={selectedMethodId}
                  onChange={(e) => setSelectedMethodId(e.target.value)}
                  className="bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded px-2.5 py-1.5 text-xs text-[#141413] dark:text-[#F5F3EE] max-w-[230px]"
                >
                  {withdrawalMethods.length === 0 ? (
                    <option value="">Default Owner Treasury</option>
                  ) : (
                    withdrawalMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.destinationLabel} ({m.maskedAccount}) · {m.currency}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {workbenchTab === 'pending' ? (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                      Watched Publications Holding Unconverted Bundles
                    </h3>
                    <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                      Real video stream and reading sessions metered across MTN, Telecel, AirtelTigo, Safaricom &amp; Global carriers.
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-3 py-4">
                    <div className="h-16 bg-[#EFECE4] dark:bg-[#242320] rounded animate-pulse" />
                    <div className="h-16 bg-[#EFECE4] dark:bg-[#242320] rounded animate-pulse" />
                  </div>
                ) : (summary?.pendingSessions.length ?? 0) === 0 ? (
                  <div className="p-8 text-center border border-dashed border-[#D6D1C7] dark:border-[#3A3732] rounded-md space-y-3">
                    <p className="text-sm font-medium text-[#141413] dark:text-[#F5F3EE]">
                      All publication airtime bundle sessions have been converted.
                    </p>
                    <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                      Watch a video in Video Hub, read any dispatch, or log a publication watch session directly.
                    </p>
                    <button
                      type="button"
                      onClick={() => setWorkbenchTab('direct')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:opacity-90 transition-opacity whitespace-nowrap"
                    >
                      Meter Publication Watch Session
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] border border-[#E5E2DC] dark:border-[#2C2A26] bg-white dark:bg-[#141413] rounded-md">
                    {summary?.pendingSessions.map((sess) => {
                      const mins = (sess.watchSeconds / 60).toFixed(1);
                      const isRowBusy = submittingAction && activeRowId === sess.id;
                      return (
                        <div
                          key={sess.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FBF9F5] dark:hover:bg-[#191816] transition-colors"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="text-xs text-[#57534E] dark:text-[#A8A29E] flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">
                                {sess.publicationType === 'video_reel'
                                  ? 'Video Reel'
                                  : sess.publicationType === 'investigation'
                                    ? 'Investigation'
                                    : 'Article'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{sess.carrierLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span>{sess.channel}</span>
                            </div>
                            <p className="font-semibold text-sm text-[#141413] dark:text-[#F5F3EE] truncate">
                              {sess.publicationTitle}
                            </p>
                            <p className="text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                              {mins} min watched · {sess.bundleMbSpent.toFixed(1)} MB bundle · $
                              {sess.airtimeSpendUsd.toFixed(2)} airtime (GH₵ {sess.airtimeSpendGhs.toFixed(2)})
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-mono font-bold tabular-nums text-[#15803D] dark:text-[#4ADE80]">
                                +${sess.creatorNetUsd.toFixed(2)}
                              </p>
                              <p className="text-[11px] font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                                GH₵ {(sess.creatorNetUsd * (summary?.fxRates.GHS ?? 11.83)).toFixed(2)}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={submittingAction}
                              onClick={() => void handleConvertPending(false, sess.id)}
                              className="px-3 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded hover:border-[#991B1B] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                            >
                              {isRowBusy ? 'Converting...' : 'Convert'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Batch Convert & Instant Withdrawal Controls */}
                <div className="pt-2 space-y-3">
                  <label className="flex items-center gap-2 text-xs text-[#44403C] dark:text-[#D6D3CD] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={withdrawFullPool}
                      onChange={(e) => setWithdrawFullPool(e.target.checked)}
                      className="rounded border-[#D6D1C7] text-[#991B1B] focus:ring-[#991B1B]"
                    />
                    <span>
                      Include full withdrawable owner balance (${effectiveAvailableUsd.toFixed(2)} USD) when triggering immediate withdrawal
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={submittingAction || (summary?.pendingSessions.length ?? 0) === 0}
                      onClick={() => void handleConvertPending(false)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#141413] hover:bg-[#292524] dark:bg-[#F5F3EE] dark:text-[#141413] dark:hover:bg-[#E5E2DC] rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>
                        Convert All Pending (+${(summary?.pendingSummary.creatorNetUsd ?? 0).toFixed(2)})
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={submittingAction || (summary?.pendingSessions.length ?? 0) === 0}
                      onClick={() => void handleConvertPending(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>
                        Convert All &amp; Withdraw to {activeMethod ? activeMethod.destinationLabel : 'Owner Payout'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Tab B: Direct Publication Watch & Airtime Bundle Converter */
              <form onSubmit={handleFormSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="airtime-pub-select"
                      className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3CD] mb-1.5"
                    >
                      Watched Publication (Video Reel, Article, or Investigation)
                    </label>
                    <select
                      id="airtime-pub-select"
                      value={selectedPubId}
                      onChange={(e) => setSelectedPubId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      <optgroup label="Video Reels & Broadcasts">
                        {publicationOptions.reelOpts.map((p) => (
                          <option key={p.id} value={p.id}>
                            [Video] {p.title}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Editorial Articles & Investigations">
                        {publicationOptions.articleOpts.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.type === 'investigation' ? 'Investigation' : 'Article'}] {p.title}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="airtime-carrier-select"
                      className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3CD] mb-1.5"
                    >
                      Mobile Carrier &amp; Bundle Plan
                    </label>
                    <select
                      id="airtime-carrier-select"
                      value={selectedCarrierCode}
                      onChange={(e) => setSelectedCarrierCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      {(summary?.carriers ?? []).map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="airtime-channel-select"
                      className="block text-xs font-semibold text-[#44403C] dark:text-[#D6D3CD] mb-1.5"
                    >
                      Publication Platform Channel
                    </label>
                    <select
                      id="airtime-channel-select"
                      value={selectedChannel}
                      onChange={(e) => setSelectedChannel(e.target.value as RevenueChannel)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      <option value="website">News Hub 24+.com Website</option>
                      <option value="android_apk">News Hub 24+ Android APK</option>
                      <option value="base44_app">Base44 Official App</option>
                    </select>
                  </div>
                </div>

                {/* Basis Selector & Quick Presets */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#44403C] dark:text-[#D6D3CD]">
                      Bundle Telemetry Measurement Basis
                    </span>
                    <div className="inline-flex items-center gap-1 p-1 bg-[#EFECE4] dark:bg-[#242320] rounded">
                      <button
                        type="button"
                        onClick={() => setInputBasis('watch_minutes')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap ${
                          inputBasis === 'watch_minutes'
                            ? 'bg-white dark:bg-[#141413] text-[#141413] dark:text-[#F5F3EE]'
                            : 'text-[#57534E] dark:text-[#A8A29E]'
                        }`}
                      >
                        Watch Minutes
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputBasis('bundle_mb')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap ${
                          inputBasis === 'bundle_mb'
                            ? 'bg-white dark:bg-[#141413] text-[#141413] dark:text-[#F5F3EE]'
                            : 'text-[#57534E] dark:text-[#A8A29E]'
                        }`}
                      >
                        Data Bundle (MB)
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputBasis('airtime_usd')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap ${
                          inputBasis === 'airtime_usd'
                            ? 'bg-white dark:bg-[#141413] text-[#141413] dark:text-[#F5F3EE]'
                            : 'text-[#57534E] dark:text-[#A8A29E]'
                        }`}
                      >
                        Airtime Spend ($ USD)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {inputBasis === 'watch_minutes' && (
                      <div>
                        <label
                          htmlFor="watch-minutes-input"
                          className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
                        >
                          Total Minutes Watched on Publication
                        </label>
                        <input
                          id="watch-minutes-input"
                          type="number"
                          min="1"
                          max="100000"
                          step="0.5"
                          value={watchMinutesInput}
                          onChange={(e) => setWatchMinutesInput(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                        />
                      </div>
                    )}

                    {inputBasis === 'bundle_mb' && (
                      <div>
                        <label
                          htmlFor="bundle-mb-input"
                          className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
                        >
                          Data Bundle Consumed (MB)
                        </label>
                        <input
                          id="bundle-mb-input"
                          type="number"
                          min="1"
                          max="1000000"
                          step="1"
                          value={bundleMbInput}
                          onChange={(e) => setBundleMbInput(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                        />
                      </div>
                    )}

                    {inputBasis === 'airtime_usd' && (
                      <div>
                        <label
                          htmlFor="airtime-usd-input"
                          className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
                        >
                          Airtime Equivalent Spent (USD)
                        </label>
                        <input
                          id="airtime-usd-input"
                          type="number"
                          min="0.05"
                          max="50000"
                          step="0.05"
                          value={airtimeUsdInput}
                          onChange={(e) => setAirtimeUsdInput(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="airtime-note-input"
                        className="block text-xs text-[#57534E] dark:text-[#A8A29E] mb-1"
                      >
                        Audit Note (Optional)
                      </label>
                      <input
                        id="airtime-note-input"
                        type="text"
                        maxLength={140}
                        placeholder="e.g. Evening newsroom stream batch"
                        value={customNote}
                        onChange={(e) => setCustomNote(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">Quick Presets:</span>
                    {PRESET_WATCH_BUNDLES.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setWatchMinutesInput(preset.minutes);
                          setBundleMbInput(preset.mb);
                          setInputBasis('watch_minutes');
                        }}
                        className="px-2.5 py-1 text-[11px] font-mono tabular-nums bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded hover:border-[#991B1B] transition-colors whitespace-nowrap"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                  <button
                    type="button"
                    disabled={submittingAction || liveQuote.creatorNetUsd < 0.01}
                    onClick={() => void handleDirectSubmit('meter')}
                    className="px-4 py-2.5 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#242320] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    Queue to Pending Pool
                  </button>

                  <button
                    type="submit"
                    disabled={submittingAction || liveQuote.creatorNetUsd < 0.01}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#141413] hover:bg-[#292524] dark:bg-[#F5F3EE] dark:text-[#141413] dark:hover:bg-[#E5E2DC] rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Convert (+${liveQuote.creatorNetUsd.toFixed(2)} USD)</span>
                  </button>

                  <button
                    type="button"
                    disabled={submittingAction || liveQuote.creatorNetUsd < 0.01}
                    onClick={() => void handleDirectSubmit('convert_withdraw')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Convert &amp; Withdraw Now</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right 5 Columns: Live Yield Calculator & Carrier Rate Schedule */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Verified Bundle Valuation Breakdown
                </h3>
                <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]">
                  {summary?.settlementStatus.settlementMode === 'live_configured'
                    ? 'Live Gateway Ready'
                    : 'Verified Ledger'}
                </span>
              </div>

              {workbenchTab === 'pending' && (summary?.pendingSummary.sessionsCount ?? 0) > 0 ? (
                <dl className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] text-xs">
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-[#57534E] dark:text-[#A8A29E]">Total Watched Duration</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                      {summary?.pendingSummary.watchMinutes.toFixed(1)} mins ({summary?.pendingSummary.watchHours.toFixed(2)}h)
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-[#57534E] dark:text-[#A8A29E]">Mobile Bundle Spent</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                      {summary?.pendingSummary.bundleMbSpent.toFixed(1)} MB (${summary?.pendingSummary.airtimeSpendUsd.toFixed(2)})
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-[#57534E] dark:text-[#A8A29E]">Gross Telemetry + Ad Yield</dt>
                    <dd className="font-mono tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                      ${summary?.pendingSummary.grossYieldUsd.toFixed(2)} USD
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      Creator Verified Net (70%)
                    </dt>
                    <dd className="font-mono font-bold text-base tabular-nums text-[#15803D] dark:text-[#4ADE80]">
                      ${summary?.pendingSummary.creatorNetUsd.toFixed(2)} USD
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-[#57534E] dark:text-[#A8A29E]">Withdrawable GH₵ &amp; SOL</dt>
                    <dd className="font-mono tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                      GH₵ {summary?.pendingSummary.withdrawGhs.toFixed(2)} / {summary?.pendingSummary.equivalentSol.toFixed(4)} SOL
                    </dd>
                  </div>
                </dl>
              ) : (
                <dl className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] text-xs">
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-[#57534E] dark:text-[#A8A29E]">Selected Carrier</dt>
                    <dd className="font-medium text-[#141413] dark:text-[#F5F3EE]">
                      {liveQuote.carrier.label}
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-[#57534E] dark:text-[#A8A29E]">Publication Watch Time</dt>
                    <dd className="font-mono tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                      {liveQuote.mins.toFixed(1)} mins ({(liveQuote.mins / 60).toFixed(2)}h)
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-[#57534E] dark:text-[#A8A29E]">Airtime / Data Bundle</dt>
                    <dd className="font-mono tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                      {liveQuote.mb.toFixed(1)} MB · {liveQuote.carrier.currencySymbol}
                      {liveQuote.airtimeLocal.toFixed(2)} (${liveQuote.airtimeUsd.toFixed(2)})
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-[#57534E] dark:text-[#A8A29E]">Gross Yield / Platform (30%)</dt>
                    <dd className="font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                      ${liveQuote.grossUsd.toFixed(2)} / -${liveQuote.platformFeeUsd.toFixed(2)}
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      Withdrawable Creator Net (70%)
                    </dt>
                    <dd className="font-mono font-bold text-base tabular-nums text-[#15803D] dark:text-[#4ADE80]">
                      ${liveQuote.creatorNetUsd.toFixed(2)} USD
                    </dd>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <dt className="text-[#57534E] dark:text-[#A8A29E]">GhanaPay / MoMo &amp; Solana</dt>
                    <dd className="font-mono tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                      GH₵ {liveQuote.withdrawGhs.toFixed(2)} · {liveQuote.equivalentSol.toFixed(4)} SOL
                    </dd>
                  </div>
                </dl>
              )}

              <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] pt-1 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>{summary?.settlementStatus.note ?? 'Credits directly to verified owner treasury balance.'}</span>
              </p>
            </div>

            {/* Carrier Yield Schedule Table */}
            <div className="border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
              <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#191816] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between">
                <h4 className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Carrier Data-to-Revenue Conversion Rates
                </h4>
                <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]">70% Creator Share</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-[#E5E2DC] dark:border-[#2C2A26] text-[#57534E] dark:text-[#A8A29E]">
                    <tr>
                      <th className="text-left font-medium px-4 py-2">Carrier</th>
                      <th className="text-right font-medium px-3 py-2">Yield / GB</th>
                      <th className="text-right font-medium px-4 py-2">Watch / Min</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                    {(summary?.carriers ?? []).map((c) => (
                      <tr key={c.code} className="hover:bg-[#FBF9F5] dark:hover:bg-[#191816]">
                        <td className="px-4 py-2 text-[#141413] dark:text-[#F5F3EE] font-medium">
                          {c.country} · {c.code.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                          ${c.creatorYieldPerGbUsd.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-[#15803D] dark:text-[#4ADE80]">
                          +${c.watchBonusPerMinuteUsd.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Verified Airtime Bundle Conversion & Withdrawal Ledger Table */}
        <div className="border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
          <div className="px-5 py-4 bg-[#FBF9F5] dark:bg-[#191816] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                Verified Airtime Bundle Revenue Ledger
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                Immutable audit log linking watched publication bundles to credited USD/GH₵/SOL balances and payout references.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 p-1 bg-[#EFECE4] dark:bg-[#242320] rounded">
                {(['all', 'Converted & Withdrawn', 'Verified & Credited'] as const).map((statusOpt) => (
                  <button
                    key={statusOpt}
                    type="button"
                    onClick={() => setLedgerFilter(statusOpt)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap shrink-0 ${
                      ledgerFilter === statusOpt
                        ? 'bg-white dark:bg-[#141413] text-[#141413] dark:text-[#F5F3EE]'
                        : 'text-[#57534E] dark:text-[#A8A29E]'
                    }`}
                  >
                    {statusOpt === 'all' ? 'All Records' : statusOpt}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search publication or ref..."
                  aria-label="Search conversion ledger"
                  className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto bg-white dark:bg-[#141413]">
            {loading ? (
              <div className="p-6 space-y-2">
                <div className="h-10 bg-[#F5F2EB] dark:bg-[#1C1B19] rounded animate-pulse" />
                <div className="h-10 bg-[#F5F2EB] dark:bg-[#1C1B19] rounded animate-pulse" />
              </div>
            ) : filteredConversions.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#57534E] dark:text-[#A8A29E]">
                No airtime bundle conversion records match your current filter.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="border-b border-[#E5E2DC] dark:border-[#2C2A26] text-[#57534E] dark:text-[#A8A29E]">
                  <tr>
                    <th className="text-left font-medium px-5 py-3">Ref &amp; Timestamp</th>
                    <th className="text-left font-medium px-4 py-3">Publication &amp; Carrier</th>
                    <th className="text-right font-medium px-4 py-3">Watch / Bundle</th>
                    <th className="text-right font-medium px-4 py-3">Airtime Spent</th>
                    <th className="text-right font-medium px-4 py-3">Verified Revenue</th>
                    <th className="text-left font-medium px-5 py-3">Settlement &amp; Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                  {filteredConversions.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FBF9F5] dark:hover:bg-[#191816]">
                      <td className="px-5 py-3 align-top whitespace-nowrap">
                        <p className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE]">{row.id}</p>
                        <p className="text-[11px] font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                          {row.createdAt.slice(0, 16).replace('T', ' ')}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top max-w-xs">
                        <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                          {row.publicationTitle}
                        </p>
                        <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          {row.carrierLabel} · {row.channel}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-right font-mono tabular-nums whitespace-nowrap text-[#141413] dark:text-[#F5F3EE]">
                        <p>{row.bundleMbSpent.toFixed(1)} MB</p>
                        <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          {row.watchMinutes.toFixed(1)} mins
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-right font-mono tabular-nums whitespace-nowrap text-[#141413] dark:text-[#F5F3EE]">
                        <p>${row.airtimeSpendUsd.toFixed(2)}</p>
                        <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          GH₵ {row.airtimeSpendGhs.toFixed(2)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-right font-mono tabular-nums whitespace-nowrap">
                        <p className="font-bold text-[#15803D] dark:text-[#4ADE80]">
                          +${row.creatorNetUsd.toFixed(2)} USD
                        </p>
                        <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          GH₵ {row.withdrawGhs.toFixed(2)} · {row.equivalentSol.toFixed(4)} SOL
                        </p>
                      </td>
                      <td className="px-5 py-3 align-top whitespace-nowrap">
                        <p
                          className={`font-semibold ${
                            row.status === 'Converted & Withdrawn'
                              ? 'text-[#15803D] dark:text-[#4ADE80]'
                              : 'text-[#141413] dark:text-[#F5F3EE]'
                          }`}
                        >
                          {row.status}
                        </p>
                        <p className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]">
                          {row.withdrawalId
                            ? `Payout ${row.withdrawalId}`
                            : row.settlementMode === 'live_configured'
                              ? 'Live Gateway Ready'
                              : 'Verified Treasury Ledger'}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
