import {
  ArrowDownToLine,
  ArrowRightLeft,
  Building2,
  Check,
  Coins,
  CreditCard,
  Download,
  Infinity as InfinityIcon,
  Landmark,
  Plus,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Trash2,
  Wallet
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PayoutConfig } from './MonetizationSection';
import type { RevenueEngineResponse } from './VideoReelsHubSection';

import type { AfricaFxRates } from './PaymentModal';

const GHANA_MOMO_NETWORK_OPTIONS = [
  { code: 'MTN', label: 'MTN Mobile Money Ghana (024 / 054 / 055 / 059)' },
  { code: 'VOD', label: 'Telecel Cash Ghana (020 / 050)' },
  { code: 'ATL', label: 'AT Money / AirtelTigo Ghana (026 / 027 / 056 / 057)' }
];

const GHANA_BANK_OPTIONS = [
  { code: 'GCB', label: 'GCB Bank PLC (Ghana)' },
  { code: 'ECO', label: 'Ecobank Ghana PLC' },
  { code: 'FID', label: 'Fidelity Bank Ghana' },
  { code: 'STB', label: 'Stanbic Bank Ghana' },
  { code: 'CAL', label: 'CalBank PLC (Ghana)' },
  { code: 'CBG', label: 'Consolidated Bank Ghana (CBG)' },
  { code: 'ABG', label: 'Absa Bank Ghana' }
];

function computeEstimatedWithdrawalFeeUsd(rail: OwnerWithdrawalRail, amountUsd: number): number {
  const withdrawCents = Math.max(0, Math.round((Number.isFinite(amountUsd) ? amountUsd : 0) * 100));
  if (withdrawCents <= 1) return 0;
  let feeCents = 0;
  if (rail === 'bank_wire') {
    feeCents = withdrawCents >= 1000 ? 150 : Math.round(withdrawCents * 0.02);
  } else if (rail === 'paypal') {
    feeCents = Math.min(1000, Math.round(withdrawCents * 0.01));
  } else if (rail === 'solana') {
    feeCents = withdrawCents >= 25 ? 1 : 0;
  } else if (
    rail === 'ghana_momo' ||
    rail === 'ghanapay_transfer' ||
    rail === 'flutterwave_payout' ||
    rail === 'mobile_money'
  ) {
    feeCents = Math.min(300, Math.round(withdrawCents * 0.01));
  } else {
    feeCents = Math.min(500, Math.round(withdrawCents * 0.005));
  }
  return Math.min(Math.max(0, withdrawCents - 1), feeCents) / 100;
}

export type OwnerWithdrawalRail =
  | 'ghana_momo'
  | 'ghanapay_transfer'
  | 'flutterwave_payout'
  | 'bank_wire'
  | 'paypal'
  | 'mobile_money'
  | 'debit_card'
  | 'wise'
  | 'solana';

export interface OwnerWithdrawalMethod {
  id: string;
  rail: OwnerWithdrawalRail;
  railLabel: string;
  accountHolderName: string;
  destinationLabel: string;
  maskedAccount: string;
  routingOrCode: string;
  currency: string;
  country: string;
  isDefault: boolean;
  expirationPolicy?: 'unlimited';
  expiresAt?: null;
  addedAt: string;
}

export interface OwnerWithdrawalRecord {
  id: string;
  methodId: string;
  railLabel: string;
  destinationLabel: string;
  maskedAccount: string;
  currency: string;
  sourceScope: 'all_channels' | 'website' | 'android_apk' | 'base44_app';
  sourceScopeLabel: string;
  amountUsd: number;
  processorFeeUsd?: number;
  netSettledUsd?: number;
  currencyLocal?: string;
  amountLocal?: number;
  amountSol?: number;
  solUsdRate?: number;
  settlementMode?: 'live_configured' | 'sandbox_ledger';
  settlementReference?: string;
  gatewayFallbackNote?: string;
  expirationPolicy?: 'unlimited';
  expiresAt?: null;
  expirationLabel?: string;
  status: 'Disbursed' | 'Processing (1-2 Business Days)' | 'Reversed';
  settlementEta: string;
  note: string;
  createdAt: string;
  ownerEmail: string;
  reversedAt?: string;
  reversalId?: string;
  reversalReason?: string;
}

export interface OwnerRailMeta {
  rail: OwnerWithdrawalRail;
  label: string;
  monetizationMethodId: string;
  settlementEta: string;
  placeholderDestination: string;
  placeholderAccount: string;
  placeholderRouting: string;
}

export interface SolPriceInfo {
  usdPerSol: number;
  source: 'live' | 'cached' | 'fallback';
  updatedAt: string;
}

export interface SettlementStatusInfo {
  settlementMode: 'live_configured' | 'sandbox_ledger';
  configuredRails: string[];
  solanaRpcUrl: string;
  note: string;
}

export interface OwnerPayoutsResponse {
  owner: {
    name: string;
    email: string;
    domain: string;
    packageId: string;
  };
  withdrawalPolicy?: {
    expirationDuration: 'unlimited';
    expiresAt: null;
    label: string;
    reversalSupported: boolean;
  };
  solUsdRate?: SolPriceInfo;
  fxRates?: AfricaFxRates;
  settlementStatus?: SettlementStatusInfo;
  balances: {
    availableUsd: number;
    availableSol?: number;
    availableGhs?: number;
    totalWithdrawnUsd: number;
    totalWithdrawnSol?: number;
    lifetimeCreatorNetUsd: number;
    websiteNetUsd: number;
    androidApkNetUsd: number;
    base44AppNetUsd: number;
  };
  methods: OwnerWithdrawalMethod[];
  withdrawals: OwnerWithdrawalRecord[];
  supportedRails: OwnerRailMeta[];
}

export interface RewardConversionRecord {
  id: string;
  mode: 'accrued' | 'custom';
  platform: 'website' | 'android_apk' | 'base44_app';
  clicksConverted: number;
  watchMinutesConverted: number;
  watchHoursConverted: number;
  articleReadMinutesConverted: number;
  qualifiedViewsConverted: number;
  grossUsd: number;
  creatorNetUsd: number;
  equivalentSol: number;
  solUsdRate: number;
  note: string;
  createdAt: string;
}

export interface RewardsSummaryResponse {
  solUsdRate: SolPriceInfo;
  settlementStatus: SettlementStatusInfo;
  rates: {
    webClickNetUsd: number;
    appClickNetUsd: number;
    watchHourNetUsd: number;
    watchMinuteNetUsd: number;
    articleReadHourNetUsd: number;
    qualifiedViewNetUsd: number;
    creatorSharePercent: number;
  };
  unconverted: {
    clicks: number;
    watchSeconds: number;
    watchMinutes: number;
    watchHours: number;
    articleReadSeconds: number;
    articleReadMinutes: number;
    qualifiedViews: number;
    grossUsd: number;
    creatorNetUsd: number;
    equivalentSol: number;
    breakdown: {
      clicksNetUsd: number;
      watchTimeNetUsd: number;
      articleReadNetUsd: number;
      qualifiedViewsNetUsd: number;
    };
  };
  totals: {
    totalClicksTracked: number;
    totalWatchHoursTracked: number;
    lifetimeConvertedUsd: number;
    lifetimeConvertedSol: number;
    availableToWithdrawUsd: number;
    availableToWithdrawSol: number;
  };
  conversions: RewardConversionRecord[];
}

interface OwnerWithdrawalSectionProps {
  data: OwnerPayoutsResponse | null;
  rewardsData: RewardsSummaryResponse | null;
  onUpdated: (payload: {
    ownerPayouts: OwnerPayoutsResponse;
    rewards?: RewardsSummaryResponse;
    payoutConfig?: PayoutConfig;
    revenueEngine?: RevenueEngineResponse;
    availableUsd?: number;
  }) => void;
}

function downloadReceiptText(record: OwnerWithdrawalRecord) {
  const solLine =
    typeof record.amountSol === 'number'
      ? `SOL Equivalent:    ${record.amountSol.toFixed(4)} SOL (@ $${(record.solUsdRate ?? 185).toFixed(2)}/SOL)`
      : null;
  const localLine =
    typeof record.amountLocal === 'number' && record.currencyLocal
      ? `Local Settlement:  ${record.currencyLocal} ${record.amountLocal.toFixed(2)}`
      : null;
  const fallbackLine = record.gatewayFallbackNote
    ? `Gateway Note:      ${record.gatewayFallbackNote}`
    : null;
  const reversalLines =
    record.status === 'Reversed'
      ? [
          `Reversal ID:       ${record.reversalId ?? 'Recorded'}`,
          `Reversed At:       ${record.reversedAt ?? 'Recorded'}`,
          `Reversal Reason:   ${record.reversalReason ?? 'Wrong transaction reversed'}`
        ]
      : [];

  const lines = [
    'NEWS HUB 24+ OFFICIAL OWNER WITHDRAWAL RECEIPT',
    '================================================',
    `Receipt ID:        ${record.id}`,
    `Settlement Ref:    ${record.settlementReference ?? record.id}`,
    `Owner Email:       ${record.ownerEmail}`,
    `Gross Amount:      $${record.amountUsd.toFixed(2)} USD (${record.currency} payout)`,
    `Processor Fee:     $${(record.processorFeeUsd ?? 0).toFixed(2)} USD`,
    `Net Settled:       $${(record.netSettledUsd ?? record.amountUsd).toFixed(2)} USD`,
    ...(localLine ? [localLine] : []),
    ...(solLine ? [solLine] : []),
    `Revenue Source:    ${record.sourceScopeLabel}`,
    `Payout Rail:       ${record.railLabel}`,
    `Destination:       ${record.destinationLabel} (${record.maskedAccount})`,
    `Expiration Policy: ${record.expirationLabel ?? 'Unlimited · Never Expires'}`,
    `Status:            ${record.status}`,
    ...reversalLines,
    `Settlement Mode:   ${record.settlementMode === 'live_configured' ? 'Live Gateway Configured' : 'Sandbox Treasury Ledger'}`,
    ...(fallbackLine ? [fallbackLine] : []),
    `Settlement ETA:    ${record.settlementEta}`,
    `Issued At:         ${record.createdAt}`,
    `Treasury Note:     ${record.note}`,
    '================================================',
    'Issued by News Hub 24+ (newshub24plus.com)'
  ].join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${record.id}-receipt.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function OwnerWithdrawalSection({ data, rewardsData, onUpdated }: OwnerWithdrawalSectionProps) {
  const methods = data?.methods ?? [];
  const withdrawals = data?.withdrawals ?? [];
  const supportedRails = data?.supportedRails ?? [];
  const balances = data?.balances;
  const availableUsd = balances?.availableUsd ?? 0;
  const solRate = data?.solUsdRate?.usdPerSol ?? rewardsData?.solUsdRate.usdPerSol ?? 185;
  const ghsRate = data?.fxRates?.GHS ?? 15.5;
  const solRateSource = data?.solUsdRate?.source ?? rewardsData?.solUsdRate.source ?? 'fallback';
  const availableSol = balances?.availableSol ?? Number((availableUsd / solRate).toFixed(4));
  const availableGhs = balances?.availableGhs ?? Number((availableUsd * ghsRate).toFixed(2));
  const settlementStatus = data?.settlementStatus ?? rewardsData?.settlementStatus;

  // Reward Converter State (Clicks + Watch Time + Watch Hours -> USD & SOL)
  const [converterMode, setConverterMode] = useState<'accrued' | 'custom'>('accrued');
  const [batchClicks, setBatchClicks] = useState<string>('250');
  const [batchWatchMinutes, setBatchWatchMinutes] = useState<string>('90');
  const [batchWatchHours, setBatchWatchHours] = useState<string>('4');
  const [batchPlatform, setBatchPlatform] = useState<'website' | 'android_apk' | 'base44_app'>('website');
  const [convertingRewards, setConvertingRewards] = useState<boolean>(false);
  const [convertFeedback, setConvertFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add new withdrawal method form state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newRail, setNewRail] = useState<OwnerWithdrawalRail>('solana');
  const [accountHolderName, setAccountHolderName] = useState<string>('News Hub 24+ Owner');
  const [destinationLabel, setDestinationLabel] = useState<string>('');
  const [accountNumberOrHandle, setAccountNumberOrHandle] = useState<string>('');
  const [routingOrCode, setRoutingOrCode] = useState<string>('');
  const [newCurrency, setNewCurrency] = useState<string>('SOL');
  const [country, setCountry] = useState<string>('Solana Mainnet');
  const [setAsDefault, setSetAsDefault] = useState<boolean>(true);
  const [addingMethod, setAddingMethod] = useState<boolean>(false);
  const [mutatingMethodId, setMutatingMethodId] = useState<string | null>(null);
  const [methodFeedback, setMethodFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Request withdrawal form state
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const hasInitializedAmountRef = useRef<boolean>(false);
  const [sourceScope, setSourceScope] = useState<'all_channels' | 'website' | 'android_apk' | 'base44_app'>(
    'all_channels'
  );
  const [withdrawNote, setWithdrawNote] = useState<string>('');
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Wrong-transaction reversal state
  const REVERSAL_PRESET_REASONS = [
    'Wrong Destination Account',
    'Incorrect Withdrawal Amount',
    'Duplicate Payout Request',
    'Wrong Currency / Rail'
  ];
  const [reversingWithdrawalId, setReversingWithdrawalId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('Wrong Destination Account');
  const [submittingReversal, setSubmittingReversal] = useState<boolean>(false);
  const [reversalFeedback, setReversalFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const def = methods.find((m) => m.isDefault) ?? methods[0];
    if (def && (!selectedMethodId || !methods.some((m) => m.id === selectedMethodId))) {
      setSelectedMethodId(def.id);
    }
  }, [methods, selectedMethodId]);

  useEffect(() => {
    if (!hasInitializedAmountRef.current && availableUsd > 0) {
      hasInitializedAmountRef.current = true;
      setAmountInput(availableUsd.toFixed(2));
    }
  }, [availableUsd]);

  useEffect(() => {
    if (newRail === 'solana') {
      setNewCurrency('SOL');
      setCountry('Solana Mainnet');
      setRoutingOrCode('');
    } else if (newRail === 'ghana_momo') {
      setNewCurrency('GHS');
      setCountry('Ghana');
      setRoutingOrCode('MTN');
    } else if (newRail === 'ghanapay_transfer') {
      setNewCurrency('GHS');
      setCountry('Ghana');
      setRoutingOrCode('GCB');
    } else if (newRail === 'flutterwave_payout') {
      setNewCurrency('GHS');
      setCountry('Ghana / Africa');
      setRoutingOrCode('');
    } else {
      setNewCurrency((prev) => (prev === 'SOL' ? 'USD' : prev));
      setCountry((prev) => (prev === 'Solana Mainnet' ? 'United States' : prev));
    }
  }, [newRail]);

  const activeRailMeta = supportedRails.find((r) => r.rail === newRail);
  const selectedMethodObj = methods.find((m) => m.id === selectedMethodId);

  // Compute live preview for custom batch conversion
  const parsedBatchClicks = Math.max(0, Math.round(Number(batchClicks) || 0));
  const parsedBatchMinutes = Math.max(0, Number(batchWatchMinutes) || 0);
  const parsedBatchHours = Math.max(0, Number(batchWatchHours) || 0);
  const totalCustomHours = parsedBatchHours + parsedBatchMinutes / 60;
  const customClickRateNet =
    batchPlatform === 'website'
      ? rewardsData?.rates.webClickNetUsd ?? 0.126
      : rewardsData?.rates.appClickNetUsd ?? 0.154;
  const customWatchHourNet = rewardsData?.rates.watchHourNetUsd ?? 1.26;
  const customPreviewUsd = Number(
    (parsedBatchClicks * customClickRateNet + totalCustomHours * customWatchHourNet).toFixed(2)
  );
  const customPreviewSol = Number((customPreviewUsd / solRate).toFixed(4));

  const unconverted = rewardsData?.unconverted;
  const parsedAmount = Number(amountInput);
  const previewAmountUsd = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const estimatedFeeUsd = selectedMethodObj
    ? computeEstimatedWithdrawalFeeUsd(selectedMethodObj.rail, previewAmountUsd)
    : 0;
  const estimatedNetUsd = Math.max(0, Number((previewAmountUsd - estimatedFeeUsd).toFixed(2)));
  const previewAmountSol = Number((estimatedNetUsd / solRate).toFixed(4));
  const selectedLocalCur = selectedMethodObj?.currency?.toUpperCase() ?? 'USD';
  const fxRatesObj = data?.fxRates;
  const fallbackRatesMap: Record<string, number> = {
    USD: 1,
    GHS: fxRatesObj?.GHS ?? ghsRate,
    NGN: fxRatesObj?.NGN ?? 1550,
    KES: fxRatesObj?.KES ?? 129,
    ZAR: fxRatesObj?.ZAR ?? 18.2,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.37
  };
  const selectedLocalRate =
    fxRatesObj?.rates?.[selectedLocalCur] ?? fallbackRatesMap[selectedLocalCur] ?? 1;
  const showsLocalCurrencyEstimate = selectedLocalCur !== 'USD' && selectedLocalCur !== 'SOL';
  const estimatedNetLocal = Number((estimatedNetUsd * selectedLocalRate).toFixed(2));
  const isAmountInvalid =
    !Number.isFinite(parsedAmount) || parsedAmount < 0.01 || parsedAmount > availableUsd + 0.001;

  const handleConvertRewards = async (modeOverride?: 'accrued' | 'custom') => {
    const mode = modeOverride ?? converterMode;
    setConvertFeedback(null);
    setConvertingRewards(true);
    try {
      const bodyPayload =
        mode === 'custom'
          ? {
              mode: 'custom',
              platform: batchPlatform,
              clicks: parsedBatchClicks,
              watchMinutes: parsedBatchMinutes,
              watchHours: parsedBatchHours
            }
          : { mode: 'accrued', platform: 'website' };

      const res = await fetch('/api/rewards/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not convert rewards right now.');
      }
      const freshOwner = payload.ownerPayouts as OwnerPayoutsResponse;
      onUpdated({
        ownerPayouts: freshOwner,
        rewards: payload.rewards as RewardsSummaryResponse,
        revenueEngine: payload.revenueEngine as RevenueEngineResponse,
        availableUsd: freshOwner.balances.availableUsd
      });
      setAmountInput(freshOwner.balances.availableUsd.toFixed(2));
      setConvertFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setConvertFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to convert engagement rewards.'
      });
    } finally {
      setConvertingRewards(false);
    }
  };

  const handleAddMethod = async (e: FormEvent) => {
    e.preventDefault();
    setMethodFeedback(null);

    if (accountHolderName.trim().length < 2 || destinationLabel.trim().length < 2 || accountNumberOrHandle.trim().length < 4) {
      setMethodFeedback({
        type: 'error',
        text: 'Please fill in the owner name, bank/wallet name, and account, Solana address, email, or phone.'
      });
      return;
    }

    setAddingMethod(true);
    try {
      const res = await fetch('/api/owner/withdrawal-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rail: newRail,
          accountHolderName: accountHolderName.trim(),
          destinationLabel: destinationLabel.trim(),
          accountNumberOrHandle: accountNumberOrHandle.trim(),
          routingOrCode: routingOrCode.trim(),
          currency: newRail === 'solana' ? 'SOL' : newCurrency,
          country: country.trim() || 'Global',
          setAsDefault
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not save withdrawal method.');
      }

      onUpdated({
        ownerPayouts: payload.ownerPayouts as OwnerPayoutsResponse,
        payoutConfig: payload.payoutConfig as PayoutConfig
      });
      setSelectedMethodId(payload.method.id);
      setDestinationLabel('');
      setAccountNumberOrHandle('');
      setRoutingOrCode('');
      setShowAddForm(false);
      setMethodFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setMethodFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save owner withdrawal method.'
      });
    } finally {
      setAddingMethod(false);
    }
  };

  const handleSetDefaultMethod = async (methodId: string) => {
    if (mutatingMethodId) return;
    setMethodFeedback(null);
    setMutatingMethodId(methodId);
    try {
      const res = await fetch(`/api/owner/withdrawal-methods/${encodeURIComponent(methodId)}/default`, {
        method: 'PATCH'
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Unable to set default method.');
      }
      onUpdated({
        ownerPayouts: payload.ownerPayouts as OwnerPayoutsResponse,
        payoutConfig: payload.payoutConfig as PayoutConfig
      });
      setSelectedMethodId(methodId);
      setMethodFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setMethodFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update default withdrawal method.'
      });
    } finally {
      setMutatingMethodId(null);
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    if (mutatingMethodId) return;
    setMethodFeedback(null);
    setMutatingMethodId(methodId);
    try {
      const res = await fetch(`/api/owner/withdrawal-methods/${encodeURIComponent(methodId)}`, {
        method: 'DELETE'
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Unable to remove withdrawal method.');
      }
      onUpdated({
        ownerPayouts: payload.ownerPayouts as OwnerPayoutsResponse,
        payoutConfig: payload.payoutConfig as PayoutConfig
      });
      setMethodFeedback({ type: 'success', text: 'Withdrawal method removed.' });
    } catch (err: unknown) {
      setMethodFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to delete withdrawal method.'
      });
    } finally {
      setMutatingMethodId(null);
    }
  };

  const handleOwnerWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    if (withdrawing) return;
    setWithdrawFeedback(null);

    if (!selectedMethodId || methods.length === 0) {
      setWithdrawFeedback({ type: 'error', text: 'Select or add a withdrawal destination method first.' });
      return;
    }

    const amountToSubmit = Number(amountInput);

    if (!Number.isFinite(amountToSubmit) || amountToSubmit < 0.01) {
      setWithdrawFeedback({ type: 'error', text: 'Enter a withdrawal amount of at least $0.01.' });
      return;
    }
    if (amountToSubmit > availableUsd + 0.001) {
      setWithdrawFeedback({
        type: 'error',
        text: `Amount ($${amountToSubmit.toFixed(2)}) exceeds available owner balance ($${availableUsd.toFixed(2)}).`
      });
      return;
    }

    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `own-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    setWithdrawing(true);
    try {
      const res = await fetch('/api/owner/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methodId: selectedMethodId,
          amountUsd: amountToSubmit,
          sourceScope,
          note: withdrawNote.trim(),
          idempotencyKey
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Owner withdrawal could not be processed.');
      }

      const freshPayouts = payload.ownerPayouts as OwnerPayoutsResponse;
      onUpdated({
        ownerPayouts: freshPayouts,
        rewards: payload.rewards as RewardsSummaryResponse | undefined,
        revenueEngine: payload.revenueEngine as RevenueEngineResponse,
        availableUsd: freshPayouts.balances.availableUsd
      });
      setAmountInput(
        freshPayouts.balances.availableUsd > 0 ? freshPayouts.balances.availableUsd.toFixed(2) : '0.00'
      );
      setWithdrawNote('');
      setWithdrawFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setWithdrawFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to process owner withdrawal.'
      });
    } finally {
      setWithdrawing(false);
    }
  };

  const handleReverseWithdrawal = async (withdrawalId: string) => {
    setReversalFeedback(null);
    setSubmittingReversal(true);
    try {
      const res = await fetch(`/api/owner/withdrawals/${encodeURIComponent(withdrawalId)}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reversalReason.trim() || 'Wrong withdrawal transaction reversed by owner'
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not reverse withdrawal transaction.');
      }
      const freshPayouts = payload.ownerPayouts as OwnerPayoutsResponse;
      onUpdated({
        ownerPayouts: freshPayouts,
        rewards: payload.rewards as RewardsSummaryResponse | undefined,
        revenueEngine: payload.revenueEngine as RevenueEngineResponse,
        availableUsd: freshPayouts.balances.availableUsd
      });
      setAmountInput(freshPayouts.balances.availableUsd.toFixed(2));
      setReversingWithdrawalId(null);
      setReversalFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setReversalFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to reverse withdrawal.'
      });
    } finally {
      setSubmittingReversal(false);
    }
  };

  return (
    <section
      id="owner-withdrawals"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-[#FBF9F5] dark:bg-[#10100F]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-10">
        {/* Section Heading */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1.5 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5" />
              <span>Owner Treasury &amp; SOL Rewards · {data?.owner.domain ?? 'newshub24plus.com'} &amp; {data?.owner.packageId ?? 'com.newshub24plus.android'}</span>
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
              Click &amp; Watch-Time Cash Converter · Owner Withdrawals (USD &amp; SOL)
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Convert reader clicks, video watch minutes, and watch hours into withdrawable cash (USD &amp; Solana SOL) for{' '}
              <span className="font-medium text-[#141413] dark:text-[#F5F3EE]">
                {data?.owner.email ?? 'newshub24plus@gmail.com'}
              </span>{' '}
              and disburse directly to Bank Wire, PayPal, Wise, Mobile Money, Debit Card, or a Solana Web3 wallet.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] transition-colors whitespace-nowrap shrink-0 self-start"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Close Method Form' : 'Add Withdrawal Method (Bank / SOL)'}</span>
          </button>
        </div>

        {/* Unlimited Withdrawal Expiration Policy & Settlement Transparency Strip */}
        <div className="space-y-3">
          <div className="p-4 bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <InfinityIcon className="w-4 h-4 text-[#14532D] dark:text-[#4ADE80] shrink-0 mt-0.5" />
              <p className="text-[#14532D] dark:text-[#DCFCE7] leading-relaxed">
                <span className="font-semibold">Unlimited Withdrawal Expiration Active: </span>
                {data?.withdrawalPolicy?.label ??
                  'Creator & owner withdrawal balances, payout methods, and treasury receipts never expire (Zero Forfeiture).'}
                {' '}Wrong disbursements can also be reversed anytime to restore available treasury funds.
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] shrink-0">
              Expires: Never (Unlimited)
            </span>
          </div>

          <div className="p-4 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-3 text-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-[#991B1B] dark:text-[#F87171] shrink-0 mt-0.5" />
                <p className="text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
                  <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    {settlementStatus?.settlementMode === 'live_configured'
                      ? 'Live Processor Keys Configured: '
                      : 'Treasury Mode (Sandbox Ledger): '}
                  </span>
                  {settlementStatus?.note ??
                    'Rewards conversions and withdrawals record accurately in USD and SOL on the treasury ledger. Connect Stripe, PayPal, or Solana RPC credentials for live external settlement.'}
                </p>
              </div>
              <div className="font-mono text-xs shrink-0 text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                1 SOL = ${solRate.toFixed(2)} USD{' '}
                <span className="text-[#57534E] dark:text-[#A8A29E]">
                  ({solRateSource === 'live' ? 'Live CoinGecko' : solRateSource === 'cached' ? 'Cached Spot' : 'Ref Rate'})
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#ECE9E2] dark:border-[#242320] flex flex-wrap items-center justify-between gap-2 text-xs text-[#44403C] dark:text-[#D6D3CD]">
              <span>
                <strong className="text-[#141413] dark:text-[#F5F3EE]">Default Ghana MoMo Payout:</strong> MTN Mobile Money{' '}
                <span className="font-mono font-semibold text-[#14532D] dark:text-[#4ADE80]">0557711975</span> · GhIPSS Instant Bank &amp; GhanaPay Third-Party Ready
              </span>
              <span className="font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80]">
                Bank of Ghana Act 987 Compliant
              </span>
            </div>
          </div>
        </div>

        {/* 4-Column Owner Balance Strip (with SOL equivalent) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pb-8 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Available to Withdraw</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              ${availableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
              ≈ {availableSol.toFixed(4)} SOL · ≈ GH₵ {availableGhs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Never Expires
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Total Withdrawn by Owner</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              ${(balances?.totalWithdrawnUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
              ≈ {(balances?.totalWithdrawnSol ?? Number(((balances?.totalWithdrawnUsd ?? 0) / solRate).toFixed(4))).toFixed(4)} SOL · Reversible
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Converted from Rewards</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              ${(rewardsData?.totals.lifetimeConvertedUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
              {(rewardsData?.totals.totalWatchHoursTracked ?? 0).toFixed(1)}h watch · {(rewardsData?.totals.totalClicksTracked ?? 0).toLocaleString()} clicks
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Withdrawal Expiration Policy</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              Unlimited
            </p>
            <p className="font-mono text-xs text-[#14532D] dark:text-[#4ADE80] mt-0.5">
              {methods.length} Active Destinations · Zero Expiry
            </p>
          </div>
        </div>

        {/* ENGAGEMENT REWARDS -> REAL MONEY (USD & SOL) CONVERTER */}
        <div className="bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
              <div>
                <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Clicks, Watch Time &amp; Watch Hours → Cash &amp; SOL Converter
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Rates (70% owner share): ${(rewardsData?.rates.webClickNetUsd ?? 0.126).toFixed(3)}/web click · ${(rewardsData?.rates.appClickNetUsd ?? 0.154).toFixed(3)}/app click · ${(rewardsData?.rates.watchHourNetUsd ?? 1.26).toFixed(2)}/watch hour · ${(rewardsData?.rates.articleReadHourNetUsd ?? 0.63).toFixed(2)}/article read hour
                </p>
              </div>
            </div>

            <div className="inline-flex border border-[#D6D1C7] dark:border-[#3A3732] rounded-md overflow-hidden bg-white dark:bg-[#141413] text-xs font-medium">
              <button
                type="button"
                onClick={() => setConverterMode('accrued')}
                className={`px-3 py-1.5 transition-colors ${
                  converterMode === 'accrued'
                    ? 'bg-[#141413] text-white dark:bg-[#F5F3EE] dark:text-[#141413] font-semibold'
                    : 'text-[#44403C] dark:text-[#D6D3CD]'
                }`}
              >
                Pending Accrued Pool
              </button>
              <button
                type="button"
                onClick={() => setConverterMode('custom')}
                className={`px-3 py-1.5 transition-colors ${
                  converterMode === 'custom'
                    ? 'bg-[#141413] text-white dark:bg-[#F5F3EE] dark:text-[#141413] font-semibold'
                    : 'text-[#44403C] dark:text-[#D6D3CD]'
                }`}
              >
                Custom Batch Calculator
              </button>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Cols: Accrued Metrics or Custom Batch Calculator */}
            <div className="lg:col-span-7 space-y-5">
              {converterMode === 'accrued' ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mb-1">Pending Clicks</p>
                      <p className="font-mono text-lg font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                        {(unconverted?.clicks ?? 0).toLocaleString()}
                      </p>
                      <p className="font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                        +${(unconverted?.breakdown.clicksNetUsd ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mb-1">Video Watch Time</p>
                      <p className="font-mono text-lg font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                        {(unconverted?.watchHours ?? 0).toFixed(2)} hrs
                      </p>
                      <p className="font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                        {(unconverted?.watchMinutes ?? 0).toFixed(0)}m · +${(unconverted?.breakdown.watchTimeNetUsd ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mb-1">Article Read Time</p>
                      <p className="font-mono text-lg font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                        {(unconverted?.articleReadMinutes ?? 0).toFixed(0)} mins
                      </p>
                      <p className="font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                        +${(unconverted?.breakdown.articleReadNetUsd ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mb-1">3s+ Qualified Views</p>
                      <p className="font-mono text-lg font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                        {(unconverted?.qualifiedViews ?? 0).toLocaleString()}
                      </p>
                      <p className="font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                        +${(unconverted?.breakdown.qualifiedViewsNetUsd ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">Ready to Convert into Withdrawable Cash</p>
                      <p className="font-serif text-2xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                        ${(unconverted?.creatorNetUsd ?? 0).toFixed(2)} USD{' '}
                        <span className="font-mono text-sm font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          (≈ {(unconverted?.equivalentSol ?? 0).toFixed(4)} SOL)
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={convertingRewards || (unconverted?.creatorNetUsd ?? 0) < 0.01}
                      onClick={() => void handleConvertRewards('accrued')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Coins className="w-4 h-4" />
                      <span>
                        {convertingRewards ? 'Converting…' : 'Convert Pending Activity to Cash'}
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label htmlFor="conv-clicks" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                        Reader Clicks
                      </label>
                      <input
                        id="conv-clicks"
                        type="number"
                        min="0"
                        value={batchClicks}
                        onChange={(e) => setBatchClicks(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                      />
                    </div>
                    <div>
                      <label htmlFor="conv-mins" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                        Watch Minutes
                      </label>
                      <input
                        id="conv-mins"
                        type="number"
                        min="0"
                        value={batchWatchMinutes}
                        onChange={(e) => setBatchWatchMinutes(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                      />
                    </div>
                    <div>
                      <label htmlFor="conv-hours" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                        Watch Hours
                      </label>
                      <input
                        id="conv-hours"
                        type="number"
                        min="0"
                        step="0.5"
                        value={batchWatchHours}
                        onChange={(e) => setBatchWatchHours(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                      />
                    </div>
                    <div>
                      <label htmlFor="conv-platform" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                        Source Channel
                      </label>
                      <select
                        id="conv-platform"
                        value={batchPlatform}
                        onChange={(e) =>
                          setBatchPlatform(e.target.value as 'website' | 'android_apk' | 'base44_app')
                        }
                        className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                      >
                        <option value="website">Official Website</option>
                        <option value="android_apk">Android APK App</option>
                        <option value="base44_app">Base44 App</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                        {parsedBatchClicks.toLocaleString()} clicks + {totalCustomHours.toFixed(2)}h total watch time =
                      </p>
                      <p className="font-serif text-2xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                        ${customPreviewUsd.toFixed(2)} USD{' '}
                        <span className="font-mono text-sm font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          (≈ {customPreviewSol.toFixed(4)} SOL)
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={convertingRewards || customPreviewUsd < 0.01}
                      onClick={() => void handleConvertRewards('custom')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] dark:hover:bg-[#16A34A] rounded-md disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Coins className="w-4 h-4" />
                      <span>
                        {convertingRewards
                          ? 'Converting…'
                          : `Convert Batch ($${customPreviewUsd.toFixed(2)})`}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {convertFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium px-3.5 py-2.5 rounded-md border ${
                    convertFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  {convertFeedback.text}
                </p>
              )}
            </div>

            {/* Right 5 Cols: Recent Conversion Ledger */}
            <div className="lg:col-span-5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
              <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Recent Reward Conversions → Balance
                </span>
                <span className="font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                  {rewardsData?.conversions.length ?? 0} settled
                </span>
              </div>
              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-56 overflow-y-auto">
                {(rewardsData?.conversions ?? []).map((conv) => (
                  <div key={conv.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                        {conv.clicksConverted.toLocaleString()} clicks · {conv.watchHoursConverted.toFixed(2)}h watch
                      </p>
                      <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                        {conv.id} · {conv.platform} · ${conv.solUsdRate.toFixed(2)}/SOL
                      </p>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <p className="font-semibold text-[#14532D] dark:text-[#4ADE80]">
                        +${conv.creatorNetUsd.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                        {conv.equivalentSol.toFixed(4)} SOL
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Add New Owner Withdrawal Method Form (Collapsible) */}
        {showAddForm && (
          <form
            onSubmit={handleAddMethod}
            noValidate
            className="p-6 sm:p-7 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div>
                <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Register Owner Withdrawal Account (Bank, Wallet, or Solana SOL)
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Account numbers, emails, and Solana public addresses are masked cleanly on the treasury ledger.
                </p>
              </div>
              {activeRailMeta && (
                <span className="font-mono text-xs text-[#14532D] dark:text-[#4ADE80]">
                  ETA: {activeRailMeta.settlementEta}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="owner-rail" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Withdrawal Method Type
                </label>
                <select
                  id="owner-rail"
                  value={newRail}
                  onChange={(e) => setNewRail(e.target.value as OwnerWithdrawalRail)}
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                >
                  {supportedRails.map((r) => (
                    <option key={r.rail} value={r.rail}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="owner-holder" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Beneficiary / Owner Full Name
                </label>
                <input
                  id="owner-holder"
                  type="text"
                  required
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="News Hub 24+ Owner"
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="owner-bank-label" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Bank, Wallet, or Provider Name
                </label>
                <input
                  id="owner-bank-label"
                  type="text"
                  required
                  value={destinationLabel}
                  onChange={(e) => setDestinationLabel(e.target.value)}
                  placeholder={activeRailMeta?.placeholderDestination ?? 'Phantom / Bank Name'}
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="owner-account-num" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  {newRail === 'solana'
                    ? 'Solana Public Key (Base58) or .sol Domain'
                    : 'Account Number / IBAN / Email / Phone'}
                </label>
                <input
                  id="owner-account-num"
                  type="text"
                  required
                  value={accountNumberOrHandle}
                  onChange={(e) => setAccountNumberOrHandle(e.target.value)}
                  placeholder={activeRailMeta?.placeholderAccount ?? 'Account identifier'}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="owner-routing" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  {newRail === 'ghana_momo'
                    ? 'Ghana Mobile Money Network'
                    : newRail === 'ghanapay_transfer'
                      ? 'Ghana Bank Institution (GhIPSS)'
                      : 'Routing / SWIFT / Network Code (Optional)'}
                </label>
                {newRail === 'ghana_momo' ? (
                  <select
                    id="owner-routing"
                    value={routingOrCode || 'MTN'}
                    onChange={(e) => setRoutingOrCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  >
                    {GHANA_MOMO_NETWORK_OPTIONS.map((net) => (
                      <option key={net.code} value={net.code}>
                        {net.label}
                      </option>
                    ))}
                  </select>
                ) : newRail === 'ghanapay_transfer' ? (
                  <select
                    id="owner-routing"
                    value={routingOrCode || 'GCB'}
                    onChange={(e) => setRoutingOrCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  >
                    {GHANA_BANK_OPTIONS.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="owner-routing"
                    type="text"
                    value={routingOrCode}
                    onChange={(e) => setRoutingOrCode(e.target.value)}
                    placeholder={activeRailMeta?.placeholderRouting ?? 'Routing or Network'}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="owner-currency" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Currency
                  </label>
                  <select
                    id="owner-currency"
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  >
                    <option value="SOL">SOL (Solana)</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                    <option value="KES">KES</option>
                    <option value="NGN">NGN</option>
                    <option value="GHS">GHS</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="owner-country" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Country / Network
                  </label>
                  <input
                    id="owner-country"
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="United States"
                    className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <label className="inline-flex items-center gap-2 text-xs text-[#292524] dark:text-[#D6D3CD] cursor-pointer">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="rounded border-[#D6D1C7] text-[#991B1B] focus:ring-[#991B1B]"
                />
                <span>Set as primary withdrawal destination across Website &amp; App</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMethod}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {addingMethod ? 'Saving Account…' : 'Save Owner Withdrawal Method'}
                </button>
              </div>
            </div>
          </form>
        )}

        {methodFeedback && (
          <p
            role="status"
            className={`text-xs font-medium px-4 py-3 rounded-md border ${
              methodFeedback.type === 'success'
                ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
            }`}
          >
            {methodFeedback.text}
          </p>
        )}

        {/* Two-Column Console: Saved Methods + Withdraw Form & History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 6 Cols: Saved Withdrawal Methods + Channel Revenue Attribution */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                  <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Verified Owner Payout Destinations
                  </h3>
                </div>
                <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                  {methods.length} configured
                </span>
              </div>

              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                {methods.map((method) => (
                  <div key={method.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          {method.destinationLabel}
                        </span>
                        <span aria-hidden="true" className="text-[#78716C]">·</span>
                        <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                          {method.maskedAccount}
                        </span>
                        {method.isDefault && (
                          <>
                            <span aria-hidden="true" className="text-[#78716C]">·</span>
                            <span className="font-mono font-semibold text-[#14532D] dark:text-[#4ADE80]">
                              Primary Default
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                        {method.railLabel} · {method.accountHolderName} · {method.currency} ({method.country})
                      </p>
                      <p className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                        {method.routingOrCode} · Validity: Unlimited (Never Expires)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!method.isDefault && (
                        <button
                          type="button"
                          disabled={mutatingMethodId !== null}
                          onClick={() => handleSetDefaultMethod(method.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] disabled:opacity-50 whitespace-nowrap"
                        >
                          <Check className="w-3 h-3" />
                          <span>{mutatingMethodId === method.id ? 'Updating…' : 'Set Primary'}</span>
                        </button>
                      )}
                      {methods.length > 1 && (
                        <button
                          type="button"
                          disabled={mutatingMethodId !== null}
                          onClick={() => handleDeleteMethod(method.id)}
                          aria-label={`Remove ${method.destinationLabel}`}
                          className="p-1.5 text-[#78716C] hover:text-[#991B1B] dark:hover:text-[#F87171] disabled:opacity-40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel Balance Sources */}
            <div className="bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                  <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Eligible Owner Revenue Sources
                  </h3>
                </div>
                <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Website + App Combined
                </span>
              </div>
              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] text-xs">
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="text-[#292524] dark:text-[#D6D3CD] font-medium">
                    Official Website ({data?.owner.domain ?? 'newshub24plus.com'})
                  </span>
                  <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    ${(balances?.websiteNetUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} net
                  </span>
                </div>
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="text-[#292524] dark:text-[#D6D3CD] font-medium flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Android APK App ({data?.owner.packageId ?? 'com.newshub24plus.android'})</span>
                  </span>
                  <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    ${(balances?.androidApkNetUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} net
                  </span>
                </div>
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="text-[#292524] dark:text-[#D6D3CD] font-medium">
                    Base44 Official App Syndication
                  </span>
                  <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    ${(balances?.base44AppNetUsd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} net
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right 6 Cols: Request Withdrawal Form + Receipts Ledger */}
          <div className="lg:col-span-6 space-y-6">
            <form
              onSubmit={handleOwnerWithdraw}
              noValidate
              className="p-6 sm:p-7 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-4"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <div className="flex items-center gap-2">
                  <ArrowDownToLine className="w-4 h-4 text-[#14532D] dark:text-[#4ADE80]" />
                  <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                    Withdraw Converted Funds
                  </h3>
                </div>
                <span className="font-mono text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
                  ${availableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {availableSol.toFixed(4)} SOL
                </span>
              </div>

              <div>
                <label htmlFor="withdraw-destination" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Destination Withdrawal Account
                </label>
                <select
                  id="withdraw-destination"
                  value={selectedMethodId}
                  onChange={(e) => setSelectedMethodId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                >
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.destinationLabel} ({m.maskedAccount}) · {m.currency}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="withdraw-amount" className="text-xs font-medium text-[#292524] dark:text-[#D6D3CD]">
                      Withdrawal Amount (USD)
                    </label>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono">
                      {[
                        { label: '25%', factor: 0.25 },
                        { label: '50%', factor: 0.5 },
                        { label: 'Max', factor: 1 }
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setAmountInput((availableUsd * preset.factor).toFixed(2))}
                          className="text-[#991B1B] dark:text-[#F87171] hover:underline font-semibold"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="withdraw-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={availableUsd}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  />
                  {previewAmountUsd > 0 && (
                    <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums">
                      <p className="text-[#57534E] dark:text-[#A8A29E]">
                        Fee: ${estimatedFeeUsd.toFixed(2)} · Net Settled:{' '}
                        <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          ${estimatedNetUsd.toFixed(2)} USD
                        </span>
                      </p>
                      {selectedMethodObj?.rail === 'solana' ? (
                        <p className="text-[#14532D] dark:text-[#4ADE80]">
                          Payout estimate: ≈ {previewAmountSol.toFixed(4)} SOL @ ${solRate.toFixed(2)}/SOL
                        </p>
                      ) : showsLocalCurrencyEstimate ? (
                        <p className="text-[#14532D] dark:text-[#4ADE80]">
                          Local payout estimate: ≈ {selectedLocalCur === 'GHS' ? 'GH₵' : selectedLocalCur}{' '}
                          {estimatedNetLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                          @ $1 = {selectedLocalRate.toFixed(2)} {selectedLocalCur}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="withdraw-scope" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Revenue Attribution Scope
                  </label>
                  <select
                    id="withdraw-scope"
                    value={sourceScope}
                    onChange={(e) =>
                      setSourceScope(
                        e.target.value as 'all_channels' | 'website' | 'android_apk' | 'base44_app'
                      )
                    }
                    className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  >
                    <option value="all_channels">Website + Android APK + Base44</option>
                    <option value="website">Official Website Only</option>
                    <option value="android_apk">Android APK App Only</option>
                    <option value="base44_app">Base44 App Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="withdraw-note" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Treasury Reference Note (Optional)
                </label>
                <input
                  id="withdraw-note"
                  type="text"
                  value={withdrawNote}
                  onChange={(e) => setWithdrawNote(e.target.value)}
                  placeholder="e.g. Q4 News Hub 24+ Owner Settlement"
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                />
              </div>

              {withdrawFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium px-3 py-2.5 rounded-md border ${
                    withdrawFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  {withdrawFeedback.text}
                </p>
              )}

              <div className="px-3.5 py-2.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md flex items-center justify-between text-[11px]">
                <span className="text-[#57534E] dark:text-[#A8A29E] font-medium">
                  Withdrawal Expiration Duration
                </span>
                <span className="font-mono font-semibold text-[#14532D] dark:text-[#4ADE80]">
                  Unlimited · Never Expires
                </span>
              </div>

              <button
                type="submit"
                disabled={withdrawing || availableUsd < 0.01 || methods.length === 0 || isAmountInvalid}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] dark:hover:bg-[#16A34A] rounded-md disabled:opacity-50 transition-colors"
              >
                {withdrawing
                  ? 'Initiating Owner Withdrawal…'
                  : selectedMethodObj?.rail === 'solana'
                    ? `Confirm Solana Withdrawal ($${estimatedNetUsd.toFixed(2)} net ≈ ${previewAmountSol.toFixed(4)} SOL)`
                    : showsLocalCurrencyEstimate
                      ? `Confirm ${selectedLocalCur} Withdrawal ($${estimatedNetUsd.toFixed(2)} net ≈ ${selectedLocalCur === 'GHS' ? 'GH₵' : selectedLocalCur} ${estimatedNetLocal.toFixed(2)})`
                      : `Confirm Owner Withdrawal ($${estimatedNetUsd.toFixed(2)} net)`}
              </button>
            </form>

            {/* Owner Withdrawal Receipts Table + Wrong Transaction Reversal */}
            <div className="bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                  <div>
                    <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      Owner Withdrawal Receipts &amp; Reversal Ledger
                    </h3>
                    <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                      Realistic processor fee breakdown · Unlimited expiry · Reverse wrong transactions anytime
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums shrink-0">
                  {withdrawals.length} records
                </span>
              </div>

              {reversalFeedback && (
                <p
                  role="status"
                  className={`mx-5 mt-3 text-xs font-medium px-3 py-2 rounded-md border ${
                    reversalFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  {reversalFeedback.text}
                </p>
              )}

              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-96 overflow-y-auto">
                {withdrawals.map((wd) => {
                  const isReversed = wd.status === 'Reversed';
                  const isEditingReversal = reversingWithdrawalId === wd.id;
                  const feeUsd = wd.processorFeeUsd ?? 0;
                  const netUsd = wd.netSettledUsd ?? wd.amountUsd;

                  return (
                    <div key={wd.id} className="px-5 py-4 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-0.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                              {wd.destinationLabel} ({wd.maskedAccount})
                            </p>
                            <span
                              className={`font-mono text-[11px] font-semibold ${
                                isReversed
                                  ? 'text-[#991B1B] dark:text-[#F87171]'
                                  : 'text-[#14532D] dark:text-[#4ADE80]'
                              }`}
                            >
                              {wd.status}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] break-all">
                            {wd.id} · Ref {wd.settlementReference ?? wd.id} · {wd.expirationLabel ?? 'Unlimited · Never Expires'}
                          </p>
                          <p className="font-mono text-[11px] text-[#44403C] dark:text-[#D6D3CD] tabular-nums">
                            Gross ${wd.amountUsd.toFixed(2)} · Fee ${feeUsd.toFixed(2)} · Net Settled ${netUsd.toFixed(2)}
                            {typeof wd.amountLocal === 'number' && wd.currencyLocal
                              ? ` (${wd.currencyLocal} ${wd.amountLocal.toFixed(2)})`
                              : ''}
                            {typeof wd.amountSol === 'number' ? ` (${wd.amountSol.toFixed(4)} SOL)` : ''}
                          </p>
                          <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">{wd.note}</p>
                          {wd.gatewayFallbackNote && (
                            <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D]">
                              {wd.gatewayFallbackNote}
                            </p>
                          )}
                          {isReversed && (
                            <p className="font-mono text-[11px] text-[#991B1B] dark:text-[#FCA5A5] pt-0.5">
                              Reversed ({wd.reversalId ?? 'REV'}): {wd.reversalReason ?? 'Wrong transaction'} · +${wd.amountUsd.toFixed(2)} restored
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right font-mono tabular-nums mr-1">
                            <p
                              className={`font-semibold ${
                                isReversed
                                  ? 'line-through text-[#78716C] dark:text-[#A8A29E]'
                                  : 'text-[#14532D] dark:text-[#4ADE80]'
                              }`}
                            >
                              -${wd.amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            {isReversed && (
                              <p className="text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
                                +${wd.amountUsd.toFixed(2)} Restored
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => downloadReceiptText(wd)}
                            title="Download Withdrawal Receipt"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm hover:border-[#141413] dark:hover:border-[#F5F3EE]"
                          >
                            <Download className="w-3 h-3" />
                            <span>Receipt</span>
                          </button>

                          {!isReversed && (
                            <button
                              type="button"
                              onClick={() => {
                                setReversingWithdrawalId(isEditingReversal ? null : wd.id);
                                setReversalReason('Wrong Destination Account');
                                setReversalFeedback(null);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] rounded-sm hover:bg-[#FEE2E2] dark:hover:bg-[#3B1B1B]"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reverse</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditingReversal && !isReversed && (
                        <div className="p-3 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#FECACA] dark:border-[#7F1D1D] rounded-md space-y-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {REVERSAL_PRESET_REASONS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setReversalReason(preset)}
                                className={`px-2 py-1 text-[11px] rounded-sm border transition-colors ${
                                  reversalReason === preset
                                    ? 'bg-[#991B1B] text-white border-[#991B1B]'
                                    : 'bg-white dark:bg-[#171715] text-[#44403C] dark:text-[#D6D3CD] border-[#D6D1C7] dark:border-[#3A3732]'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                              type="text"
                              value={reversalReason}
                              onChange={(e) => setReversalReason(e.target.value)}
                              placeholder="Reason for reversing this withdrawal"
                              className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-[#171715] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setReversingWithdrawalId(null)}
                                className="px-2.5 py-1.5 text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={submittingReversal}
                                onClick={() => void handleReverseWithdrawal(wd.id)}
                                className="px-3 py-1.5 text-[11px] font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] rounded-sm disabled:opacity-50"
                              >
                                {submittingReversal ? 'Reversing…' : `Confirm Reversal (+$${wd.amountUsd.toFixed(2)})`}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
