import { CheckCircle2, Coins, CreditCard, ExternalLink, Lock, Smartphone, UserCheck, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { GhanaPayGateway } from './GhanaPayGateway';

export interface AfricaFxRates {
  USD: 1;
  GHS: number;
  NGN: number;
  KES: number;
  ZAR: number;
  XOF?: number;
  UGX?: number;
  EGP?: number;
  MAD?: number;
  RWF?: number;
  TZS?: number;
  EUR?: number;
  GBP?: number;
  CHF?: number;
  CAD?: number;
  AED?: number;
  SAR?: number;
  INR?: number;
  CNY?: number;
  JPY?: number;
  SGD?: number;
  rates?: Record<string, number>;
  source: 'live' | 'cached' | 'fallback';
  updatedAt: string;
}

export interface TransactionFeeQuote {
  methodId: string;
  corridorType: 'domestic' | 'intra_africa' | 'cross_continent';
  grossAmountUsd: number;
  gatewayFeeUsd: number;
  corridorFeeUsd: number;
  totalFeeUsd: number;
  netAmountUsd: number;
  effectiveFeePercent: number;
  currencyLocal: string;
  fxRate: number;
  grossLocal: number;
  feeLocal: number;
  netLocal: number;
  feeBreakdownLabel: string;
}

export interface CustomerKycProfileOption {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  countryOfResidence: string;
  continent: string;
  verificationTier: 'basic' | 'standard' | 'enhanced';
  status: 'verified' | 'pending_review';
  dailyLimitUsd: number;
}

export type BoostTierId = 'ghana_west_africa' | 'africa_global' | 'priority_frontpage';

export interface BoostTierConfig {
  id: BoostTierId;
  name: string;
  budgetUsd: number;
  dailyCapUsd: number;
  boostScore: number;
  targetRegions: string;
  channels: string;
  description: string;
}

export interface TrendingAdBoost {
  id: string;
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  category: string;
  bureau: string;
  tier: BoostTierId;
  tierLabel: string;
  targetRegions: string;
  budgetUsd: number;
  amountGhs: number;
  dailyCapUsd: number;
  boostScore: number;
  impressions: number;
  boostedClicks: number;
  status: 'Active' | 'Paused' | 'Reversed';
  settlementMode: 'live_gateway' | 'owner_balance' | 'live_treasury_rail';
  gatewayProvider:
    | 'ghana_pay'
    | 'flutterwave'
    | 'ghana_momo'
    | 'solana'
    | 'paypal'
    | 'stripe'
    | 'owner_balance'
    | 'in_app_wallet';
  paymentReference: string;
  sponsorName: string;
  ctaLabel: string;
  createdAt: string;
  reversedAt?: string;
  reversalId?: string;
  reversalReason?: string;
}

export interface MonetizationPlan {
  id: string;
  audience: string;
  name: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  billingType: 'recurring' | 'one-time';
  description: string;
  limits: string[];
  boostArticleId?: string;
  boostTier?: BoostTierId;
}

export interface PaymentMethodOption {
  id: string;
  name: string;
  rails: string;
  settlement: string;
  supportsCheckout: boolean;
  supportsPayout: boolean;
}

export interface MonetizationTransaction {
  id: string;
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'annual' | 'one-time';
  amountUsd: number;
  processorFeeUsd?: number;
  netAmountUsd?: number;
  settlementReference?: string;
  status?: 'Settled' | 'Reversed';
  settlementMode?: 'live_gateway' | 'live_treasury_rail' | 'owner_balance';
  gatewayProvider?:
    | 'stripe'
    | 'paypal'
    | 'solana'
    | 'ghana_pay'
    | 'flutterwave'
    | 'ghana_momo'
    | 'in_app_wallet'
    | 'bank_wire';
  verifiedRealFunds?: boolean;
  currencyLocal?: string;
  amountLocal?: number;
  reversedAt?: string;
  reversalId?: string;
  reversalReason?: string;
  paymentMethodId: string;
  paymentMethodName: string;
  customerName: string;
  customerEmail: string;
  accountHint: string;
  createdAt: string;
}

export interface MonetizationSummary {
  monthlyRecurringRevenueUsd: number;
  annualRunRateUsd: number;
  adSponsorshipRevenueUsd: number;
  activeSubscribers: number;
  pendingCreatorPayoutUsd: number;
  realVerifiedRevenueUsd?: number;
  realVerifiedTransactionsCount?: number;
}

export interface GatewayCapabilities {
  stripeConfigured: boolean;
  stripeWebhookConfigured: boolean;
  stripeConnectConfigured: boolean;
  paypalConfigured: boolean;
  paypalEnv: 'live';
  ghanaPayConfigured?: boolean;
  ghanaPayEnv?: 'live';
  mtnMomoConfigured?: boolean;
  ghanaPayTreasuryLedgerReady?: boolean;
  flutterwaveConfigured?: boolean;
  flutterwaveWebhookConfigured?: boolean;
  ghanaMomoConfigured?: boolean;
  ghanaMomoMerchantMasked?: string | null;
  ghanaMomoDefaultNumber?: string;
  solanaTreasuryAddress: string | null;
  solanaTreasurySource: 'env' | 'owner_wallet' | 'none';
  solanaRpcUrl: string;
  adsensePublisherId: string | null;
  adsTxtConfigured: boolean;
  anyFiatGatewayLive: boolean;
  anyRealPaymentRailLive: boolean;
}

export interface SponsoredCampaign {
  id: string;
  advertiserName: string;
  headline: string;
  summary: string;
  targetUrl: string;
  ctaLabel: string;
  amountUsd: number;
  settlementMode: 'live_gateway' | 'live_treasury_rail';
  paymentReference: string;
  clicks: number;
  impressions: number;
  active: boolean;
  createdAt: string;
}

interface PaymentModalProps {
  plan: MonetizationPlan | null;
  billingCycle: 'monthly' | 'annual';
  paymentMethods: PaymentMethodOption[];
  realCapabilities?: GatewayCapabilities | null;
  africaFxRates?: AfricaFxRates | null;
  onClose: () => void;
  onSuccess: (payload: {
    transaction: MonetizationTransaction;
    summary: MonetizationSummary;
    sponsoredCampaigns?: SponsoredCampaign[];
    trendingBoosts?: TrendingAdBoost[];
    message: string;
  }) => void;
}

const LOCAL_CURRENCIES = [
  { code: 'GHS', symbol: 'GH₵', label: 'GHS (Ghana Cedi)' },
  { code: 'NGN', symbol: '₦', label: 'NGN (Nigerian Naira)' },
  { code: 'KES', symbol: 'KSh', label: 'KES (Kenyan Shilling)' },
  { code: 'ZAR', symbol: 'R', label: 'ZAR (South African Rand)' },
  { code: 'XOF', symbol: 'CFA', label: 'XOF (West African CFA)' },
  { code: 'UGX', symbol: 'USh', label: 'UGX (Ugandan Shilling)' },
  { code: 'EUR', symbol: '€', label: 'EUR (Euro)' },
  { code: 'GBP', symbol: '£', label: 'GBP (British Pound)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (Canadian Dollar)' },
  { code: 'USD', symbol: '$', label: 'USD (US Dollar)' }
] as const;

export function PaymentModal({
  plan,
  billingCycle,
  paymentMethods,
  realCapabilities,
  africaFxRates,
  onClose,
  onSuccess
}: PaymentModalProps) {
  const checkoutMethods = paymentMethods.filter((m) => m.supportsCheckout);
  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    checkoutMethods[0]?.id || 'ghana-pay'
  );
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [accountHint, setAccountHint] = useState('');
  const [customAmountInput, setCustomAmountInput] = useState('15');
  const [africaCurrency, setAfricaCurrency] = useState<string>('GHS');
  const [corridorType, setCorridorType] = useState<'domestic' | 'intra_africa' | 'cross_continent'>('domestic');
  const [momoNetwork, setMomoNetwork] = useState<'MTN' | 'VOD' | 'ATL' | 'CARD_BANK'>('MTN');
  const [momoPhone, setMomoPhone] = useState('');
  const [ussdMsisdn, setUssdMsisdn] = useState('');

  // Customer KYC attachment
  const [kycProfiles, setKycProfiles] = useState<CustomerKycProfileOption[]>([]);
  const [selectedKycId, setSelectedKycId] = useState<string>('');

  // Live Itemized Quote
  const [liveQuote, setLiveQuote] = useState<TransactionFeeQuote | null>(null);

  // Sponsor Placement details (available on ALL rails for Commercials & Ads or custom contributions)
  const [sponsorHeadline, setSponsorHeadline] = useState('');
  const [sponsorSummary, setSponsorSummary] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');

  // Optional Solana on-chain quote state
  const [solanaQuote, setSolanaQuote] = useState<{
    recipientAddress: string;
    amountSol: number;
    solUsdRate: number;
    solanaPayUri: string;
    memoRef: string;
  } | null>(null);
  const [solanaSignature, setSolanaSignature] = useState('');
  const [preparingGateway, setPreparingGateway] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    transaction: MonetizationTransaction;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!plan) return;
    setError(null);
    setReceipt(null);
    setSolanaQuote(null);
    setSolanaSignature('');
    setCustomAmountInput(String(plan.monthlyPriceUsd || 15));
    setSelectedMethodId(checkoutMethods[0]?.id || 'ghana-pay');
    setAfricaCurrency('GHS');
    setCorridorType('domestic');

    fetch('/api/kyc/profiles')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { profiles?: CustomerKycProfileOption[] } | null) => {
        if (json && Array.isArray(json.profiles)) {
          setKycProfiles(json.profiles);
        }
      })
      .catch(() => {
        // Non-fatal KYC list load failure
      });
  }, [plan]);

  useEffect(() => {
    setError(null);
    setSolanaQuote(null);
  }, [selectedMethodId]);

  useEffect(() => {
    if (!plan) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [plan, onClose]);

  const isCustomContribution = plan?.id === 'custom-contribution';
  const isTrendingBoost = plan?.id === 'trending-boost';
  const effectiveCycle = plan?.billingType === 'one-time' ? 'one-time' : billingCycle;
  const parsedCustom = Math.max(1, Number(customAmountInput) || 15);
  const priceUsd = !plan
    ? 0
    : isCustomContribution
      ? Number(parsedCustom.toFixed(2))
      : effectiveCycle === 'annual'
        ? plan.annualPriceUsd
        : plan.monthlyPriceUsd;

  useEffect(() => {
    if (!plan || priceUsd <= 0) return;
    const targetCurrency =
      selectedMethodId === 'ghana-pay' ||
      selectedMethodId === 'ghana-momo' ||
      selectedMethodId === 'ussd-789'
        ? 'GHS'
        : africaCurrency;

    const controller = new AbortController();
    fetch(
      `/api/monetization/quote?methodId=${encodeURIComponent(selectedMethodId)}&amountUsd=${encodeURIComponent(String(priceUsd))}&currencyLocal=${encodeURIComponent(targetCurrency)}&corridorType=${encodeURIComponent(corridorType)}`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { quote?: TransactionFeeQuote } | null) => {
        if (payload?.quote) {
          setLiveQuote(payload.quote);
        }
      })
      .catch(() => {
        // Preserve previous quote on abort/network delay
      });

    return () => controller.abort();
  }, [plan, selectedMethodId, priceUsd, africaCurrency, corridorType]);

  if (!plan) return null;

  const fxRates: AfricaFxRates = africaFxRates ?? {
    USD: 1,
    GHS: 15.5,
    NGN: 1650,
    KES: 129,
    ZAR: 18.1,
    source: 'fallback',
    updatedAt: ''
  };
  const fallbackRates: Record<string, number> = {
    USD: 1,
    GHS: fxRates.GHS,
    NGN: fxRates.NGN,
    KES: fxRates.KES,
    ZAR: fxRates.ZAR,
    XOF: fxRates.XOF ?? 615,
    UGX: fxRates.UGX ?? 3720,
    EUR: fxRates.EUR ?? 0.94,
    GBP: fxRates.GBP ?? 0.79,
    CAD: fxRates.CAD ?? 1.4
  };
  const activeFxRate = fxRates.rates?.[africaCurrency] ?? fallbackRates[africaCurrency] ?? 1;
  const localAmount = Number((priceUsd * activeFxRate).toFixed(2));
  const localSymbol =
    LOCAL_CURRENCIES.find((c) => c.code === africaCurrency)?.symbol || africaCurrency;

  const selectedMethod =
    checkoutMethods.find((m) => m.id === selectedMethodId) || checkoutMethods[0];

  const isGhanaPayMethod =
    selectedMethodId === 'ghana-pay' || selectedMethodId === 'ghana-momo';
  const isUssd789Method = selectedMethodId === 'ussd-789';
  const isAppWalletMethod = selectedMethodId === 'newshub-app-wallet';
  const isFlutterwaveMethod = selectedMethodId === 'flutterwave-africa';
  const isAfricaRail = isGhanaPayMethod || isFlutterwaveMethod || isUssd789Method;
  const isBankWireMethod = selectedMethodId === 'bank-wire';
  const isSolanaMethod = selectedMethodId === 'solana';

  const canUseSolanaLive = isSolanaMethod && Boolean(realCapabilities?.solanaTreasuryAddress);

  const hintPlaceholderByMethod: Record<string, string> = {
    'ghana-pay': 'e.g. MTN MoMo 0557711975 or GHP Wallet',
    'ghana-momo': 'e.g. MTN MoMo 0557711975 / Telecel Cash',
    'ussd-789': 'e.g. *789*6# Mobile Number (+233 / International)',
    'newshub-app-wallet': 'e.g. Android APK / Base44 App Wallet ID or Stars Credit',
    'flutterwave-africa': 'e.g. Pan-Africa MoMo / USSD / Verve Card',
    card: 'e.g. Visa ending in 4242',
    paypal: 'e.g. billing@youraccount.com',
    'digital-wallet': 'e.g. Apple Pay / Google Pay Wallet',
    'bank-wire': 'e.g. Corporate Treasury ACH / SEPA / SWIFT',
    'mobile-money': 'e.g. M-Pesa / MTN +254 7XX XXX XXX',
    solana: 'e.g. Phantom / Solflare Wallet'
  };

  const sponsorDetailsPayload =
    (plan.id === 'commercials-slot' || isCustomContribution) && sponsorUrl.trim()
      ? {
          advertiserName: customerName.trim() || 'News Hub 24+ Sponsor',
          headline: sponsorHeadline.trim() || `${customerName.trim() || 'Partner'} Feature`,
          summary:
            sponsorSummary.trim() ||
            'Verified Commercials & Ads placement published on News Hub 24+.',
          targetUrl: sponsorUrl.trim()
        }
      : undefined;

  const handleSelectKycProfile = (kycId: string) => {
    setSelectedKycId(kycId);
    const chosen = kycProfiles.find((k) => k.id === kycId);
    if (chosen) {
      if (!customerName.trim()) setCustomerName(chosen.fullName);
      if (!customerEmail.trim()) setCustomerEmail(chosen.email);
      if (!ussdMsisdn.trim()) setUssdMsisdn(chosen.phone);
      if (!momoPhone.trim()) setMomoPhone(chosen.phone);
    }
  };

  const handlePrepareSolanaPay = async () => {
    setError(null);
    setPreparingGateway(true);
    try {
      const res = await fetch('/api/monetization/solana/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle: effectiveCycle,
          customAmountUsd: priceUsd
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to prepare Solana Pay request.');
      }
      setSolanaQuote(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to generate Solana Pay quote.');
    } finally {
      setPreparingGateway(false);
    }
  };

  const handleVerifySolanaOnChain = async () => {
    setError(null);
    if (solanaSignature.trim().length < 32) {
      setError('Paste your confirmed Solana transaction signature first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/monetization/solana/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: solanaSignature.trim(),
          planId: plan.id,
          billingCycle: effectiveCycle,
          customAmountUsd: priceUsd,
          customerName: customerName.trim() || 'Solana Supporter',
          customerEmail: customerEmail.trim() || 'onchain@newshub24plus.com',
          sponsorDetails: sponsorDetailsPayload,
          boostArticleId: plan.boostArticleId,
          boostTier: plan.boostTier,
          customerKycId: selectedKycId || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Solana Mainnet verification failed.');
      }
      setReceipt({ transaction: data.transaction, message: data.message });
      onSuccess(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to verify Solana payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (customerName.trim().length < 2) {
      setError('Please enter your billing name or organization.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setError('Please enter a valid email address for your receipt.');
      return;
    }

    if (isGhanaPayMethod) {
      return;
    }

    if (isUssd789Method && ussdMsisdn.replace(/[\s()-]/g, '').length < 7) {
      setError('Enter your mobile phone number (MSISDN) to authorize the *789# USSD prompt.');
      return;
    }

    // Zero-API Direct Verifiable SHA-256 Ledger Checkout across all global & African rails
    setSubmitting(true);
    try {
      const hintParts = [accountHint.trim()];
      if (isUssd789Method && ussdMsisdn.trim()) {
        hintParts.push(`*789*6# MSISDN ${ussdMsisdn.trim()}`);
      } else if (isAfricaRail && momoPhone.trim()) {
        hintParts.push(`${momoNetwork} ${momoPhone.trim()}`);
      }
      const res = await fetch('/api/monetization/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle: effectiveCycle,
          customAmountUsd: priceUsd,
          paymentMethodId: selectedMethodId,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          accountHint: hintParts.filter(Boolean).join(' · '),
          sponsorDetails: sponsorDetailsPayload,
          boostArticleId: plan.boostArticleId,
          boostTier: plan.boostTier,
          customerKycId: selectedKycId || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Checkout could not be completed.');
      }

      setReceipt({ transaction: data.transaction, message: data.message });
      onSuccess(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to process checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-8 sm:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#FBF9F5] dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#1C1B19]">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-0.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              <span>News Hub 24+.com Africa, *789# Shortcode &amp; Global Checkout</span>
            </p>
            <h2
              id="payment-modal-title"
              className="font-serif text-lg sm:text-xl font-semibold text-[#141413] dark:text-[#F5F3EE] truncate"
            >
              {plan.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment checkout"
            className="inline-flex items-center justify-center w-9 h-9 text-[#292524] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {receipt ? (
          <div className="p-6 sm:p-8 space-y-5">
            <div
              className={`flex items-start gap-3 p-4 rounded-md border ${
                receipt.transaction.verifiedRealFunds || receipt.transaction.paymentMethodId === 'ussd-789'
                  ? 'bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                  : 'bg-[#FFFBEB] dark:bg-[#261D0B] border-[#FDE68A] dark:border-[#78350F]'
              }`}
            >
              <CheckCircle2
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  receipt.transaction.verifiedRealFunds || receipt.transaction.paymentMethodId === 'ussd-789'
                    ? 'text-[#14532D] dark:text-[#4ADE80]'
                    : 'text-[#92400E] dark:text-[#FBBF24]'
                }`}
              />
              <div>
                <p className="text-sm font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  {receipt.transaction.verifiedRealFunds
                    ? 'Verified Real Funds Settled'
                    : receipt.transaction.paymentMethodId === 'ussd-789'
                      ? '*789# Universal Shortcode Settlement Complete'
                      : receipt.transaction.paymentMethodId === 'newshub-app-wallet'
                        ? 'In-App Wallet Settlement Complete'
                        : 'Live Treasury Rail Settlement Recorded'}
                </p>
                <p className="text-xs text-[#44403C] dark:text-[#D6D3CD] mt-1">
                  {receipt.message}
                </p>
              </div>
            </div>

            <dl className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md bg-white dark:bg-[#171715] text-xs">
              <div className="px-4 py-3 flex justify-between gap-4">
                <dt className="text-[#57534E] dark:text-[#A8A29E]">Transaction ID</dt>
                <dd className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  {receipt.transaction.id}
                </dd>
              </div>
              {receipt.transaction.settlementReference && (
                <div className="px-4 py-3 flex justify-between gap-4">
                  <dt className="text-[#57534E] dark:text-[#A8A29E]">Gateway Reference</dt>
                  <dd className="font-mono text-[#141413] dark:text-[#F5F3EE] truncate max-w-[65%]">
                    {receipt.transaction.settlementReference}
                  </dd>
                </div>
              )}
              <div className="px-4 py-3 flex justify-between gap-4">
                <dt className="text-[#57534E] dark:text-[#A8A29E]">Payment Method</dt>
                <dd className="font-medium text-[#141413] dark:text-[#F5F3EE]">
                  {receipt.transaction.paymentMethodName} ({receipt.transaction.accountHint})
                </dd>
              </div>
              <div className="px-4 py-3 flex justify-between gap-4">
                <dt className="text-[#57534E] dark:text-[#A8A29E]">Fee / Net Settled</dt>
                <dd className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  ${receipt.transaction.amountUsd.toFixed(2)} gross · Fee ${(receipt.transaction.processorFeeUsd ?? 0).toFixed(2)} · Net $
                  {(receipt.transaction.netAmountUsd ?? receipt.transaction.amountUsd).toFixed(2)} USD
                  {receipt.transaction.amountLocal && receipt.transaction.currencyLocal
                    ? ` (${receipt.transaction.currencyLocal} ${receipt.transaction.amountLocal.toFixed(2)})`
                    : ''}
                </dd>
              </div>
            </dl>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="p-6 space-y-5 max-h-[78vh] overflow-y-auto"
          >
            {/* Order Summary Bar */}
            <div className="p-4 bg-white dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md flex items-center justify-between gap-4">
              <div>
                <span className="block text-xs text-[#57534E] dark:text-[#A8A29E]">
                  {plan.audience}
                </span>
                <span className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  {plan.name}
                </span>
                {isAfricaRail && (
                  <span className="block font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80] tabular-nums mt-0.5">
                    ≈ {localSymbol} {localAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({africaCurrency} · $1 = {localSymbol}{activeFxRate})
                  </span>
                )}
              </div>
              <div className="text-right">
                {isCustomContribution ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-bold">$</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      aria-label="Custom USD amount"
                      value={customAmountInput}
                      onChange={(e) => setCustomAmountInput(e.target.value)}
                      className="w-20 px-2 py-1 text-right font-mono text-base font-bold bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                ) : (
                  <span className="block font-mono text-xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    ${priceUsd}
                  </span>
                )}
                <span className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                  {effectiveCycle === 'one-time'
                    ? isTrendingBoost
                      ? 'one-time ad boost'
                      : 'one-time settlement'
                    : effectiveCycle === 'annual'
                      ? 'billed annually'
                      : 'billed monthly'}
                </span>
              </div>
            </div>

            {/* Live Transparent Fee Quote Strip */}
            {liveQuote && (
              <div className="p-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Verified Fee Quote: {liveQuote.feeBreakdownLabel}
                  </span>
                  <div className="flex items-center gap-2">
                    <label htmlFor="quote-corridor" className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                      Corridor:
                    </label>
                    <select
                      id="quote-corridor"
                      value={corridorType}
                      onChange={(e) =>
                        setCorridorType(e.target.value as 'domestic' | 'intra_africa' | 'cross_continent')
                      }
                      className="px-2 py-1 text-[11px] bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                    >
                      <option value="domestic">Domestic Local</option>
                      <option value="intra_africa">Intra-Africa Cross-Border</option>
                      <option value="cross_continent">Africa ↔ Other Continents</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] tabular-nums pt-1 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                  <div>
                    <span className="block text-[#57534E] dark:text-[#A8A29E]">Gross</span>
                    <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      ${liveQuote.grossAmountUsd.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[#57534E] dark:text-[#A8A29E]">
                      Processor + Corridor Fee ({liveQuote.effectiveFeePercent.toFixed(2)}%)
                    </span>
                    <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">
                      -${liveQuote.totalFeeUsd.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[#57534E] dark:text-[#A8A29E]">Net Settled</span>
                    <span className="font-semibold text-[#14532D] dark:text-[#4ADE80]">
                      ${liveQuote.netAmountUsd.toFixed(2)} ({liveQuote.currencyLocal} {liveQuote.netLocal.toFixed(2)})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method Picker */}
            <div>
              <span className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-2">
                Select Payment Rail (*789# Shortcode, GhanaPay, Pan-Africa &amp; Global)
              </span>
              <div className="space-y-2">
                {checkoutMethods.map((method, idx) => {
                  const active = selectedMethodId === method.id;
                  const isAppOpt = method.id === 'newshub-app-wallet';
                  const isUssdOpt = method.id === 'ussd-789';
                  const methodIsRealReady =
                    method.id === 'solana'
                      ? Boolean(realCapabilities?.solanaTreasuryAddress)
                      : method.id === 'paypal'
                        ? Boolean(realCapabilities?.paypalConfigured)
                        : method.id === 'ghana-pay' || method.id === 'ghana-momo'
                          ? Boolean(
                              realCapabilities?.ghanaPayConfigured ||
                                realCapabilities?.ghanaMomoConfigured ||
                                realCapabilities?.ghanaPayTreasuryLedgerReady
                            )
                          : method.id === 'flutterwave-africa'
                            ? Boolean(realCapabilities?.flutterwaveConfigured)
                            : isUssdOpt
                              ? true
                              : Boolean(realCapabilities?.stripeConfigured);

                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethodId(method.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-md border flex items-center justify-between gap-3 transition-colors ${
                        active
                          ? 'bg-white dark:bg-[#1C1B19] border-[#991B1B] dark:border-[#F87171]'
                          : 'bg-white dark:bg-[#171715] border-[#E5E2DC] dark:border-[#2C2A26] hover:border-[#A8A29E] dark:hover:border-[#57534E]'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          {idx < 3 ? `Option ${idx + 1} · ` : ''}
                          {method.name}
                        </span>
                        <span className="block text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                          {method.rails}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[11px] whitespace-nowrap shrink-0 ${
                          isAppOpt || methodIsRealReady
                            ? 'text-[#14532D] dark:text-[#4ADE80] font-semibold'
                            : 'text-[#78716C] dark:text-[#A8A29E]'
                        }`}
                      >
                        {isAppOpt
                          ? '3rd Option · In-App ($0 Fee)'
                          : isUssdOpt
                            ? '*789# Shortcode Ready (0.75%)'
                            : method.id === 'ghana-pay' || method.id === 'ghana-momo'
                              ? 'GhanaPay & MTN MoMo (0.5%)'
                              : method.id === 'bank-wire'
                                ? methodIsRealReady
                                  ? 'Live Wire Ready (0.8%)'
                                  : 'Wire Ledger (0.8% Fee)'
                                : methodIsRealReady
                                  ? 'Live Gateway Ready'
                                  : 'Gateway Key Required'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Verified Customer KYC Profile Attachment */}
            {kycProfiles.length > 0 && (
              <div className="p-3.5 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="checkout-kyc-profile" className="font-semibold text-[#141413] dark:text-[#F5F3EE] flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
                    <span>Attach Verified Customer Background / KYC Profile (Optional)</span>
                  </label>
                  <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                    {kycProfiles.length} on file
                  </span>
                </div>
                <select
                  id="checkout-kyc-profile"
                  value={selectedKycId}
                  onChange={(e) => handleSelectKycProfile(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                >
                  <option value="">Proceed as Guest / Enter Manual Billing Details</option>
                  {kycProfiles.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.fullName} ({k.countryOfResidence} · {k.continent}) — {k.verificationTier.toUpperCase()} (${k.dailyLimitUsd.toLocaleString()}/day)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sponsor Placement Details (NOW AVAILABLE ON ALL RAILS INCLUDING GHANAPAY & *789#) */}
            {(plan.id === 'commercials-slot' || isCustomContribution) && (
              <div className="p-4 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-3">
                <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Live Commercial &amp; Sponsor Placement Details (Tracked via /r/sponsor &amp; CPC Attribution)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="sponsor-headline" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                      Sponsor Headline
                    </label>
                    <input
                      id="sponsor-headline"
                      type="text"
                      value={sponsorHeadline}
                      onChange={(e) => setSponsorHeadline(e.target.value)}
                      placeholder="e.g. Global Trade Report 2026"
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <div>
                    <label htmlFor="sponsor-url" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                      Sponsor Target URL
                    </label>
                    <input
                      id="sponsor-url"
                      type="url"
                      value={sponsorUrl}
                      onChange={(e) => setSponsorUrl(e.target.value)}
                      placeholder="https://your-sponsor-site.com"
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="sponsor-summary" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                    Sponsor Summary Copy
                  </label>
                  <input
                    id="sponsor-summary"
                    type="text"
                    value={sponsorSummary}
                    onChange={(e) => setSponsorSummary(e.target.value)}
                    placeholder="Short 1-sentence sponsor description displayed to readers"
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
              </div>
            )}

            {/* Integrated GhanaPay & MTN MoMo (0557711975) Gateway + Third-Party Support */}
            {isGhanaPayMethod && (
              <GhanaPayGateway
                initialPlan={plan}
                billingCycle={effectiveCycle}
                amountUsd={priceUsd}
                africaFxRates={fxRates}
                defaultMerchantNumber={realCapabilities?.ghanaMomoDefaultNumber || '0557711975'}
                sponsorDetails={sponsorDetailsPayload}
                customerKycId={selectedKycId || undefined}
                compact
                onCheckoutSuccess={(payload) => {
                  setReceipt({ transaction: payload.transaction, message: payload.message });
                  onSuccess(payload);
                }}
              />
            )}

            {/* Universal *789# Shortcode Payment Rail */}
            {isUssd789Method && (
              <div className="p-4 bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-md space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#14532D] dark:text-[#86EFAC] flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    <span>Universal *789# USSD Shortcode Payment</span>
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#14532D] dark:text-[#86EFAC] tabular-nums">
                    Dial *789*6# · Fee: 0.75% (${(liveQuote?.totalFeeUsd ?? Number((priceUsd * 0.0075).toFixed(2))).toFixed(2)})
                  </span>
                </div>
                <p className="text-[#166534] dark:text-[#BBF7D0] leading-relaxed">
                  Authorize this subscription, boost, or commercial ad slot via universal telecom shortcode <strong className="font-mono">*789#</strong> (MTN, Telecel, AirtelTigo, or International roaming SIM).
                </p>
                <div>
                  <label htmlFor="ussd-msisdn" className="block text-[11px] font-medium text-[#14532D] dark:text-[#BBF7D0] mb-1">
                    Mobile Number for *789# Prompt *
                  </label>
                  <input
                    id="ussd-msisdn"
                    type="tel"
                    value={ussdMsisdn}
                    onChange={(e) => setUssdMsisdn(e.target.value)}
                    placeholder="e.g. 0557711975 or +233557711975"
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#10100F] border border-[#BBF7D0] dark:border-[#166534] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
              </div>
            )}

            {/* Flutterwave Currency & Mobile Money Controls */}
            {isFlutterwaveMethod && (
              <div className="p-4 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-md space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                    <span>Pan-Africa &amp; Global Settlement ({africaCurrency})</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80]">
                    1 USD = {localSymbol} {activeFxRate}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="africa-currency" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                      Settlement Currency
                    </label>
                    <select
                      id="africa-currency"
                      value={africaCurrency}
                      onChange={(e) => setAfricaCurrency(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                    >
                      {LOCAL_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="momo-network" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                      Channel / Network
                    </label>
                    <select
                      id="momo-network"
                      value={momoNetwork}
                      onChange={(e) =>
                        setMomoNetwork(e.target.value as 'MTN' | 'VOD' | 'ATL' | 'CARD_BANK')
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                    >
                      <option value="MTN">MTN Mobile Money</option>
                      <option value="VOD">Telecel Cash (GH)</option>
                      <option value="ATL">AT Money (AirtelTigo)</option>
                      <option value="CARD_BANK">Africa Visa / Verve / GhIPSS</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="momo-phone" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                      MoMo Number (Optional)
                    </label>
                    <input
                      id="momo-phone"
                      type="tel"
                      value={momoPhone}
                      onChange={(e) => setMomoPhone(e.target.value)}
                      placeholder="0557711975"
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3rd Payment Option: News Hub 24+ App Wallet */}
            {isAppWalletMethod && (
              <div className="p-4 bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-md space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#14532D] dark:text-[#86EFAC] flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    <span>News Hub 24+ App Wallet · 3rd Payment Option ($0 Fee)</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#14532D] dark:text-[#86EFAC] tabular-nums">
                    ${priceUsd.toFixed(2)} USD (≈ GH₵ {(priceUsd * fxRates.GHS).toFixed(2)})
                  </span>
                </div>
                <p className="text-[#166534] dark:text-[#BBF7D0] leading-relaxed">
                  Settle directly using your Android APK (com.newshub24plus.android) or App Wallet balance with zero processor fee.
                </p>
              </div>
            )}

            {/* Live Solana On-Chain Payment Flow (Optional Public Wallet) */}
            {canUseSolanaLive && (
              <div className="p-4 bg-white dark:bg-[#171715] border border-[#BBF7D0] dark:border-[#166534] rounded-md space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#14532D] dark:text-[#4ADE80] flex items-center gap-1.5">
                    <Coins className="w-4 h-4" />
                    <span>Solana Mainnet On-Chain Payment</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handlePrepareSolanaPay()}
                    disabled={preparingGateway}
                    className="px-3 py-1.5 text-[11px] font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-sm disabled:opacity-60"
                  >
                    {preparingGateway
                      ? 'Calculating SOL…'
                      : solanaQuote
                        ? 'Refresh SOL Quote'
                        : `Get Exact SOL Pay Link ($${priceUsd})`}
                  </button>
                </div>

                {solanaQuote && (
                  <div className="space-y-2.5 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                    <p className="font-mono text-[11px] text-[#141413] dark:text-[#F5F3EE] break-all">
                      Send exactly <span className="font-bold">{solanaQuote.amountSol} SOL</span> (@ $
                      {solanaQuote.solUsdRate.toFixed(2)}/SOL) to Treasury:{' '}
                      <span className="font-semibold">{solanaQuote.recipientAddress}</span>
                    </p>
                    <a
                      href={solanaQuote.solanaPayUri}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-sm hover:opacity-90"
                    >
                      <span>Open Solana Wallet (Solana Pay)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <div className="pt-1 space-y-2">
                      <label
                        htmlFor="solana-tx-sig"
                        className="block text-[11px] font-medium text-[#292524] dark:text-[#D6D3CD]"
                      >
                        Paste Confirmed Solana Transaction Signature to Verify On-Chain:
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          id="solana-tx-sig"
                          type="text"
                          value={solanaSignature}
                          onChange={(e) => setSolanaSignature(e.target.value)}
                          placeholder="e.g. 5vP9xR2mQz8kLmN3w..."
                          className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                        />
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void handleVerifySolanaOnChain()}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-sm disabled:opacity-60 whitespace-nowrap"
                        >
                          {submitting ? 'Checking RPC…' : 'Verify on Solana Mainnet'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Billing Contact (for non-GhanaPay rails; GhanaPayGateway has its own compliant form & receipt) */}
            {!isGhanaPayMethod && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="checkout-name"
                      className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
                    >
                      Full Name or Organization *
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Kwame Mensah / Accra Herald"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-email"
                      className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
                    >
                      Billing Email *
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="billing@publication.org"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                    />
                  </div>
                </div>

                {!canUseSolanaLive && (
                  <div>
                    <label
                      htmlFor="checkout-hint"
                      className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
                    >
                      {selectedMethod?.name} Reference Label (optional)
                    </label>
                    <input
                      id="checkout-hint"
                      type="text"
                      value={accountHint}
                      onChange={(e) => setAccountHint(e.target.value)}
                      placeholder={hintPlaceholderByMethod[selectedMethodId] || 'Payment reference'}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                    />
                  </div>
                )}

                {error && (
                  <p
                    role="alert"
                    className="text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] px-3 py-2 rounded-md"
                  >
                    {error}
                  </p>
                )}

                <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#57534E] dark:text-[#A8A29E]">
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      {isUssd789Method
                        ? '*789# Universal Shortcode Rail'
                        : isAppWalletMethod
                          ? 'News Hub 24+ App Wallet'
                          : isFlutterwaveMethod
                            ? 'Flutterwave Africa · Zero-API Verifiable Ledger'
                            : canUseSolanaLive
                              ? 'Solana Mainnet RPC Verified'
                              : isBankWireMethod
                                ? 'Bank Wire · Zero-API Verifiable Ledger'
                                : `${selectedMethod?.name || 'Direct Rail'} · Zero-API Verifiable Ledger`}
                    </span>
                  </span>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors"
                    >
                      Cancel
                    </button>
                    {!canUseSolanaLive && (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-2 text-xs font-semibold text-white rounded-md disabled:opacity-50 transition-colors bg-[#14532D] hover:bg-[#166534]"
                      >
                        {submitting
                          ? 'Processing…'
                          : isUssd789Method
                            ? `Authorize *789# Pay ($${priceUsd} · GH₵ ${(priceUsd * fxRates.GHS).toFixed(2)})`
                            : isAppWalletMethod
                              ? `Pay $${priceUsd} via App Wallet`
                              : isFlutterwaveMethod
                                ? `Pay ${localSymbol} ${localAmount.toFixed(2)} via ${selectedMethod?.name || 'Africa Rail'}`
                                : `Pay $${priceUsd} via ${selectedMethod?.name || 'Direct Ledger'}`}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
