import {
  Activity,
  ArrowRightLeft,
  CheckCircle2,
  Coins,
  Landmark,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface TreasuryAccountItem {
  id: string;
  name: string;
  category: 'asset' | 'liability' | 'equity' | 'yield_bucket';
  currency: 'USD' | 'SOL' | 'GHS';
  apyPercent: number;
  balanceUsd: number;
  description: string;
}

interface TreasuryJournalEntryItem {
  id: string;
  timestamp: string;
  entryType:
    | 'TREASURY_INFLOW'
    | 'PROCESSOR_FEE'
    | 'CREATOR_SPLIT'
    | 'RESERVE_HOLD'
    | 'TREASURY_DISBURSEMENT'
    | 'REVERSAL'
    | 'YIELD_ALLOCATION'
    | 'YIELD_HARVEST'
    | 'CREATOR_EARNINGS_CLAIM';
  debitAccount: string;
  creditAccount: string;
  amountUsd: number;
  currency: string;
  amountLocal?: number;
  rail: string;
  referenceId: string;
  externalVerified: boolean;
  description: string;
  runningOperatingUsd: number;
  runningCreatorPayableUsd: number;
}

interface TreasuryPolicy {
  operatingBufferPct: number;
  usdYieldPoolPct: number;
  solanaVaultPct: number;
  ghsLiquidityPct: number;
  autoSweepEnabled: boolean;
  autoSweepThresholdUsd: number;
  reserveRatioTargetPct: number;
  updatedAt: string;
}

interface TreasuryAudit {
  status: 'balanced' | 'discrepancy_detected';
  checkedAt: string;
  totalDebitsUsd: number;
  totalCreditsUsd: number;
  sandboxEntriesDetected: number;
  unreconciledDeltaUsd: number;
  pendingPayoutMatchDeltaUsd: number;
  checksPassed: number;
  checksTotal: number;
  notes: string[];
}

interface CapitalEfficiencyMetrics {
  totalAssetLiquidityUsd: number;
  deployedCapitalUsd: number;
  idleCashUsd: number;
  deploymentRatioPercent: number;
  idleFloatPercent: number;
  blendedPortfolioApyPercent: number;
  projectedAnnualYieldUsd: number;
  projectedMonthlyYieldUsd: number;
  accruedYieldUsd: number;
  lifetimeYieldHarvestedUsd: number;
  creatorPayableUsd: number;
  platformReserveUsd: number;
  chargebackReserveUsd: number;
  netWorkingCapitalUsd: number;
  reserveCoverageRatioPercent: number;
  weightedAvgFeeDragPercent: number;
  lifetimeInflowGrossUsd: number;
  lifetimeProcessorFeesUsd: number;
  lifetimeDisbursedUsd: number;
}

interface RankedSettlementRail {
  methodId: string;
  label: string;
  speed: string;
  finalityScore: number;
  grossAmountUsd: number;
  totalFeeUsd: number;
  netAmountUsd: number;
  effectiveFeePercent: number;
  currencyLocal: string;
  netLocal: number;
  feeBreakdownLabel: string;
}

interface RouteOptimizationPayload {
  amountUsd: number;
  targetCurrency: string;
  corridorType: 'domestic' | 'intra_africa' | 'cross_continent';
  recommendedZeroFeeRail: RankedSettlementRail;
  recommendedExternalRail: RankedSettlementRail;
  savingsVsHighFeeRailUsd: number;
  rankedRails: RankedSettlementRail[];
}

interface TreasuryOverviewResponse {
  generatedAt: string;
  accountMode: 'live_production';
  sandboxDisabledAt: string;
  accounts: TreasuryAccountItem[];
  policy: TreasuryPolicy;
  capitalEfficiency: CapitalEfficiencyMetrics;
  lastAudit: TreasuryAudit;
  recentEntries: TreasuryJournalEntryItem[];
  fxRates: {
    GHS: number;
    NGN: number;
    KES: number;
    ZAR: number;
    rates?: Record<string, number>;
  };
  solUsdRate: {
    usdPerSol: number;
    source: string;
  };
  gatewayCapabilities: {
    stripeConfigured: boolean;
    paypalConfigured: boolean;
    flutterwaveConfigured: boolean;
    ghanaPayConfigured: boolean;
    ghanaMomoDefaultNumber: string;
    solanaMainnetActive: boolean;
  };
}

interface TreasuryIntegrityYieldSectionProps {
  externalRefreshKey?: number;
  onTreasuryMutated?: () => void;
}

type JournalFilter = 'all' | 'inflows' | 'claims' | 'disbursements' | 'yield' | 'reversals';

export function TreasuryIntegrityYieldSection({
  externalRefreshKey = 0,
  onTreasuryMutated
}: TreasuryIntegrityYieldSectionProps) {
  const [overview, setOverview] = useState<TreasuryOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [journalFilter, setJournalFilter] = useState<JournalFilter>('all');

  // Policy Allocation State
  const [opPct, setOpPct] = useState<number>(25);
  const [tbillPct, setTbillPct] = useState<number>(40);
  const [solPct, setSolPct] = useState<number>(20);
  const [ghsPct, setGhsPct] = useState<number>(15);
  const [reservePct, setReservePct] = useState<number>(5);
  const [autoSweepEnabled, setAutoSweepEnabled] = useState<boolean>(true);
  const [autoSweepThreshold, setAutoSweepThreshold] = useState<number>(50);
  const [policyBusy, setPolicyBusy] = useState<boolean>(false);
  const [harvestBusy, setHarvestBusy] = useState<boolean>(false);
  const [auditBusy, setAuditBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Settlement Rail Cost & FX Optimizer State
  const [routeAmountUsd, setRouteAmountUsd] = useState<string>('250');
  const [routeCurrency, setRouteCurrency] = useState<string>('GHS');
  const [routeCorridor, setRouteCorridor] = useState<'domestic' | 'intra_africa' | 'cross_continent'>(
    'domestic'
  );
  const [routeResult, setRouteResult] = useState<RouteOptimizationPayload | null>(null);
  const [routeBusy, setRouteBusy] = useState<boolean>(false);

  const loadTreasury = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/treasury/overview');
      if (res.ok) {
        const data = (await res.json()) as TreasuryOverviewResponse;
        setOverview(data);
        setOpPct(data.policy.operatingBufferPct);
        setTbillPct(data.policy.usdYieldPoolPct);
        setSolPct(data.policy.solanaVaultPct);
        setGhsPct(data.policy.ghsLiquidityPct);
        setReservePct(data.policy.reserveRatioTargetPct);
        setAutoSweepEnabled(data.policy.autoSweepEnabled);
        setAutoSweepThreshold(data.policy.autoSweepThresholdUsd);
      }
    } catch {
      // Keep last known treasury snapshot cleanly
    } finally {
      setLoading(false);
    }
  }, []);

  const runRouteOptimization = useCallback(
    async (amt: number, currency: string, corridor: 'domestic' | 'intra_africa' | 'cross_continent') => {
      setRouteBusy(true);
      try {
        const res = await fetch('/api/treasury/optimize-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountUsd: amt,
            targetCurrency: currency,
            corridorType: corridor
          })
        });
        if (res.ok) {
          const json = (await res.json()) as { optimization: RouteOptimizationPayload };
          setRouteResult(json.optimization);
        }
      } catch {
        // Non-fatal optimizer retry error
      } finally {
        setRouteBusy(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadTreasury();
  }, [loadTreasury, externalRefreshKey]);

  useEffect(() => {
    void runRouteOptimization(250, 'GHS', 'domestic');
  }, [runRouteOptimization]);

  const pctTotal = opPct + tbillPct + solPct + ghsPct;

  const handleRunAudit = async () => {
    setFeedback(null);
    setAuditBusy(true);
    try {
      const res = await fetch('/api/treasury/reconcile', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed.');
      if (data.overview) setOverview(data.overview as TreasuryOverviewResponse);
      setFeedback({ type: 'success', text: data.message as string });
      onTreasuryMutated?.();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to run treasury audit.'
      });
    } finally {
      setAuditBusy(false);
    }
  };

  const handleDeployAllocation = async () => {
    setFeedback(null);
    if (pctTotal !== 100) {
      setFeedback({
        type: 'error',
        text: `Capital allocation weights must sum to 100% (currently ${pctTotal}%).`
      });
      return;
    }
    setPolicyBusy(true);
    try {
      const res = await fetch('/api/treasury/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatingBufferPct: opPct,
          usdYieldPoolPct: tbillPct,
          solanaVaultPct: solPct,
          ghsLiquidityPct: ghsPct,
          reserveRatioTargetPct: reservePct,
          autoSweepEnabled,
          autoSweepThresholdUsd: autoSweepThreshold
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not rebalance treasury capital.');
      if (data.overview) setOverview(data.overview as TreasuryOverviewResponse);
      setFeedback({ type: 'success', text: data.message as string });
      onTreasuryMutated?.();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to deploy treasury capital.'
      });
    } finally {
      setPolicyBusy(false);
    }
  };

  const handleHarvestYield = async () => {
    setFeedback(null);
    setHarvestBusy(true);
    try {
      const res = await fetch('/api/treasury/harvest-yield', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not harvest yield.');
      if (data.overview) setOverview(data.overview as TreasuryOverviewResponse);
      setFeedback({ type: 'success', text: data.message as string });
      onTreasuryMutated?.();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to harvest yield.'
      });
    } finally {
      setHarvestBusy(false);
    }
  };

  const filteredEntries = (overview?.recentEntries ?? []).filter((entry) => {
    if (journalFilter === 'all') return true;
    if (journalFilter === 'inflows') {
      return (
        entry.entryType === 'TREASURY_INFLOW' ||
        entry.entryType === 'PROCESSOR_FEE' ||
        entry.entryType === 'CREATOR_SPLIT' ||
        entry.entryType === 'RESERVE_HOLD'
      );
    }
    if (journalFilter === 'claims') return entry.entryType === 'CREATOR_EARNINGS_CLAIM';
    if (journalFilter === 'disbursements') return entry.entryType === 'TREASURY_DISBURSEMENT';
    if (journalFilter === 'yield') {
      return entry.entryType === 'YIELD_ALLOCATION' || entry.entryType === 'YIELD_HARVEST';
    }
    return entry.entryType === 'REVERSAL';
  });

  const eff = overview?.capitalEfficiency;
  const audit = overview?.lastAudit;
  const fxGhs = overview?.fxRates?.GHS ?? 15.5;
  const solUsd = overview?.solUsdRate?.usdPerSol ?? 185;

  return (
    <section
      id="treasury-integrity"
      aria-labelledby="treasury-integrity-heading"
      className="py-12 border-t border-[#E5E2DC] dark:border-[#2C2A26]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#14532D] dark:text-[#4ADE80] mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Live Production Account · Sandbox Terminated</span>
            </p>
            <h2
              id="treasury-integrity-heading"
              className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] tracking-tight"
            >
              Treasury Operational Integrity &amp; Capital Yield Optimization
            </h2>
            <p className="mt-2 text-sm text-[#44403C] dark:text-[#D6D3CD] max-w-3xl leading-relaxed">
              Immutable double-entry general ledger verifying 100% liquidity coverage across Operating Cash, Creator Payables, Risk Reserves, T-Bill Yield, Solana Staking, and GhanaPay GH₵ float — with live settlement rail cost optimization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-md border ${
                audit?.status === 'balanced'
                  ? 'bg-[#F0FDF4] dark:bg-[#0E2416] text-[#14532D] dark:text-[#4ADE80] border-[#BBF7D0] dark:border-[#166534]'
                  : 'bg-[#FFFBEB] dark:bg-[#261D0B] text-[#92400E] dark:text-[#FDE68A] border-[#FDE68A] dark:border-[#78350F]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {audit?.status === 'balanced'
                  ? `Balanced · ${audit.checksPassed}/${audit.checksTotal} Integrity Checks`
                  : 'Review Required'}
              </span>
            </span>

            <button
              type="button"
              disabled={auditBusy || loading}
              onClick={() => void handleRunAudit()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#141413] hover:bg-[#292524] dark:bg-[#F5F3EE] dark:text-[#141413] dark:hover:bg-[#E5E2DC] rounded-md disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${auditBusy || loading ? 'animate-spin' : ''}`} />
              <span>{auditBusy ? 'Auditing…' : 'Run Ledger Audit'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`p-3.5 rounded-md border text-xs font-medium flex items-start gap-2 ${
              feedback.type === 'success'
                ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Band 1: Capital Efficiency KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] block">
              Total Treasury Liquidity
            </span>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              ${(eff?.totalAssetLiquidityUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
              GH₵ {((eff?.totalAssetLiquidityUsd ?? 0) * fxGhs).toFixed(2)} · {( (eff?.totalAssetLiquidityUsd ?? 0) / Math.max(1, solUsd) ).toFixed(4)} SOL
            </span>
          </div>

          <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] block">
              Capital Deployment Ratio
            </span>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              {(eff?.deploymentRatioPercent ?? 0).toFixed(1)}%
            </p>
            <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
              ${(eff?.deployedCapitalUsd ?? 0).toFixed(2)} deployed · {(eff?.idleFloatPercent ?? 0).toFixed(1)}% idle
            </span>
          </div>

          <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] block">
              Blended Portfolio APY
            </span>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              {(eff?.blendedPortfolioApyPercent ?? 0).toFixed(2)}%
            </p>
            <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
              Est. +${(eff?.projectedAnnualYieldUsd ?? 0).toFixed(2)}/yr · +${(eff?.lifetimeYieldHarvestedUsd ?? 0).toFixed(2)} harvested
            </span>
          </div>

          <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] block">
              Reserve Coverage Ratio
            </span>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {(eff?.reserveCoverageRatioPercent ?? 100).toFixed(1)}%
            </p>
            <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
              Creator Payable: ${(eff?.creatorPayableUsd ?? 0).toFixed(2)}
            </span>
          </div>

          <div className="p-4 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] block">
              Weighted Fee Drag
            </span>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {(eff?.weightedAvgFeeDragPercent ?? 0).toFixed(2)}%
            </p>
            <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
              Fees ${(eff?.lifetimeProcessorFeesUsd ?? 0).toFixed(2)} / Gross ${(eff?.lifetimeInflowGrossUsd ?? 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Band 2: 7 Chart of Accounts Balances + Reconciliation Notes */}
        <div className="p-6 bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
              <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                Double-Entry Treasury Chart of Accounts (Zero Sandbox Entries)
              </h3>
            </div>
            <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
              Debits ${((audit?.totalDebitsUsd ?? 0)).toFixed(2)} · Credits ${((audit?.totalCreditsUsd ?? 0)).toFixed(2)} · Sandbox Count: {audit?.sandboxEntriesDetected ?? 0}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {(overview?.accounts ?? []).map((acct) => (
              <div
                key={acct.id}
                className="p-4 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="uppercase text-[#57534E] dark:text-[#A8A29E]">
                      {acct.category.replace('_', ' ')} · {acct.currency}
                    </span>
                    {acct.apyPercent > 0 && (
                      <span className="font-semibold text-[#14532D] dark:text-[#4ADE80]">
                        {acct.apyPercent.toFixed(2)}% APY
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    {acct.name}
                  </p>
                </div>

                <div>
                  <p className="font-mono text-xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    ${acct.balanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-snug">
                    {acct.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {audit && audit.notes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26] text-xs">
              {audit.notes.map((note) => (
                <div key={note} className="flex items-start gap-2 text-[#44403C] dark:text-[#D6D3CD]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80] shrink-0 mt-0.5" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Band 3: Capital Yield Allocation Controls + Interactive Settlement Rail Cost & FX Optimizer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 Cols: Yield Policy & Auto-Sweep Deployment */}
          <div className="lg:col-span-5 p-6 bg-white dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div>
                <p className="text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Capital Efficiency &amp; Yield Policy</span>
                </p>
                <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Deploy Idle Float &amp; Harvest Yield
                </h3>
              </div>
              <span
                className={`font-mono text-xs font-bold tabular-nums ${
                  pctTotal === 100
                    ? 'text-[#14532D] dark:text-[#4ADE80]'
                    : 'text-[#991B1B] dark:text-[#F87171]'
                }`}
              >
                Sum: {pctTotal}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label htmlFor="alloc-op" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Operating Buffer (% · 0.5% APY)
                </label>
                <input
                  id="alloc-op"
                  type="number"
                  min={5}
                  max={85}
                  value={opPct}
                  onChange={(e) => setOpPct(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="alloc-tbill" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  USD T-Bill Pool (% · 4.85% APY)
                </label>
                <input
                  id="alloc-tbill"
                  type="number"
                  min={0}
                  max={85}
                  value={tbillPct}
                  onChange={(e) => setTbillPct(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="alloc-sol" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Solana Staking (% · 6.40% APY)
                </label>
                <input
                  id="alloc-sol"
                  type="number"
                  min={0}
                  max={60}
                  value={solPct}
                  onChange={(e) => setSolPct(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="alloc-ghs" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  GhanaPay GHS Float (% · 3.20% APY)
                </label>
                <input
                  id="alloc-ghs"
                  type="number"
                  min={0}
                  max={60}
                  value={ghsPct}
                  onChange={(e) => setGhsPct(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="alloc-reserve" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Dispute Reserve Hold (%)
                </label>
                <input
                  id="alloc-reserve"
                  type="number"
                  min={0}
                  max={20}
                  value={reservePct}
                  onChange={(e) => setReservePct(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="alloc-threshold" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Auto-Sweep Trigger (USD)
                </label>
                <input
                  id="alloc-threshold"
                  type="number"
                  min={10}
                  value={autoSweepThreshold}
                  onChange={(e) => setAutoSweepThreshold(Number(e.target.value) || 50)}
                  className="w-full px-3 py-2 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#292524] dark:text-[#D6D3CD] cursor-pointer">
              <input
                type="checkbox"
                checked={autoSweepEnabled}
                onChange={(e) => setAutoSweepEnabled(e.target.checked)}
                className="rounded-xs border-[#D6D1C7]"
              />
              <span>Auto-sweep excess operating cash above threshold into Yield Pools</span>
            </label>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
              <button
                type="button"
                disabled={policyBusy || pctTotal !== 100}
                onClick={() => void handleDeployAllocation()}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-50 transition-colors"
              >
                {policyBusy ? 'Rebalancing…' : 'Deploy & Rebalance Capital'}
              </button>
              <button
                type="button"
                disabled={harvestBusy}
                onClick={() => void handleHarvestYield()}
                className="px-4 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-[#FBF9F5] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] disabled:opacity-50 transition-colors"
              >
                {harvestBusy ? 'Harvesting…' : 'Harvest Yield'}
              </button>
            </div>
          </div>

          {/* Right 7 Cols: Interactive Settlement Rail Cost & FX Optimizer */}
          <div className="lg:col-span-7 p-6 bg-white dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div>
                <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Settlement Rail Cost &amp; FX Router</span>
                </p>
                <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Real-Time Fee Drag Optimizer (Ghana, Pan-Africa &amp; Global)
                </h3>
              </div>
              {routeResult && (
                <span className="font-mono text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  Save up to ${routeResult.savingsVsHighFeeRailUsd.toFixed(2)} vs Card/PayPal
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
              <div>
                <label htmlFor="opt-amount" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Transfer Amount (USD)
                </label>
                <input
                  id="opt-amount"
                  type="number"
                  min={1}
                  value={routeAmountUsd}
                  onChange={(e) => setRouteAmountUsd(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="opt-currency" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Target Currency
                </label>
                <select
                  id="opt-currency"
                  value={routeCurrency}
                  onChange={(e) => setRouteCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                >
                  <option value="GHS">GHS (Ghana Cedi)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="NGN">NGN (Nigerian Naira)</option>
                  <option value="KES">KES (Kenyan Shilling)</option>
                  <option value="GBP">GBP (British Pound)</option>
                  <option value="EUR">EUR (Euro)</option>
                </select>
              </div>

              <div>
                <label htmlFor="opt-corridor" className="block font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Settlement Corridor
                </label>
                <select
                  id="opt-corridor"
                  value={routeCorridor}
                  onChange={(e) =>
                    setRouteCorridor(
                      e.target.value as 'domestic' | 'intra_africa' | 'cross_continent'
                    )
                  }
                  className="w-full px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                >
                  <option value="domestic">Domestic / Local</option>
                  <option value="intra_africa">Intra-Africa</option>
                  <option value="cross_continent">Cross-Continent</option>
                </select>
              </div>

              <button
                type="button"
                disabled={routeBusy}
                onClick={() =>
                  void runRouteOptimization(
                    Math.max(1, Number(routeAmountUsd) || 250),
                    routeCurrency,
                    routeCorridor
                  )
                }
                className="px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-sm disabled:opacity-50 transition-colors"
              >
                {routeBusy ? 'Quoting…' : 'Quote Best Rail'}
              </button>
            </div>

            {routeResult && (
              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
                {routeResult.rankedRails.slice(0, 6).map((rail, idx) => (
                  <div
                    key={rail.methodId}
                    className={`px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      idx <= 1 ? 'bg-[#F0FDF4]/60 dark:bg-[#0E2416]/50' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#14532D] dark:text-[#4ADE80]">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                          {rail.label}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] block truncate">
                        {rail.speed} · {rail.feeBreakdownLabel}
                      </span>
                    </div>

                    <div className="sm:text-right font-mono tabular-nums shrink-0">
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block">
                        Net ${rail.netAmountUsd.toFixed(2)} USD
                        {rail.currencyLocal !== 'USD' ? ` (${rail.currencyLocal} ${rail.netLocal.toLocaleString()})` : ''}
                      </span>
                      <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                        Fee ${rail.totalFeeUsd.toFixed(2)} ({rail.effectiveFeePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Band 4: Filterable Immutable Double-Entry Journal */}
        <div className="bg-white dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg overflow-hidden">
          <div className="px-5 py-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#14532D] dark:text-[#4ADE80]" />
              <h3 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                Immutable Double-Entry Treasury Journal
              </h3>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              {(
                [
                  ['all', 'All Entries'],
                  ['inflows', 'Inflows & Splits'],
                  ['claims', 'Creator Claims'],
                  ['disbursements', 'Withdrawals'],
                  ['yield', 'Yield Sweeps'],
                  ['reversals', 'Reversals']
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setJournalFilter(key)}
                  className={`px-2.5 py-1 font-medium rounded-sm border transition-colors ${
                    journalFilter === key
                      ? 'bg-[#141413] text-white border-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] dark:border-[#F5F3EE]'
                      : 'bg-white dark:bg-[#141413] text-[#44403C] dark:text-[#D6D3CD] border-[#D6D1C7] dark:border-[#3A3732]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#57534E] dark:text-[#A8A29E] space-y-1.5">
              <Sparkles className="w-5 h-5 mx-auto text-[#14532D] dark:text-[#4ADE80]" />
              <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                Clean Live Production Ledger Ready
              </p>
              <p>
                All legacy demo and sandbox rows have been removed. Live inflows, YouTube/TikTok creator claims, yield deployments, and owner payouts appear here in real time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E2DC] dark:border-[#2C2A26] text-[11px] uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] bg-[#FBF9F5] dark:bg-[#171715]">
                    <th className="py-2.5 px-4 font-semibold">Entry / Type</th>
                    <th className="py-2.5 px-4 font-semibold">Debit → Credit</th>
                    <th className="py-2.5 px-4 font-semibold">Rail &amp; Ref</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Amount</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Running Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                  {filteredEntries.slice(0, 25).map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#FBF9F5] dark:hover:bg-[#171715]">
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-[11px] font-semibold text-[#141413] dark:text-[#F5F3EE] block">
                          {entry.entryType}
                        </span>
                        <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E] block truncate max-w-xs">
                          {entry.description}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#44403C] dark:text-[#D6D3CD]">
                        {entry.debitAccount} → {entry.creditAccount}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                        <span className="block">{entry.rail}</span>
                        <span className="block text-[10px]">{entry.referenceId}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-[#14532D] dark:text-[#4ADE80]">
                        ${entry.amountUsd.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                        ${entry.runningCreatorPayableUsd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
