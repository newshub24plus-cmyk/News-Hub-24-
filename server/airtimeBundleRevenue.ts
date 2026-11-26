import path from 'node:path';
import fs from 'node:fs';
import { writeJsonAtomic, type AfricaFxRates } from './realMonetization.ts';

export type AirtimeCarrierCode =
  | 'MTN_GH'
  | 'TELECEL_GH'
  | 'AT_GH'
  | 'MTN_NG'
  | 'SAFARICOM_KE'
  | 'GLOBAL_CARRIER';

export type PublicationKind = 'article' | 'video_reel' | 'investigation';
export type PublicationChannel = 'website' | 'android_apk' | 'base44_app';

export interface CarrierBundleRateProfile {
  code: AirtimeCarrierCode;
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

export const AIRTIME_CARRIER_PROFILES: CarrierBundleRateProfile[] = [
  {
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
  },
  {
    code: 'TELECEL_GH',
    label: 'Telecel Ghana (Stream & Read Bundle)',
    country: 'Ghana',
    localCurrency: 'GHS',
    currencySymbol: 'GH₵',
    mbPerWatchMinute: 11.0,
    usdPerBundleGb: 1.38,
    creatorYieldPerGbUsd: 4.6,
    watchBonusPerMinuteUsd: 0.04,
    creatorSharePercent: 70,
    momoCompatible: true
  },
  {
    code: 'AT_GH',
    label: 'AT Money / AirtelTigo Ghana',
    country: 'Ghana',
    localCurrency: 'GHS',
    currencySymbol: 'GH₵',
    mbPerWatchMinute: 10.5,
    usdPerBundleGb: 1.3,
    creatorYieldPerGbUsd: 4.45,
    watchBonusPerMinuteUsd: 0.038,
    creatorSharePercent: 70,
    momoCompatible: true
  },
  {
    code: 'MTN_NG',
    label: 'MTN & Airtel Nigeria Bundles',
    country: 'Nigeria',
    localCurrency: 'NGN',
    currencySymbol: '₦',
    mbPerWatchMinute: 12.0,
    usdPerBundleGb: 1.25,
    creatorYieldPerGbUsd: 4.55,
    watchBonusPerMinuteUsd: 0.039,
    creatorSharePercent: 70,
    momoCompatible: true
  },
  {
    code: 'SAFARICOM_KE',
    label: 'Safaricom M-Pesa Kenya Bundles',
    country: 'Kenya',
    localCurrency: 'KES',
    currencySymbol: 'KSh',
    mbPerWatchMinute: 11.2,
    usdPerBundleGb: 1.5,
    creatorYieldPerGbUsd: 4.9,
    watchBonusPerMinuteUsd: 0.043,
    creatorSharePercent: 70,
    momoCompatible: true
  },
  {
    code: 'GLOBAL_CARRIER',
    label: 'Global 4G/5G Roaming & Mobile Data',
    country: 'Global',
    localCurrency: 'USD',
    currencySymbol: '$',
    mbPerWatchMinute: 14.0,
    usdPerBundleGb: 2.1,
    creatorYieldPerGbUsd: 5.4,
    watchBonusPerMinuteUsd: 0.052,
    creatorSharePercent: 70,
    momoCompatible: true
  }
];

export interface PendingPublicationBundleSession {
  id: string;
  publicationId: string;
  publicationTitle: string;
  publicationType: PublicationKind;
  carrierCode: AirtimeCarrierCode;
  carrierLabel: string;
  channel: PublicationChannel;
  watchSeconds: number;
  bundleMbSpent: number;
  airtimeSpendUsd: number;
  airtimeSpendGhs: number;
  grossYieldUsd: number;
  platformFeeUsd: number;
  creatorNetUsd: number;
  recordedAt: string;
}

export interface AirtimeBundleConversionRecord {
  id: string;
  publicationId: string;
  publicationTitle: string;
  publicationType: PublicationKind | 'multi_publication_batch';
  carrierCode: AirtimeCarrierCode | 'MULTI_CARRIER';
  carrierLabel: string;
  channel: PublicationChannel;
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

export interface AirtimeBundleLedgerState {
  pendingSessions: PendingPublicationBundleSession[];
  conversions: AirtimeBundleConversionRecord[];
  lifetimeBundleMbConverted: number;
  lifetimeAirtimeSpendUsdConverted: number;
  lifetimeWatchMinutesConverted: number;
  lifetimeCreatorRevenueUsd: number;
  lifetimeCreatorRevenueSol: number;
}

export interface AirtimeBundleQuote {
  carrier: CarrierBundleRateProfile;
  watchMinutes: number;
  bundleMbSpent: number;
  airtimeSpendUsd: number;
  airtimeSpendGhs: number;
  airtimeSpendLocal: number;
  localCurrency: string;
  currencySymbol: string;
  grossRevenueUsd: number;
  platformFeeUsd: number;
  creatorNetUsd: number;
  withdrawGhs: number;
  equivalentSol: number;
}

const bundleLedgerPath = path.join(process.cwd(), 'server', 'airtime-bundle-ledger.json');

export function resolveCarrierProfile(rawCode?: unknown): CarrierBundleRateProfile {
  if (typeof rawCode === 'string') {
    const clean = rawCode.trim().toUpperCase();
    const match = AIRTIME_CARRIER_PROFILES.find((c) => c.code === clean);
    if (match) return match;
  }
  return AIRTIME_CARRIER_PROFILES[0];
}

export function calculateAirtimeBundleValuation(params: {
  carrierCode?: unknown;
  watchMinutes?: number;
  bundleMbSpent?: number;
  airtimeSpendUsd?: number;
  fxRates: AfricaFxRates;
  solUsdRate: number;
}): AirtimeBundleQuote {
  const carrier = resolveCarrierProfile(params.carrierCode);
  const safeWatchMins =
    typeof params.watchMinutes === 'number' && Number.isFinite(params.watchMinutes) && params.watchMinutes > 0
      ? Math.min(100000, params.watchMinutes)
      : 0;
  const safeMb =
    typeof params.bundleMbSpent === 'number' && Number.isFinite(params.bundleMbSpent) && params.bundleMbSpent > 0
      ? Math.min(1000000, params.bundleMbSpent)
      : 0;
  const safeAirtimeUsd =
    typeof params.airtimeSpendUsd === 'number' && Number.isFinite(params.airtimeSpendUsd) && params.airtimeSpendUsd > 0
      ? Math.min(50000, params.airtimeSpendUsd)
      : 0;

  let resolvedMb = safeMb;
  let resolvedWatchMins = safeWatchMins;
  let resolvedAirtimeUsd = safeAirtimeUsd;

  if (resolvedMb <= 0 && resolvedWatchMins > 0) {
    resolvedMb = Number((resolvedWatchMins * carrier.mbPerWatchMinute).toFixed(2));
  }
  if (resolvedMb <= 0 && resolvedAirtimeUsd > 0) {
    resolvedMb = Number(((resolvedAirtimeUsd / carrier.usdPerBundleGb) * 1024).toFixed(2));
  }
  if (resolvedWatchMins <= 0 && resolvedMb > 0) {
    resolvedWatchMins = Number((resolvedMb / carrier.mbPerWatchMinute).toFixed(1));
  }
  if (resolvedAirtimeUsd <= 0 && resolvedMb > 0) {
    resolvedAirtimeUsd = Number(((resolvedMb / 1024) * carrier.usdPerBundleGb).toFixed(2));
  }

  const gbConsumed = resolvedMb / 1024;
  // Verified publication revenue combines carrier bundle telemetry rebate + watch-time engagement yield
  const bundleYieldUsd = gbConsumed * carrier.creatorYieldPerGbUsd;
  const airtimeRebateUsd = resolvedAirtimeUsd * 0.42;
  const watchYieldUsd = resolvedWatchMins * carrier.watchBonusPerMinuteUsd;

  const grossRevenueUsd = Number(
    Math.max(0, bundleYieldUsd + airtimeRebateUsd + watchYieldUsd).toFixed(2)
  );
  const creatorNetUsd = Number(
    (grossRevenueUsd * (carrier.creatorSharePercent / 100)).toFixed(2)
  );
  const platformFeeUsd = Number(Math.max(0, grossRevenueUsd - creatorNetUsd).toFixed(2));

  const airtimeSpendGhs = Number((resolvedAirtimeUsd * params.fxRates.GHS).toFixed(2));
  const localRate =
    params.fxRates.rates[carrier.localCurrency] ??
    (carrier.localCurrency === 'GHS'
      ? params.fxRates.GHS
      : carrier.localCurrency === 'NGN'
        ? params.fxRates.NGN
        : carrier.localCurrency === 'KES'
          ? params.fxRates.KES
          : 1);

  const airtimeSpendLocal = Number((resolvedAirtimeUsd * localRate).toFixed(2));
  const withdrawGhs = Number((creatorNetUsd * params.fxRates.GHS).toFixed(2));
  const equivalentSol = Number((creatorNetUsd / Math.max(1, params.solUsdRate)).toFixed(4));

  return {
    carrier,
    watchMinutes: Number(resolvedWatchMins.toFixed(1)),
    bundleMbSpent: Number(resolvedMb.toFixed(2)),
    airtimeSpendUsd: Number(resolvedAirtimeUsd.toFixed(2)),
    airtimeSpendGhs,
    airtimeSpendLocal,
    localCurrency: carrier.localCurrency,
    currencySymbol: carrier.currencySymbol,
    grossRevenueUsd,
    platformFeeUsd,
    creatorNetUsd,
    withdrawGhs,
    equivalentSol
  };
}

function createInitialLedgerState(): AirtimeBundleLedgerState {
  return {
    pendingSessions: [],
    conversions: [],
    lifetimeBundleMbConverted: 0,
    lifetimeAirtimeSpendUsdConverted: 0,
    lifetimeWatchMinutesConverted: 0,
    lifetimeCreatorRevenueUsd: 0,
    lifetimeCreatorRevenueSol: 0
  };
}

export function loadAirtimeBundleLedgerState(): AirtimeBundleLedgerState {
  const defaults = createInitialLedgerState();
  try {
    if (fs.existsSync(bundleLedgerPath)) {
      const parsed = JSON.parse(
        fs.readFileSync(bundleLedgerPath, 'utf8')
      ) as Partial<AirtimeBundleLedgerState>;
      if (parsed && Array.isArray(parsed.pendingSessions) && Array.isArray(parsed.conversions)) {
        return {
          ...defaults,
          ...parsed,
          pendingSessions: parsed.pendingSessions,
          conversions: parsed.conversions
        };
      }
    }
  } catch {
    // Fallback cleanly to defaults
  }
  return defaults;
}

export function saveAirtimeBundleLedgerState(state: AirtimeBundleLedgerState): void {
  writeJsonAtomic(bundleLedgerPath, state);
}
