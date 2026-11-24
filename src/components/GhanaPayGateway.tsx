import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  LogIn,
  LogOut,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  UserCheck
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  auth,
  ensureGhanaPayAccount,
  persistTransactionLogToFirestore,
  signInWithGhanaPayGoogle,
  signOutGhanaPay,
  subscribeUserTransactionLogs,
  type GhanaPayAccountProfile,
  type GhanaPayNetwork,
  type GhanaPayRail,
  type TransactionLogRecord
} from '../lib/firebase';
import type {
  AfricaFxRates,
  MonetizationPlan,
  MonetizationSummary,
  MonetizationTransaction,
  SponsoredCampaign,
  TrendingAdBoost
} from './PaymentModal';

export interface GhanaPayGatewayProps {
  initialPlan?: MonetizationPlan | null;
  billingCycle?: 'monthly' | 'annual' | 'one-time';
  amountUsd?: number;
  africaFxRates?: AfricaFxRates | null;
  defaultMerchantNumber?: string;
  sponsorDetails?: {
    advertiserName: string;
    headline: string;
    summary: string;
    targetUrl: string;
  };
  compact?: boolean;
  customerKycId?: string;
  onCheckoutSuccess?: (payload: {
    transaction: MonetizationTransaction;
    summary: MonetizationSummary;
    sponsoredCampaigns?: SponsoredCampaign[];
    trendingBoosts?: TrendingAdBoost[];
    message: string;
  }) => void;
}

const CHANNEL_OPTIONS: Array<{
  code: GhanaPayRail;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  {
    code: 'MTN',
    label: 'MTN Mobile Money (Ghana)',
    shortLabel: 'MTN MoMo',
    hint: '024 / 054 / 055 / 059'
  },
  {
    code: 'TELECEL',
    label: 'Telecel Cash (Ghana)',
    shortLabel: 'Telecel Cash',
    hint: '020 / 050'
  },
  {
    code: 'AT',
    label: 'AT Money (AirtelTigo)',
    shortLabel: 'AT Money',
    hint: '026 / 027 / 056 / 057'
  },
  {
    code: 'GHANAPAY',
    label: 'GhanaPay Bank Wallet',
    shortLabel: 'GhanaPay Wallet',
    hint: 'GHP-XXXXXX alias or bank MoMo'
  },
  {
    code: 'GHIPSS_BANK',
    label: 'GhIPSS Instant Bank Pay',
    shortLabel: 'GhIPSS Bank',
    hint: 'GCB · Ecobank · Fidelity · Stanbic'
  }
];

function formatReceiptText(log: TransactionLogRecord, complianceAct?: string): string {
  const lines = [
    '====================================================',
    'NEWS HUB 24+ (newshub24plus.com) — GHANAPAY RECEIPT',
    '====================================================',
    `Receipt Number : ${log.receiptNumber}`,
    `Tx Reference   : ${log.txRef}`,
    `Scope          : ${log.paymentScope === 'third_party' ? 'Third-Party GhanaPay Transfer' : 'Merchant Checkout (News Hub 24+)'}`,
    `Channel / Rail : ${log.network}`,
    `Item / Memo    : ${log.itemName}`,
    `Payer Email    : ${log.payerEmail}`,
    `Payer MoMo     : ${log.payerPhone}`,
    `Recipient      : ${log.recipientName}`,
    `Recipient Acct : ${log.recipientPhone}`,
    `Amount         : GHS ${log.amountGhs.toFixed(2)}`,
    `GhIPSS Fee     : GHS ${log.feeGhs.toFixed(2)}`,
    `Total Paid     : GHS ${log.totalGhs.toFixed(2)}`,
    `Status         : ${log.status.toUpperCase()}`,
    `Settlement     : ${log.settlementMode === 'live_ghanapay_api' ? 'Live GhanaPay GhIPSS API' : 'Verified GhanaPay Treasury Ledger'}`,
    `Note           : ${log.settlementMessage}`,
    `Compliance     : ${complianceAct || 'Bank of Ghana Payment Systems and Services Act, 2019 (Act 987) · GhIPSS Instant Pay'}`,
    `Timestamp      : ${typeof log.createdAt === 'string' ? log.createdAt : new Date().toISOString()}`,
    '===================================================='
  ];
  return lines.join('\n');
}

export function GhanaPayGateway({
  initialPlan,
  billingCycle = 'one-time',
  amountUsd,
  africaFxRates,
  defaultMerchantNumber = '0557711975',
  sponsorDetails,
  compact = false,
  customerKycId,
  onCheckoutSuccess
}: GhanaPayGatewayProps) {
  const fxGhs = africaFxRates?.GHS ?? 15.5;
  const effectiveMerchantNumber = defaultMerchantNumber || '0557711975';

  // Firebase Auth & GhanaPay Wallet Profile State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [ghanaPayProfile, setGhanaPayProfile] = useState<GhanaPayAccountProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [editingWallet, setEditingWallet] = useState<boolean>(false);
  const [walletSaving, setWalletSaving] = useState<boolean>(false);
  const [walletGhanaPayId, setWalletGhanaPayId] = useState<string>('');
  const [walletMomoNumber, setWalletMomoNumber] = useState<string>('');
  const [walletNetwork, setWalletNetwork] = useState<GhanaPayNetwork>('MTN');
  const [walletAccountName, setWalletAccountName] = useState<string>('');

  // Checkout / Third-Party Payment State
  const [paymentScope, setPaymentScope] = useState<'merchant' | 'third_party'>('merchant');
  const [channel, setChannel] = useState<GhanaPayRail>('MTN');
  const [payerName, setPayerName] = useState<string>('');
  const [payerEmail, setPayerEmail] = useState<string>('');
  const [payerPhone, setPayerPhone] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [itemName, setItemName] = useState<string>(
    initialPlan?.name || 'News Hub 24+ Patron & Dispatch Support'
  );
  const [amountGhsInput, setAmountGhsInput] = useState<string>(() => {
    const baseUsd = amountUsd ?? initialPlan?.monthlyPriceUsd ?? 15;
    return Number((baseUsd * fxGhs).toFixed(2)).toFixed(2);
  });

  // Processing & Receipt State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<{
    logEntry: TransactionLogRecord;
    complianceAct?: string;
  } | null>(null);
  const [copiedTxRef, setCopiedTxRef] = useState<string | null>(null);

  // Persistent Transaction Logs State (Firestore + Server Ledger merged)
  const [serverLogs, setServerLogs] = useState<TransactionLogRecord[]>([]);
  const [firestoreLogs, setFirestoreLogs] = useState<TransactionLogRecord[]>([]);
  const [logScopeFilter, setLogScopeFilter] = useState<'all' | 'merchant' | 'third_party'>('all');
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [reversingRef, setReversingRef] = useState<string | null>(null);
  const [logFeedback, setLogFeedback] = useState<string | null>(null);

  // Sync plan amount when parent plan/USD changes
  useEffect(() => {
    if (paymentScope === 'merchant') {
      const targetUsd = amountUsd ?? initialPlan?.monthlyPriceUsd ?? 15;
      setAmountGhsInput(Number((targetUsd * fxGhs).toFixed(2)).toFixed(2));
      setItemName(initialPlan?.name || 'News Hub 24+ GhanaPay Checkout');
    }
  }, [amountUsd, initialPlan?.monthlyPriceUsd, initialPlan?.name, fxGhs, paymentScope]);

  // Listen to Firebase Auth for GhanaPay Login
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setGhanaPayProfile(null);
        setFirestoreLogs([]);
        return;
      }
      void ensureGhanaPayAccount(user)
        .then((profile) => {
          setGhanaPayProfile(profile);
          setWalletGhanaPayId(profile.ghanaPayId);
          setWalletMomoNumber(profile.momoNumber);
          setWalletNetwork(profile.network);
          setWalletAccountName(profile.accountName);
          setPayerName((prev) => prev || profile.accountName);
          setPayerEmail((prev) => prev || profile.email);
          setPayerPhone((prev) => prev || profile.momoNumber);
        })
        .catch((err: unknown) => {
          setAuthError(
            err instanceof Error ? err.message : 'Unable to load GhanaPay wallet profile.'
          );
        });
    });
    return () => unsub();
  }, []);

  // Subscribe to Firestore user transaction logs ONLY when signed in
  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeUserTransactionLogs(firebaseUser.uid, (rows) => {
      setFirestoreLogs(rows);
    });
    return () => unsub();
  }, [firebaseUser]);

  const fetchServerLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/monetization/ghanapay/logs');
      if (res.ok) {
        const data = (await res.json()) as { logs?: TransactionLogRecord[] };
        if (Array.isArray(data.logs)) {
          setServerLogs(data.logs);
        }
      }
    } catch {
      // Keep existing logs silently
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    void fetchServerLogs();
  }, [fetchServerLogs]);

  // Merge Firestore live logs & server audit logs deduplicated by txRef
  const mergedLogs = useMemo(() => {
    const map = new Map<string, TransactionLogRecord>();
    for (const log of serverLogs) {
      map.set(log.txRef, log);
    }
    for (const log of firestoreLogs) {
      map.set(log.txRef, log);
    }
    const list = Array.from(map.values()).sort((a, b) => {
      const ta = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0;
      const tb = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
    if (logScopeFilter === 'all') return list;
    return list.filter((item) => item.paymentScope === logScopeFilter);
  }, [serverLogs, firestoreLogs, logScopeFilter]);

  // Fee & Total calculation (matches GhIPSS / Bank of Ghana Act 987 server calculation)
  const parsedAmountGhs = Math.max(0, Number(amountGhsInput) || 0);
  const estimatedFeeGhs =
    parsedAmountGhs > 0
      ? Number(Math.min(25, Math.max(0.1, parsedAmountGhs * 0.005)).toFixed(2))
      : 0;
  const estimatedTotalGhs = Number((parsedAmountGhs + estimatedFeeGhs).toFixed(2));
  const equivalentUsd = Number((parsedAmountGhs / Math.max(1, fxGhs)).toFixed(2));

  const handleGhanaPaySignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithGhanaPayGoogle();
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'GhanaPay Google sign-in was cancelled or failed.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGhanaPaySignOut = async () => {
    setAuthError(null);
    try {
      await signOutGhanaPay();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Could not sign out of GhanaPay.');
    }
  };

  const handleSaveWalletProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setAuthError(null);
    setWalletSaving(true);
    try {
      const updated = await ensureGhanaPayAccount(firebaseUser, {
        ghanaPayId: walletGhanaPayId.trim(),
        momoNumber: walletMomoNumber.trim(),
        network: walletNetwork,
        accountName: walletAccountName.trim()
      });
      setGhanaPayProfile(updated);
      setPayerName(updated.accountName);
      setPayerPhone(updated.momoNumber);
      setEditingWallet(false);
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'Could not update GhanaPay wallet settings.'
      );
    } finally {
      setWalletSaving(false);
    }
  };

  const handleCopyRef = async (ref: string) => {
    try {
      await navigator.clipboard.writeText(ref);
      setCopiedTxRef(ref);
      window.setTimeout(() => setCopiedTxRef(null), 2000);
    } catch {
      // Ignore clipboard denial
    }
  };

  const handleDownloadReceipt = (log: TransactionLogRecord, complianceAct?: string) => {
    const content = formatReceiptText(log, complianceAct);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${log.receiptNumber || log.txRef}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleProcessGhanaPay = async (e: FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (payerName.trim().length < 2) {
      setCheckoutError('Enter payer full name or organization (2+ chars).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail.trim())) {
      setCheckoutError('Enter a valid email address for your GhanaPay receipt.');
      return;
    }
    if (payerPhone.replace(/[\s()-]/g, '').length < 9) {
      setCheckoutError('Enter a valid 10-digit Ghana Mobile Money phone number (e.g. 0557711975).');
      return;
    }
    if (!Number.isFinite(parsedAmountGhs) || parsedAmountGhs < 1) {
      setCheckoutError('Enter an amount of at least GH₵ 1.00.');
      return;
    }
    if (paymentScope === 'third_party') {
      if (recipientName.trim().length < 2) {
        setCheckoutError('Enter the third-party recipient name (2+ chars).');
        return;
      }
      if (recipientPhone.replace(/[\s()-]/g, '').length < 8) {
        setCheckoutError(
          channel === 'GHIPSS_BANK'
            ? 'Enter the recipient GhIPSS bank account number (8+ digits).'
            : 'Enter the recipient 10-digit MoMo number or GhanaPay Wallet ID.'
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/monetization/ghanapay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUid: firebaseUser?.uid || 'guest',
          payerName: payerName.trim(),
          payerEmail: payerEmail.trim(),
          payerPhone: payerPhone.trim(),
          paymentScope,
          recipientPhone:
            paymentScope === 'merchant' ? effectiveMerchantNumber : recipientPhone.trim(),
          recipientName:
            paymentScope === 'merchant'
              ? `News Hub 24+ (MTN MoMo ${effectiveMerchantNumber})`
              : recipientName.trim(),
          network: channel,
          itemName:
            itemName.trim() ||
            (paymentScope === 'third_party'
              ? `Third-Party GhanaPay Transfer to ${recipientName.trim()}`
              : 'News Hub 24+ GhanaPay Checkout'),
          planId:
            paymentScope === 'merchant'
              ? initialPlan?.id || 'custom-contribution'
              : 'third-party-transfer',
          billingCycle: billingCycle || 'one-time',
          amountGhs: parsedAmountGhs,
          amountUsd: equivalentUsd,
          boostArticleId: paymentScope === 'merchant' ? initialPlan?.boostArticleId : undefined,
          boostTier: paymentScope === 'merchant' ? initialPlan?.boostTier : undefined,
          sponsorDetails: paymentScope === 'merchant' ? sponsorDetails : undefined,
          customerKycId: customerKycId || undefined
        })
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'GhanaPay payment processing failed.');
      }

      const logEntry = payload.logEntry as TransactionLogRecord & { complianceAct?: string };
      if (Array.isArray(payload.logs)) {
        setServerLogs(payload.logs as TransactionLogRecord[]);
      }

      // Persist compliant transaction record in Firestore when signed in via GhanaPay Login
      if (firebaseUser && logEntry) {
        try {
          await persistTransactionLogToFirestore(firebaseUser, {
            txRef: logEntry.txRef,
            receiptNumber: logEntry.receiptNumber,
            payerEmail: logEntry.payerEmail,
            payerPhone: logEntry.payerPhone,
            paymentScope: logEntry.paymentScope,
            recipientPhone: logEntry.recipientPhone,
            recipientName: logEntry.recipientName,
            network: logEntry.network,
            itemName: logEntry.itemName,
            amountGhs: logEntry.amountGhs,
            feeGhs: logEntry.feeGhs,
            totalGhs: logEntry.totalGhs,
            status: logEntry.status,
            settlementMode: logEntry.settlementMode,
            settlementMessage: logEntry.settlementMessage
          });
        } catch {
          // Server audit ledger already stored the transaction cleanly
        }
      }

      setLatestReceipt({
        logEntry,
        complianceAct: logEntry.complianceAct
      });

      if (payload.transaction && payload.summary && onCheckoutSuccess) {
        onCheckoutSuccess({
          transaction: payload.transaction as MonetizationTransaction,
          summary: payload.summary as MonetizationSummary,
          sponsoredCampaigns: payload.sponsoredCampaigns as SponsoredCampaign[] | undefined,
          trendingBoosts: payload.trendingBoosts as TrendingAdBoost[] | undefined,
          message: payload.message as string
        });
      }
    } catch (err: unknown) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Unable to complete GhanaPay transaction.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseLog = async (txRef: string) => {
    setReversingRef(txRef);
    setLogFeedback(null);
    try {
      const res = await fetch(`/api/monetization/ghanapay/logs/${encodeURIComponent(txRef)}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Reversed from GhanaPay Gateway Console' })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not reverse GhanaPay log.');
      }
      if (Array.isArray(payload.logs)) {
        setServerLogs(payload.logs as TransactionLogRecord[]);
      }
      setLogFeedback(payload.message as string);
    } catch (err: unknown) {
      setLogFeedback(err instanceof Error ? err.message : 'Reversal failed.');
    } finally {
      setReversingRef(null);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-lg overflow-hidden ${
        compact ? '' : 'shadow-xs'
      }`}
    >
      {/* Top GhanaPay Banner + Login Bar */}
      <div className="p-4 sm:p-5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono font-semibold text-[#14532D] dark:text-[#4ADE80] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>GHANAPAY &amp; MTN MOMO GATEWAY · BOF ACT 987 COMPLIANT</span>
            </p>
            <h4 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
              GhanaPay Wallet, MTN MoMo ({effectiveMerchantNumber}) &amp; Third-Party Transfers
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {firebaseUser ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditingWallet((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-md hover:opacity-90"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{ghanaPayProfile?.ghanaPayId || 'GhanaPay Account'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleGhanaPaySignOut()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={authLoading}
                onClick={() => void handleGhanaPaySignIn()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] disabled:opacity-60 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{authLoading ? 'Signing In…' : 'GhanaPay Login (Google + Wallet)'}</span>
              </button>
            )}
          </div>
        </div>

        {firebaseUser && ghanaPayProfile && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#44403C] dark:text-[#D6D3CD] pt-1">
            <span>
              Signed in as <strong className="text-[#141413] dark:text-[#F5F3EE]">{ghanaPayProfile.accountName}</strong>{' '}
              ({ghanaPayProfile.email}) · Default MoMo{' '}
              <span className="font-mono font-semibold">{ghanaPayProfile.momoNumber}</span> ({ghanaPayProfile.network})
            </span>
            <button
              type="button"
              onClick={() => setEditingWallet((prev) => !prev)}
              className="font-medium text-[#991B1B] dark:text-[#F87171] hover:underline"
            >
              {editingWallet ? 'Close Wallet Settings' : 'Edit GhanaPay Profile'}
            </button>
          </div>
        )}

        {authError && (
          <p role="alert" className="text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5]">
            {authError}
          </p>
        )}

        {/* Editable GhanaPay Account Profile Drawer */}
        {firebaseUser && editingWallet && (
          <form
            onSubmit={handleSaveWalletProfile}
            className="p-3.5 bg-white dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
          >
            <div>
              <label htmlFor="ghp-prof-name" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                Account Holder Name
              </label>
              <input
                id="ghp-prof-name"
                type="text"
                required
                value={walletAccountName}
                onChange={(e) => setWalletAccountName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
            <div>
              <label htmlFor="ghp-prof-id" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                GhanaPay Wallet Alias
              </label>
              <input
                id="ghp-prof-id"
                type="text"
                required
                value={walletGhanaPayId}
                onChange={(e) => setWalletGhanaPayId(e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
            <div>
              <label htmlFor="ghp-prof-momo" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                Default MoMo Number
              </label>
              <input
                id="ghp-prof-momo"
                type="tel"
                required
                value={walletMomoNumber}
                onChange={(e) => setWalletMomoNumber(e.target.value)}
                placeholder="0557711975"
                className="w-full px-2.5 py-1.5 font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="ghp-prof-net" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                  Network
                </label>
                <select
                  id="ghp-prof-net"
                  value={walletNetwork}
                  onChange={(e) => setWalletNetwork(e.target.value as GhanaPayNetwork)}
                  className="w-full px-2 py-1.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                >
                  <option value="MTN">MTN</option>
                  <option value="TELECEL">TELECEL</option>
                  <option value="AT">AT</option>
                  <option value="GHANAPAY">GHANAPAY</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={walletSaving}
                className="px-3 py-1.5 font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-sm disabled:opacity-60 whitespace-nowrap"
              >
                {walletSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* Payment Scope Switcher */}
        <div
          role="tablist"
          aria-label="GhanaPay payment scope"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-[#F5F2EB] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md"
        >
          <button
            type="button"
            role="tab"
            aria-selected={paymentScope === 'merchant'}
            onClick={() => setPaymentScope('merchant')}
            className={`px-3 py-2 text-xs font-semibold rounded-sm transition-colors flex items-center justify-center gap-1.5 ${
              paymentScope === 'merchant'
                ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs'
                : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
            <span>Merchant Checkout (MTN {effectiveMerchantNumber})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={paymentScope === 'third_party'}
            onClick={() => {
              setPaymentScope('third_party');
              if (!itemName || itemName.includes('Patron') || itemName.includes('Pass')) {
                setItemName('Third-Party Vendor / Bureau Transfer');
              }
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-sm transition-colors flex items-center justify-center gap-1.5 ${
              paymentScope === 'third_party'
                ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs'
                : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
            <span>Third-Party Payment (Send via GhanaPay)</span>
          </button>
        </div>

        {/* Compliant Receipt Banner */}
        {latestReceipt && (
          <div className="p-4 bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-md space-y-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#14532D] dark:text-[#4ADE80] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#14532D] dark:text-[#86EFAC]">
                    Compliant GhanaPay Receipt Issued · {latestReceipt.logEntry.receiptNumber}
                  </p>
                  <p className="text-[#166534] dark:text-[#BBF7D0] mt-0.5">
                    {latestReceipt.logEntry.settlementMessage}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleCopyRef(latestReceipt.logEntry.txRef)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#171715] border border-[#BBF7D0] dark:border-[#166534] rounded-sm font-mono text-[11px] text-[#14532D] dark:text-[#86EFAC]"
                >
                  {copiedTxRef === latestReceipt.logEntry.txRef ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedTxRef === latestReceipt.logEntry.txRef ? 'Copied' : 'Copy Ref'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadReceipt(latestReceipt.logEntry, latestReceipt.complianceAct)
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#14532D] text-white rounded-sm font-medium text-[11px] hover:bg-[#166534]"
                >
                  <Download className="w-3 h-3" />
                  <span>Receipt .txt</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#BBF7D0] dark:border-[#166534] font-mono text-[11px] text-[#14532D] dark:text-[#DCFCE7]">
              <div>
                <span className="block opacity-75">Net Amount</span>
                <strong>GH₵ {latestReceipt.logEntry.amountGhs.toFixed(2)}</strong>
              </div>
              <div>
                <span className="block opacity-75">GhIPSS Fee (0.5%)</span>
                <strong>GH₵ {latestReceipt.logEntry.feeGhs.toFixed(2)}</strong>
              </div>
              <div>
                <span className="block opacity-75">Total Charged</span>
                <strong>GH₵ {latestReceipt.logEntry.totalGhs.toFixed(2)}</strong>
              </div>
              <div>
                <span className="block opacity-75">Destination</span>
                <strong>{latestReceipt.logEntry.recipientPhone}</strong>
              </div>
            </div>
          </div>
        )}

        {/* GhanaPay Payment Form */}
        <form onSubmit={handleProcessGhanaPay} noValidate className="space-y-4">
          {/* Channel Picker */}
          <div>
            <span className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1.5">
              Select GhanaPay / Mobile Money Channel
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CHANNEL_OPTIONS.map((opt) => {
                const active = channel === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setChannel(opt.code)}
                    className={`p-2 text-left rounded-md border transition-colors ${
                      active
                        ? 'bg-[#F0FDF4] dark:bg-[#0E2416] border-[#14532D] dark:border-[#4ADE80]'
                        : 'bg-[#FBF9F5] dark:bg-[#10100F] border-[#E5E2DC] dark:border-[#2C2A26] hover:border-[#A8A29E]'
                    }`}
                  >
                    <span className="block text-[11px] font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                      {opt.shortLabel}
                    </span>
                    <span className="block font-mono text-[10px] text-[#57534E] dark:text-[#A8A29E] truncate">
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ghp-payer-name" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Payer Full Name *
              </label>
              <input
                id="ghp-payer-name"
                type="text"
                required
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Kwame Mensah"
                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>

            <div>
              <label htmlFor="ghp-payer-email" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Receipt Email *
              </label>
              <input
                id="ghp-payer-email"
                type="email"
                required
                value={payerEmail}
                onChange={(e) => setPayerEmail(e.target.value)}
                placeholder="payer@domain.com"
                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>

            <div>
              <label htmlFor="ghp-payer-phone" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Payer MoMo Phone *
              </label>
              <input
                id="ghp-payer-phone"
                type="tel"
                required
                value={payerPhone}
                onChange={(e) => setPayerPhone(e.target.value)}
                placeholder="0244123456"
                className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
          </div>

          {/* Third-Party Recipient Fields vs Merchant Lock */}
          {paymentScope === 'third_party' ? (
            <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ghp-recip-name" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Third-Party Recipient Name *
                </label>
                <input
                  id="ghp-recip-name"
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ama Boateng / Field Correspondent"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#171715] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>
              <div>
                <label htmlFor="ghp-recip-phone" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  {channel === 'GHIPSS_BANK'
                    ? 'Recipient GhIPSS Bank Account *'
                    : 'Recipient MoMo / GhanaPay ID *'}
                </label>
                <input
                  id="ghp-recip-phone"
                  type="text"
                  required
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder={channel === 'GHIPSS_BANK' ? '1011004589210' : '0557711975 or GHP-482910'}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#171715] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>
            </div>
          ) : (
            <div className="px-3.5 py-2.5 bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-md flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#14532D] dark:text-[#86EFAC] font-medium">
                Destination Merchant Account: <strong>News Hub 24+ Official Treasury</strong>
              </span>
              <span className="font-mono font-bold text-[#14532D] dark:text-[#4ADE80]">
                MTN MoMo {effectiveMerchantNumber}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label htmlFor="ghp-item-name" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Payment Narration / Dispatch Item
              </label>
              <input
                id="ghp-item-name"
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Subscription / Ad Placement / Vendor Disbursement"
                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>

            <div>
              <label htmlFor="ghp-amount-ghs" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                Amount (GH₵) · ≈ ${equivalentUsd.toFixed(2)} USD
              </label>
              <input
                id="ghp-amount-ghs"
                type="number"
                min="1"
                step="0.5"
                required
                value={amountGhsInput}
                onChange={(e) => setAmountGhsInput(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
              />
            </div>
          </div>

          {/* Itemized Fee & Submit Row */}
          <div className="p-3 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="font-mono text-[11px] text-[#44403C] dark:text-[#D6D3CD] space-y-0.5 tabular-nums">
              <p>
                Principal: <strong>GH₵ {parsedAmountGhs.toFixed(2)}</strong> · BoG/GhIPSS Fee (0.5%):{' '}
                <strong>GH₵ {estimatedFeeGhs.toFixed(2)}</strong>
              </p>
              <p className="text-[#14532D] dark:text-[#4ADE80] font-semibold">
                Total Debit: GH₵ {estimatedTotalGhs.toFixed(2)} (1 USD = GH₵ {fxGhs.toFixed(2)})
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {submitting
                ? 'Processing via GhanaPay…'
                : paymentScope === 'third_party'
                  ? `Send GH₵ ${estimatedTotalGhs.toFixed(2)} to Third Party`
                  : `Pay GH₵ ${estimatedTotalGhs.toFixed(2)} via GhanaPay / MTN MoMo`}
            </button>
          </div>

          {checkoutError && (
            <p
              role="alert"
              className="text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] px-3 py-2 rounded-md"
            >
              {checkoutError}
            </p>
          )}
        </form>

        {/* Compliant Persistent Transaction Logs */}
        <div className="border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
              <Receipt className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
              <span>
                GhanaPay Compliant Transaction Logs ({mergedLogs.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px]">
              {(['all', 'merchant', 'third_party'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLogScopeFilter(tab)}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${
                    logScopeFilter === tab
                      ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] font-semibold'
                      : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413]'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'merchant' ? 'Merchant' : 'Third-Party'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void fetchServerLogs()}
                aria-label="Refresh GhanaPay logs"
                className="p-1 text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {logFeedback && (
            <p className="px-4 py-2 text-xs font-mono text-[#14532D] dark:text-[#4ADE80] bg-[#F0FDF4] dark:bg-[#0E2416] border-b border-[#BBF7D0] dark:border-[#166534]">
              {logFeedback}
            </p>
          )}

          {mergedLogs.length === 0 ? (
            <div className="p-4 text-xs text-[#57534E] dark:text-[#A8A29E]">
              No GhanaPay transactions recorded yet. Process a merchant MTN MoMo checkout or third-party transfer above to generate a Bank of Ghana Act 987 receipt and audit log.
            </div>
          ) : (
            <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-60 overflow-y-auto">
              {mergedLogs.slice(0, 15).map((log) => (
                <div
                  key={log.txRef}
                  className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-white dark:bg-[#141413]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                        {log.itemName}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-[#F5F2EB] dark:bg-[#242320] text-[#44403C] dark:text-[#D6D3CD]">
                        {log.paymentScope === 'third_party' ? '3RD-PARTY' : 'MERCHANT'} · {log.network}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                      {log.receiptNumber} · {log.payerPhone} → {log.recipientPhone} ({log.recipientName})
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right font-mono tabular-nums">
                      <span
                        className={`block font-bold ${
                          log.status === 'reversed'
                            ? 'line-through text-[#78716C]'
                            : 'text-[#14532D] dark:text-[#4ADE80]'
                        }`}
                      >
                        GH₵ {log.totalGhs.toFixed(2)}
                      </span>
                      <span className="block text-[10px] uppercase text-[#57534E] dark:text-[#A8A29E]">
                        {log.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(log)}
                      title="Download compliant receipt"
                      className="p-1.5 text-[#44403C] dark:text-[#D6D3CD] bg-[#F5F2EB] dark:bg-[#242320] rounded-sm hover:text-[#141413]"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {log.status !== 'reversed' && (
                      <button
                        type="button"
                        disabled={reversingRef === log.txRef}
                        onClick={() => void handleReverseLog(log.txRef)}
                        title="Reverse transaction log"
                        className="p-1.5 text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] rounded-sm disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
