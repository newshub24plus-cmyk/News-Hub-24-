import {
  ArrowRightLeft,
  CheckCircle2,
  Globe2,
  Hash,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  auth,
  syncAirtimeOrderToFirestore,
  syncKycProfileToFirestore,
  syncRemittanceTransferToFirestore,
  syncUssdReceiptToFirestore
} from '../lib/firebase';
import type { AfricaFxRates } from './PaymentModal';

type ContinentKey = 'Africa' | 'Europe' | 'North America' | 'Asia & Middle East';

interface CustomerKycProfile {
  id: string;
  ownerUid: string;
  fullName: string;
  email: string;
  phone: string;
  nationality: string;
  countryOfResidence: string;
  continent: ContinentKey;
  dateOfBirth: string;
  idType: 'national_id' | 'passport' | 'drivers_license' | 'voters_id';
  idNumberMasked: string;
  residentialAddress: string;
  city: string;
  occupation: string;
  sourceOfFunds: 'salary' | 'business_revenue' | 'creator_payouts' | 'remittance_family' | 'savings';
  purposeOfTransaction: string;
  verificationTier: 'basic' | 'standard' | 'enhanced';
  status: 'verified' | 'pending_review';
  dailyLimitUsd: number;
  createdAt: string;
  updatedAt: string;
}

interface CorridorConfig {
  id:
    | 'africa_domestic'
    | 'intra_africa'
    | 'africa_europe'
    | 'africa_north_america'
    | 'africa_asia_mena'
    | 'intercontinental_global';
  label: string;
  description: string;
  percentageFee: number;
  flatFeeUsd: number;
  minFeeUsd: number;
  maxFeeUsd: number;
  fxSpreadPercent: number;
  etaLabel: string;
}

interface RemittanceCountry {
  code: string;
  name: string;
  continent: ContinentKey;
  currency: string;
  currencySymbol: string;
  dialCode: string;
  popularCarriers: string[];
}

interface RemittanceQuote {
  sender: RemittanceCountry;
  recipient: RemittanceCountry;
  corridor: CorridorConfig;
  sendAmountUsd: number;
  sendAmountLocal: number;
  corridorFeeUsd: number;
  fxSpreadUsd: number;
  gatewaySurchargeUsd: number;
  totalFeeUsd: number;
  totalChargedUsd: number;
  effectiveRate: number;
  receiveAmountLocal: number;
  receiveAmountUsdEquivalent: number;
  etaLabel: string;
}

interface RemittanceTransferRecord {
  mtcn: string;
  ownerUid: string;
  customerKycId: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  senderCountry: string;
  senderContinent: ContinentKey;
  senderCurrency: string;
  recipientName: string;
  recipientPhone: string;
  recipientCountry: string;
  recipientContinent: ContinentKey;
  recipientCurrency: string;
  corridorId: CorridorConfig['id'];
  corridorLabel: string;
  payoutMethod: 'mobile_money' | 'bank_deposit' | 'cash_pickup' | 'newshub_wallet' | 'ussd_789';
  paymentRail: string;
  sendAmountUsd: number;
  totalFeeUsd: number;
  totalChargedUsd: number;
  receiveAmountLocal: number;
  pickupCode: string;
  etaLabel: string;
  status: 'Ready for Pickup' | 'In Transit' | 'Collected / Settled' | 'Reversed';
  settlementMode: 'live_gateway' | 'verified_corridor_ledger' | 'ussd_789';
  purpose: string;
  createdAt: string;
}

interface AirtimeCountry {
  countryCode: string;
  countryName: string;
  continent: ContinentKey;
  dialCode: string;
  currency: string;
  currencySymbol: string;
  carriers: string[];
  domesticFeePercent: number;
  internationalFeePercent: number;
}

interface AirtimeQuote {
  country: AirtimeCountry;
  amountUsd: number;
  feePercentApplied: number;
  feeUsd: number;
  totalChargedUsd: number;
  localTopupAmount: number;
}

interface AirtimeOrderRecord {
  id: string;
  buyerName: string;
  buyerEmail: string;
  recipientPhone: string;
  countryCode: string;
  countryName: string;
  continent: ContinentKey;
  carrier: string;
  amountUsd: number;
  feeUsd: number;
  totalChargedUsd: number;
  localCurrency: string;
  localTopupAmount: number;
  paymentRail: string;
  channel: 'web' | 'ussd_789';
  status: 'Delivered' | 'Reversed';
  providerRef: string;
  createdAt: string;
}

interface UssdReceipt {
  id: string;
  shortcode: string;
  msisdn: string;
  service: string;
  amountUsd: number;
  feeUsd: number;
  amountGhs: number;
  reference: string;
  summary: string;
  settlementMode?: 'live_momo_api' | 'live_airtime_api' | 'live_ghanapay_api' | 'verified_treasury_ledger';
  providerChannel?: string;
  verifiedRealFunds?: boolean;
  createdAt: string;
}

interface UssdGatewayStatus {
  shortcode: string;
  liveMode: boolean;
  callbackEndpoint: string;
  mtnMomoConfigured: boolean;
  ghanaPayConfigured: boolean;
  flutterwaveConfigured: boolean;
  reloadlyConfigured: boolean;
  africasTalkingConfigured: boolean;
  webhookConfigured: boolean;
  activeChannels: string[];
  merchantNumber: string;
}

interface GlobalFinancialPlatformSectionProps {
  fxRates?: AfricaFxRates | null;
  onFinancialActivitySettled?: () => void;
}

export function GlobalFinancialPlatformSection({
  fxRates,
  onFinancialActivitySettled
}: GlobalFinancialPlatformSectionProps) {
  const [activeTab, setActiveTab] = useState<'remittance' | 'airtime' | 'ussd' | 'kyc'>('remittance');

  // Shared catalogs & records
  const [kycProfiles, setKycProfiles] = useState<CustomerKycProfile[]>([]);
  const [corridors, setCorridors] = useState<CorridorConfig[]>([]);
  const [remitCountries, setRemitCountries] = useState<RemittanceCountry[]>([]);
  const [transfers, setTransfers] = useState<RemittanceTransferRecord[]>([]);
  const [airtimeCatalog, setAirtimeCatalog] = useState<AirtimeCountry[]>([]);
  const [airtimeOrders, setAirtimeOrders] = useState<AirtimeOrderRecord[]>([]);
  const [ussdReceipts, setUssdReceipts] = useState<UssdReceipt[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  // Tab 1: Western Union-Style Remittance State
  const [selectedKycId, setSelectedKycId] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [senderCountryCode, setSenderCountryCode] = useState<string>('GH');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [recipientCountryCode, setRecipientCountryCode] = useState<string>('GB');
  const [sendAmountUsdInput, setSendAmountUsdInput] = useState<string>('100');
  const [payoutMethod, setPayoutMethod] = useState<
    'mobile_money' | 'bank_deposit' | 'cash_pickup' | 'newshub_wallet' | 'ussd_789'
  >('mobile_money');
  const [remitPaymentRail, setRemitPaymentRail] = useState<string>('ghana-pay');
  const [remitPurpose, setRemitPurpose] = useState<string>('Family support & education');
  const [remitQuote, setRemitQuote] = useState<RemittanceQuote | null>(null);
  const [submittingRemit, setSubmittingRemit] = useState<boolean>(false);
  const [remitFeedback, setRemitFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // MTCN Tracking State
  const [trackMtcnInput, setTrackMtcnInput] = useState<string>('');
  const [trackedTransfer, setTrackedTransfer] = useState<RemittanceTransferRecord | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [pickingUpMtcn, setPickingUpMtcn] = useState<string | null>(null);

  // Tab 2: Universal Airtime State
  const [airtimeCountryCode, setAirtimeCountryCode] = useState<string>('GH');
  const [airtimeBuyerCountryCode, setAirtimeBuyerCountryCode] = useState<string>('GH');
  const [airtimeCarrier, setAirtimeCarrier] = useState<string>('MTN Ghana');
  const [airtimePhone, setAirtimePhone] = useState<string>('+233557711975');
  const [airtimeAmountUsd, setAirtimeAmountUsd] = useState<string>('10');
  const [airtimePaymentRail, setAirtimePaymentRail] = useState<string>('ussd-789');
  const [airtimeBuyerName, setAirtimeBuyerName] = useState<string>('');
  const [airtimeBuyerEmail, setAirtimeBuyerEmail] = useState<string>('');
  const [airtimeQuote, setAirtimeQuote] = useState<AirtimeQuote | null>(null);
  const [submittingAirtime, setSubmittingAirtime] = useState<boolean>(false);
  const [airtimeFeedback, setAirtimeFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Tab 3: *789# USSD Interactive Terminal State
  const [ussdMsisdn, setUssdMsisdn] = useState<string>('+233557711975');
  const [ussdSessionId, setUssdSessionId] = useState<string>('');
  const [ussdScreenType, setUssdScreenType] = useState<'CON' | 'END'>('CON');
  const [ussdDisplayText, setUssdDisplayText] = useState<string>(
    'Dial *789# to open the Universal News Hub 24+ USSD Portal.'
  );
  const [ussdQuickOptions, setUssdQuickOptions] = useState<Array<{ key: string; label: string }>>([
    { key: '*789#', label: 'Dial *789#' },
    { key: '*789*1#', label: '*789*1# Send Money' },
    { key: '*789*2#', label: '*789*2# Airtime' },
    { key: '*789*3#', label: '*789*3# Subs & Ads' },
    { key: '*789*6#', label: '*789*6# Pay 0557711975' },
    { key: '*789*7#', label: '*789*7# Creator Payout' }
  ]);
  const [ussdInput, setUssdInput] = useState<string>('*789#');
  const [dialingUssd, setDialingUssd] = useState<boolean>(false);
  const [ussdGatewayStatus, setUssdGatewayStatus] = useState<UssdGatewayStatus | null>(null);
  const [copiedCallback, setCopiedCallback] = useState<boolean>(false);

  // Tab 4: Customer Background / KYC Onboarding State
  const [kycFullName, setKycFullName] = useState<string>('');
  const [kycEmail, setKycEmail] = useState<string>('');
  const [kycPhone, setKycPhone] = useState<string>('');
  const [kycNationality, setKycNationality] = useState<string>('Ghana');
  const [kycResidence, setKycResidence] = useState<string>('Ghana');
  const [kycContinent, setKycContinent] = useState<ContinentKey>('Africa');
  const [kycDob, setKycDob] = useState<string>('1992-06-15');
  const [kycIdType, setKycIdType] = useState<'national_id' | 'passport' | 'drivers_license' | 'voters_id'>(
    'national_id'
  );
  const [kycIdNumber, setKycIdNumber] = useState<string>('');
  const [kycAddress, setKycAddress] = useState<string>('');
  const [kycCity, setKycCity] = useState<string>('');
  const [kycOccupation, setKycOccupation] = useState<string>('');
  const [kycSourceOfFunds, setKycSourceOfFunds] = useState<
    'salary' | 'business_revenue' | 'creator_payouts' | 'remittance_family' | 'savings'
  >('business_revenue');
  const [kycPurpose, setKycPurpose] = useState<string>(
    'Cross-border family remittance, subscriptions, and airtime'
  );
  const [submittingKyc, setSubmittingKyc] = useState<boolean>(false);
  const [kycFeedback, setKycFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const loadAllPlatformState = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const [kycRes, corrRes, airRes, ussdRes, ussdStatusRes] = await Promise.all([
        fetch('/api/kyc/profiles'),
        fetch('/api/remittance/corridors'),
        fetch('/api/airtime/catalog'),
        fetch('/api/ussd/sessions'),
        fetch('/api/ussd/status')
      ]);

      if (kycRes.ok) {
        const kj = (await kycRes.json()) as { profiles?: CustomerKycProfile[] };
        if (Array.isArray(kj.profiles)) {
          setKycProfiles(kj.profiles);
          if (kj.profiles[0] && !selectedKycId) {
            const first = kj.profiles[0];
            setSelectedKycId(first.id);
            setSenderName((prev) => prev || first.fullName);
            setSenderEmail((prev) => prev || first.email);
            setSenderPhone((prev) => prev || first.phone);
          }
        }
      }

      if (corrRes.ok) {
        const cj = (await corrRes.json()) as {
          corridors?: CorridorConfig[];
          countries?: RemittanceCountry[];
          recentTransfers?: RemittanceTransferRecord[];
        };
        if (Array.isArray(cj.corridors)) setCorridors(cj.corridors);
        if (Array.isArray(cj.countries)) setRemitCountries(cj.countries);
        if (Array.isArray(cj.recentTransfers)) setTransfers(cj.recentTransfers);
      }

      if (airRes.ok) {
        const aj = (await airRes.json()) as {
          countries?: AirtimeCountry[];
          orders?: AirtimeOrderRecord[];
        };
        if (Array.isArray(aj.countries)) setAirtimeCatalog(aj.countries);
        if (Array.isArray(aj.orders)) setAirtimeOrders(aj.orders);
      }

      if (ussdRes.ok) {
        const uj = (await ussdRes.json()) as { receipts?: UssdReceipt[] };
        if (Array.isArray(uj.receipts)) setUssdReceipts(uj.receipts);
      }

      if (ussdStatusRes.ok) {
        const stj = (await ussdStatusRes.json()) as UssdGatewayStatus;
        setUssdGatewayStatus(stj);
      }
    } catch {
      // Initial catalog errors are handled gracefully per tab
    } finally {
      setLoadingInitial(false);
    }
  }, [selectedKycId]);

  useEffect(() => {
    void loadAllPlatformState();
  }, [loadAllPlatformState]);

  // Live Remittance Quote
  useEffect(() => {
    const parsedAmt = Number(sendAmountUsdInput);
    if (!Number.isFinite(parsedAmt) || parsedAmt < 1) return;
    const ctrl = new AbortController();
    fetch('/api/remittance/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        senderCountryCode,
        recipientCountryCode,
        sendAmountUsd: parsedAmt,
        paymentRail: remitPaymentRail
      })
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { quote?: RemittanceQuote } | null) => {
        if (json?.quote) setRemitQuote(json.quote);
      })
      .catch(() => {
        // Ignore abort
      });
    return () => ctrl.abort();
  }, [senderCountryCode, recipientCountryCode, sendAmountUsdInput, remitPaymentRail]);

  // Sync carrier choices when airtime country changes
  const selectedAirtimeCountry = useMemo(
    () => airtimeCatalog.find((c) => c.countryCode === airtimeCountryCode) ?? airtimeCatalog[0] ?? null,
    [airtimeCatalog, airtimeCountryCode]
  );

  useEffect(() => {
    if (selectedAirtimeCountry?.carriers.length) {
      setAirtimeCarrier(selectedAirtimeCountry.carriers[0]);
      if (selectedAirtimeCountry.dialCode !== '+' && !airtimePhone.startsWith(selectedAirtimeCountry.dialCode)) {
        setAirtimePhone(selectedAirtimeCountry.dialCode);
      }
    }
  }, [selectedAirtimeCountry?.countryCode]);

  // Live Airtime Quote
  useEffect(() => {
    const parsedUsd = Number(airtimeAmountUsd);
    if (!Number.isFinite(parsedUsd) || parsedUsd < 1) return;
    const ctrl = new AbortController();
    fetch('/api/airtime/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        countryCode: airtimeCountryCode,
        amountUsd: parsedUsd,
        buyerCountryCode: airtimeBuyerCountryCode,
        paymentRail: airtimePaymentRail
      })
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { quote?: AirtimeQuote } | null) => {
        if (json?.quote) setAirtimeQuote(json.quote);
      })
      .catch(() => {
        // Ignore abort
      });
    return () => ctrl.abort();
  }, [airtimeCountryCode, airtimeAmountUsd, airtimeBuyerCountryCode, airtimePaymentRail]);

  const handleSelectRemitKyc = (id: string) => {
    setSelectedKycId(id);
    const chosen = kycProfiles.find((k) => k.id === id);
    if (chosen) {
      setSenderName(chosen.fullName);
      setSenderEmail(chosen.email);
      setSenderPhone(chosen.phone);
    }
  };

  const handleSubmitRemittance = async (e: FormEvent) => {
    e.preventDefault();
    setRemitFeedback(null);
    const parsedAmt = Number(sendAmountUsdInput);
    if (!Number.isFinite(parsedAmt) || parsedAmt < 1 || parsedAmt > 25000) {
      setRemitFeedback({ type: 'error', text: 'Enter a transfer amount between $1 and $25,000 USD.' });
      return;
    }

    setSubmittingRemit(true);
    try {
      const res = await fetch('/api/remittance/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUid: auth.currentUser?.uid || 'guest',
          customerKycId: selectedKycId || undefined,
          senderName: senderName.trim(),
          senderEmail: senderEmail.trim(),
          senderPhone: senderPhone.trim(),
          senderCountryCode,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          recipientCountryCode,
          sendAmountUsd: parsedAmt,
          payoutMethod,
          paymentRail: remitPaymentRail,
          purpose: remitPurpose.trim()
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not dispatch cross-border remittance.');
      }
      const created = payload.transfer as RemittanceTransferRecord;
      if (Array.isArray(payload.transfers)) {
        setTransfers(payload.transfers as RemittanceTransferRecord[]);
      }
      setTrackMtcnInput(created.mtcn);
      setTrackedTransfer(created);
      setRemitFeedback({ type: 'success', text: payload.message as string });
      onFinancialActivitySettled?.();

      const fbUser = auth.currentUser;
      if (fbUser?.emailVerified) {
        void syncRemittanceTransferToFirestore(fbUser, created).catch(() => {});
      }
    } catch (err: unknown) {
      setRemitFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send global transfer.'
      });
    } finally {
      setSubmittingRemit(false);
    }
  };

  const handleTrackMtcn = async (e: FormEvent) => {
    e.preventDefault();
    setTrackingError(null);
    setTrackedTransfer(null);
    const clean = trackMtcnInput.trim().toUpperCase();
    if (!clean) {
      setTrackingError('Enter an MTCN (e.g. NH24-...) or Pickup Code.');
      return;
    }
    try {
      const res = await fetch(`/api/remittance/track/${encodeURIComponent(clean)}`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'MTCN record not found.');
      }
      setTrackedTransfer(payload.transfer as RemittanceTransferRecord);
    } catch (err: unknown) {
      setTrackingError(err instanceof Error ? err.message : 'Unable to track transfer.');
    }
  };

  const handleConfirmPickup = async (mtcn: string, pickupCode?: string) => {
    setPickingUpMtcn(mtcn);
    setTrackingError(null);
    try {
      const res = await fetch('/api/remittance/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mtcn, pickupCode })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Pickup confirmation failed.');
      const updated = payload.transfer as RemittanceTransferRecord;
      setTrackedTransfer(updated);
      if (Array.isArray(payload.transfers)) {
        setTransfers(payload.transfers as RemittanceTransferRecord[]);
      }
      setRemitFeedback({ type: 'success', text: payload.message as string });
      const fbUser = auth.currentUser;
      if (fbUser?.emailVerified) {
        void syncRemittanceTransferToFirestore(fbUser, updated).catch(() => {});
      }
    } catch (err: unknown) {
      setTrackingError(err instanceof Error ? err.message : 'Could not confirm pickup.');
    } finally {
      setPickingUpMtcn(null);
    }
  };

  const handlePurchaseAirtime = async (e: FormEvent) => {
    e.preventDefault();
    setAirtimeFeedback(null);
    setSubmittingAirtime(true);
    try {
      const res = await fetch('/api/airtime/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUid: auth.currentUser?.uid || 'guest',
          customerKycId: selectedKycId || undefined,
          buyerName: airtimeBuyerName.trim() || senderName.trim() || 'Universal Airtime Buyer',
          buyerEmail: airtimeBuyerEmail.trim() || senderEmail.trim() || 'customer@newshub24plus.com',
          buyerCountryCode: airtimeBuyerCountryCode,
          countryCode: airtimeCountryCode,
          carrier: airtimeCarrier,
          recipientPhone: airtimePhone.trim(),
          amountUsd: Number(airtimeAmountUsd || 5),
          paymentRail: airtimePaymentRail
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Universal airtime purchase failed.');
      const order = payload.order as AirtimeOrderRecord;
      if (Array.isArray(payload.orders)) {
        setAirtimeOrders(payload.orders as AirtimeOrderRecord[]);
      }
      setAirtimeFeedback({ type: 'success', text: payload.message as string });
      onFinancialActivitySettled?.();

      const fbUser = auth.currentUser;
      if (fbUser?.emailVerified && order) {
        void syncAirtimeOrderToFirestore(fbUser, order).catch(() => {});
      }
    } catch (err: unknown) {
      setAirtimeFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send global airtime.'
      });
    } finally {
      setSubmittingAirtime(false);
    }
  };

  const sendUssdCommand = async (rawCmd: string, resetSession = false) => {
    setDialingUssd(true);
    try {
      const res = await fetch('/api/ussd/789', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: resetSession ? undefined : ussdSessionId || undefined,
          msisdn: ussdMsisdn.trim() || '+233557711975',
          input: rawCmd.trim(),
          reset: resetSession
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'USSD session failed.');

      if (payload.session?.id) {
        setUssdSessionId(payload.session.id as string);
      }
      setUssdScreenType(payload.screenType === 'END' ? 'END' : 'CON');
      setUssdDisplayText(String(payload.displayText || ''));
      setUssdQuickOptions(Array.isArray(payload.quickOptions) ? payload.quickOptions : []);
      setUssdInput('');

      if (payload.screenType === 'END') {
        onFinancialActivitySettled?.();
        const sessRes = await fetch('/api/ussd/sessions');
        if (sessRes.ok) {
          const sj = (await sessRes.json()) as { receipts?: UssdReceipt[] };
          if (Array.isArray(sj.receipts)) {
            setUssdReceipts(sj.receipts);
            const fbUser = auth.currentUser;
            if (fbUser?.emailVerified && sj.receipts[0]) {
              void syncUssdReceiptToFirestore(fbUser, sj.receipts[0]).catch(() => {});
            }
          }
        }
        // Also refresh transfers & airtime in case USSD dispatched one
        void loadAllPlatformState();
      }
    } catch (err: unknown) {
      setUssdDisplayText(err instanceof Error ? err.message : 'USSD gateway timeout.');
      setUssdScreenType('END');
    } finally {
      setDialingUssd(false);
    }
  };

  const handleSubmitKyc = async (e: FormEvent) => {
    e.preventDefault();
    setKycFeedback(null);
    setSubmittingKyc(true);
    try {
      const res = await fetch('/api/kyc/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUid: auth.currentUser?.uid || 'guest',
          fullName: kycFullName.trim(),
          email: kycEmail.trim(),
          phone: kycPhone.trim(),
          nationality: kycNationality.trim(),
          countryOfResidence: kycResidence.trim(),
          continent: kycContinent,
          dateOfBirth: kycDob,
          idType: kycIdType,
          idNumber: kycIdNumber.trim(),
          residentialAddress: kycAddress.trim(),
          city: kycCity.trim(),
          occupation: kycOccupation.trim(),
          sourceOfFunds: kycSourceOfFunds,
          purposeOfTransaction: kycPurpose.trim()
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'KYC profile submission failed.');
      const created = payload.profile as CustomerKycProfile;
      if (Array.isArray(payload.profiles)) {
        setKycProfiles(payload.profiles as CustomerKycProfile[]);
      }
      setSelectedKycId(created.id);
      setSenderName(created.fullName);
      setSenderEmail(created.email);
      setSenderPhone(created.phone);
      setKycFeedback({ type: 'success', text: payload.message as string });
      setKycIdNumber('');

      const fbUser = auth.currentUser;
      if (fbUser?.emailVerified) {
        void syncKycProfileToFirestore(fbUser, created).catch(() => {});
      }
    } catch (err: unknown) {
      setKycFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save KYC background verification.'
      });
    } finally {
      setSubmittingKyc(false);
    }
  };

  const liveGhsRate = fxRates?.GHS ?? 15.5;

  return (
    <section
      id="global-transfers"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-[#FBF9F5] dark:bg-[#10100F]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-10">
        {/* Editorial-Fintech Section Heading */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1.5 flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5" />
              <span>Western Union Global Corridors · Universal Airtime · *789# Shortcode · Customer KYC</span>
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
              Global Remittance, Universal Airtime, *789# &amp; Customer KYC Hub
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Verify customer background identity once, send money between African countries and Europe, North America, Asia, or the Middle East with transparent corridor fees, purchase airtime for any network worldwide, or transact instantly on shortcode <strong className="font-mono text-[#141413] dark:text-[#F5F3EE]">*789#</strong>.
            </p>
          </div>

          {/* 4-Tab Switcher */}
          <div
            role="tablist"
            aria-label="Global financial services"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F5F2EB] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'remittance'}
              onClick={() => setActiveTab('remittance')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'remittance'
                  ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                  : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Global Remittance (WU)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'airtime'}
              onClick={() => setActiveTab('airtime')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'airtime'
                  ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                  : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Universal Airtime</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ussd'}
              onClick={() => setActiveTab('ussd')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'ussd'
                  ? 'bg-white dark:bg-[#242320] text-[#14532D] dark:text-[#4ADE80] shadow-xs font-semibold'
                  : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>*789# Shortcode</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'kyc'}
              onClick={() => setActiveTab('kyc')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'kyc'
                  ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                  : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Customer KYC ({kycProfiles.length})</span>
            </button>
          </div>
        </div>

        {/* 4-Column Operations Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pb-8 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Verified Customer Profiles</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              {kycProfiles.length}
            </p>
            <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-0.5">
              Background KYC Required &gt; $500
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Cross-Continent Corridors</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {corridors.length || 6} Active
            </p>
            <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] tabular-nums mt-0.5">
              {transfers.length} MTCN transfers · 1 USD = GH₵ {liveGhsRate.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Universal Airtime Orders</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {airtimeOrders.length}
            </p>
            <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-0.5">
              {airtimeCatalog.length || 14} carrier hubs + E.164 global
            </p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">*789# Shortcode Receipts</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              {ussdReceipts.length}
            </p>
            <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-0.5">
              0.75% USSD Rail · Merchant 0557711975
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: WESTERN UNION GLOBAL REMITTANCE (AFRICA <-> CONTINENTS) */}
        {/* ============================================================ */}
        {activeTab === 'remittance' && (
          <div className="space-y-8" role="tabpanel" aria-label="Western Union Global Remittance">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 7 cols: Send Money Form */}
              <form
                onSubmit={handleSubmitRemittance}
                noValidate
                className="lg:col-span-7 p-6 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-lg space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                      Send Money Worldwide (Africa ↔ Continents)
                    </h3>
                    <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                      Instant MTCN generation with distinct corridor fees between African nations and global hubs.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kyc')}
                    className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] hover:underline whitespace-nowrap"
                  >
                    + New Customer KYC
                  </button>
                </div>

                {/* KYC Selector */}
                <div>
                  <label htmlFor="remit-kyc" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Verified Customer Background / KYC Profile (Mandatory above $500 USD)
                  </label>
                  <select
                    id="remit-kyc"
                    value={selectedKycId}
                    onChange={(e) => handleSelectRemitKyc(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    <option value="">Guest Sender ($500 USD limit without KYC)</option>
                    {kycProfiles.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.fullName} — {k.countryOfResidence} ({k.continent}) · {k.verificationTier.toUpperCase()} (${k.dailyLimitUsd.toLocaleString()}/day · {k.idNumberMasked})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Corridor Country Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="remit-from-country" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Sending Country / Continent
                    </label>
                    <select
                      id="remit-from-country"
                      value={senderCountryCode}
                      onChange={(e) => setSenderCountryCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      {remitCountries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.continent} · {c.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="remit-to-country" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Destination Country / Continent
                    </label>
                    <select
                      id="remit-to-country"
                      value={recipientCountryCode}
                      onChange={(e) => setRecipientCountryCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      {remitCountries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.continent} · {c.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sender Contact Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="remit-sender-name" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Sender Full Name *
                    </label>
                    <input
                      id="remit-sender-name"
                      type="text"
                      required
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Kwame Mensah"
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <div>
                    <label htmlFor="remit-sender-email" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Sender Email *
                    </label>
                    <input
                      id="remit-sender-email"
                      type="email"
                      required
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="sender@domain.com"
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <div>
                    <label htmlFor="remit-sender-phone" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Sender Phone *
                    </label>
                    <input
                      id="remit-sender-phone"
                      type="tel"
                      required
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="+233557711975"
                      className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="remit-rec-name" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Recipient Full Legal Name *
                    </label>
                    <input
                      id="remit-rec-name"
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Amina Bello / Samuel Osei"
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <div>
                    <label htmlFor="remit-rec-phone" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Recipient Mobile / Account *
                    </label>
                    <input
                      id="remit-rec-phone"
                      type="tel"
                      required
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="+447911123456 or +234803..."
                      className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                </div>

                {/* Amount + Payout Delivery + Funding Rail */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="remit-amount-usd" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Send Amount (USD)
                    </label>
                    <input
                      id="remit-amount-usd"
                      type="number"
                      min="1"
                      max="25000"
                      step="1"
                      value={sendAmountUsdInput}
                      onChange={(e) => setSendAmountUsdInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono font-bold bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <div>
                    <label htmlFor="remit-payout-method" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Recipient Payout Delivery
                    </label>
                    <select
                      id="remit-payout-method"
                      value={payoutMethod}
                      onChange={(e) =>
                        setPayoutMethod(
                          e.target.value as
                            | 'mobile_money'
                            | 'bank_deposit'
                            | 'cash_pickup'
                            | 'newshub_wallet'
                            | 'ussd_789'
                        )
                      }
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      <option value="mobile_money">Mobile Money Wallet</option>
                      <option value="bank_deposit">Direct Bank Deposit</option>
                      <option value="cash_pickup">Western Union-Style Cash Pickup (MTCN)</option>
                      <option value="newshub_wallet">News Hub 24+ App Wallet</option>
                      <option value="ussd_789">*789# Shortcode Claim</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="remit-funding-rail" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Funding Payment Rail
                    </label>
                    <select
                      id="remit-funding-rail"
                      value={remitPaymentRail}
                      onChange={(e) => setRemitPaymentRail(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      <option value="ghana-pay">GhanaPay / MTN MoMo (0.5%)</option>
                      <option value="ussd-789">*789# Universal Shortcode (0.75%)</option>
                      <option value="bank-wire">Bank Wire / ACH / SEPA (0.8%)</option>
                      <option value="flutterwave-africa">Flutterwave Africa / Cards</option>
                      <option value="card">Visa / Mastercard</option>
                      <option value="newshub-app-wallet">App Wallet ($0 Surcharge)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="remit-purpose" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Transfer Purpose (Compliance Declaration)
                  </label>
                  <input
                    id="remit-purpose"
                    type="text"
                    value={remitPurpose}
                    onChange={(e) => setRemitPurpose(e.target.value)}
                    placeholder="Family support, supplier invoice, media creator payout"
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>

                {remitFeedback && (
                  <p
                    role="status"
                    className={`text-xs font-medium px-3.5 py-2.5 rounded-md border ${
                      remitFeedback.type === 'success'
                        ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                        : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                    }`}
                  >
                    {remitFeedback.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submittingRemit}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-60 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {submittingRemit
                      ? 'Generating MTCN & Settling Corridor…'
                      : remitQuote
                        ? `Dispatch ${remitQuote.sender.code} → ${remitQuote.recipient.code} Transfer (Total $${remitQuote.totalChargedUsd.toFixed(2)} USD)`
                        : 'Dispatch Global Transfer'}
                  </span>
                </button>
              </form>

              {/* Right 5 cols: Live Corridor Fee Quote + Distinct Corridor Matrix */}
              <div className="lg:col-span-5 space-y-6">
                {remitQuote && (
                  <div className="p-5 bg-white dark:bg-[#171715] border border-[#BBF7D0] dark:border-[#166534] rounded-lg space-y-4">
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                      <div>
                        <p className="text-[11px] font-mono font-semibold text-[#14532D] dark:text-[#4ADE80]">
                          LIVE CORRIDOR QUOTE · {remitQuote.corridor.label.toUpperCase()}
                        </p>
                        <h4 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                          {remitQuote.sender.name} → {remitQuote.recipient.name}
                        </h4>
                      </div>
                      <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E]">
                        {remitQuote.etaLabel}
                      </span>
                    </div>

                    <dl className="space-y-2 text-xs font-mono tabular-nums">
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#57534E] dark:text-[#A8A29E]">Principal Amount</dt>
                        <dd className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          ${remitQuote.sendAmountUsd.toFixed(2)} USD ({remitQuote.sender.currency} {remitQuote.sendAmountLocal.toLocaleString()})
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#57534E] dark:text-[#A8A29E]">
                          Corridor Fee ({remitQuote.corridor.percentageFee}% + ${remitQuote.corridor.flatFeeUsd.toFixed(2)})
                        </dt>
                        <dd className="text-[#141413] dark:text-[#F5F3EE]">
                          ${remitQuote.corridorFeeUsd.toFixed(2)} USD
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#57534E] dark:text-[#A8A29E]">
                          FX Spread ({remitQuote.corridor.fxSpreadPercent}%) + Rail Fee
                        </dt>
                        <dd className="text-[#141413] dark:text-[#F5F3EE]">
                          ${(remitQuote.fxSpreadUsd + remitQuote.gatewaySurchargeUsd).toFixed(2)} USD
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                        <dt className="font-semibold text-[#141413] dark:text-[#F5F3EE]">Total Charged</dt>
                        <dd className="font-bold text-[#991B1B] dark:text-[#F87171]">
                          ${remitQuote.totalChargedUsd.toFixed(2)} USD (Fees ${remitQuote.totalFeeUsd.toFixed(2)})
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                        <dt className="font-semibold text-[#14532D] dark:text-[#4ADE80]">Recipient Receives</dt>
                        <dd className="text-base font-bold text-[#14532D] dark:text-[#4ADE80]">
                          {remitQuote.recipient.currency} {remitQuote.receiveAmountLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}

                {/* Distinct Corridor Fee Comparison Schedule */}
                <div className="bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Distinct Africa ↔ Continents Corridor Fee Schedule
                  </div>
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] text-xs">
                    {corridors.map((c) => (
                      <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                            {c.label}
                          </p>
                          <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                            {c.etaLabel} · FX spread {c.fxSpreadPercent}%
                          </p>
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80] whitespace-nowrap shrink-0">
                          {c.percentageFee}% + ${c.flatFeeUsd.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* MTCN Tracker & Recent Global Remittances */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 p-5 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg space-y-4">
                <h4 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Track MTCN &amp; Collect Cash / Payout
                </h4>
                <form onSubmit={handleTrackMtcn} className="flex gap-2">
                  <input
                    type="text"
                    aria-label="Track Money Transfer Control Number (MTCN)"
                    value={trackMtcnInput}
                    onChange={(e) => setTrackMtcnInput(e.target.value)}
                    placeholder="Enter MTCN (e.g. NH24-...)"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm text-[#141413] dark:text-[#F5F3EE]"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-sm"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Track</span>
                  </button>
                </form>

                {trackingError && (
                  <p className="text-xs text-[#991B1B] dark:text-[#FCA5A5]">{trackingError}</p>
                )}

                {trackedTransfer && (
                  <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[#141413] dark:text-[#F5F3EE]">
                        {trackedTransfer.mtcn}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          trackedTransfer.status === 'Collected / Settled'
                            ? 'text-[#14532D] dark:text-[#4ADE80]'
                            : 'text-[#92400E] dark:text-[#FBBF24]'
                        }`}
                      >
                        {trackedTransfer.status}
                      </span>
                    </div>
                    <p className="text-[#44403C] dark:text-[#D6D3CD]">
                      {trackedTransfer.senderName} ({trackedTransfer.senderCountry}) →{' '}
                      <strong>{trackedTransfer.recipientName}</strong> ({trackedTransfer.recipientCountry})
                    </p>
                    <p className="font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80]">
                      Payout: {trackedTransfer.recipientCurrency}{' '}
                      {trackedTransfer.receiveAmountLocal.toLocaleString()} · Pickup Code:{' '}
                      {trackedTransfer.pickupCode}
                    </p>
                    {trackedTransfer.status !== 'Collected / Settled' && (
                      <button
                        type="button"
                        disabled={pickingUpMtcn === trackedTransfer.mtcn}
                        onClick={() =>
                          void handleConfirmPickup(trackedTransfer.mtcn, trackedTransfer.pickupCode)
                        }
                        className="mt-1 px-3 py-1.5 text-[11px] font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-sm disabled:opacity-50"
                      >
                        {pickingUpMtcn === trackedTransfer.mtcn
                          ? 'Settling Pickup…'
                          : 'Confirm Cash Pickup / Settlement'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Recent Global MTCN Remittances
                  </span>
                  <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                    {transfers.length} logged
                  </span>
                </div>
                {transfers.length === 0 ? (
                  <p className="p-6 text-xs text-[#57534E] dark:text-[#A8A29E]">
                    No remittance dispatches yet. Send your first intra-Africa or cross-continent transfer above.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-72 overflow-y-auto">
                    {transfers.map((t) => (
                      <div key={t.mtcn} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE]">
                            {t.mtcn} · {t.senderCountry} → {t.recipientCountry}
                          </p>
                          <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                            {t.recipientName} ({t.recipientPhone}) · {t.corridorLabel} · Fee ${t.totalFeeUsd.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right font-mono tabular-nums shrink-0">
                          <p className="font-bold text-[#14532D] dark:text-[#4ADE80]">
                            {t.recipientCurrency} {t.receiveAmountLocal.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">{t.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: UNIVERSAL GLOBAL AIRTIME PURCHASE (ANY COUNTRY)       */}
        {/* ============================================================ */}
        {activeTab === 'airtime' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" role="tabpanel" aria-label="Universal Global Airtime">
            <form
              onSubmit={handlePurchaseAirtime}
              noValidate
              className="lg:col-span-6 p-6 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-lg space-y-4"
            >
              <div className="pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Buy Airtime for Any Country Worldwide
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Supports domestic local SIMs, Pan-African carriers, UK, Europe, North America, Asia, Middle East, or any E.164 phone worldwide.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="air-dest-country" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Recipient Mobile Country
                  </label>
                  <select
                    id="air-dest-country"
                    value={airtimeCountryCode}
                    onChange={(e) => setAirtimeCountryCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    {airtimeCatalog.map((c) => (
                      <option key={c.countryCode} value={c.countryCode}>
                        {c.countryName} ({c.dialCode} · {c.currency}) — {c.continent}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="air-carrier" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Telecom Carrier / Operator
                  </label>
                  <select
                    id="air-carrier"
                    value={airtimeCarrier}
                    onChange={(e) => setAirtimeCarrier(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    {(selectedAirtimeCountry?.carriers ?? ['Global Telecom Roaming']).map((car) => (
                      <option key={car} value={car}>
                        {car}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="air-phone" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Recipient International Phone Number *
                  </label>
                  <input
                    id="air-phone"
                    type="tel"
                    required
                    value={airtimePhone}
                    onChange={(e) => setAirtimePhone(e.target.value)}
                    placeholder="+233557711975 / +447... / +1415..."
                    className="w-full px-3 py-2 text-sm font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label htmlFor="air-buyer-country" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Your Origin Country (Domestic vs Cross-Border Fee)
                  </label>
                  <select
                    id="air-buyer-country"
                    value={airtimeBuyerCountryCode}
                    onChange={(e) => setAirtimeBuyerCountryCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    {airtimeCatalog.map((c) => (
                      <option key={c.countryCode} value={c.countryCode}>
                        Buying from {c.countryName} ({c.continent})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="air-usd" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Top-Up Value (USD)
                  </label>
                  <div className="flex items-center gap-1.5 mb-2">
                    {['2', '5', '10', '25', '50'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAirtimeAmountUsd(amt)}
                        className={`px-2.5 py-1 text-xs font-mono rounded-sm border ${
                          airtimeAmountUsd === amt
                            ? 'bg-[#141413] dark:bg-[#F5F3EE] text-white dark:text-[#141413] border-[#141413]'
                            : 'bg-[#FBF9F5] dark:bg-[#10100F] border-[#D6D1C7] dark:border-[#3A3732]'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                  <input
                    id="air-usd"
                    type="number"
                    min="1"
                    max="300"
                    step="1"
                    value={airtimeAmountUsd}
                    onChange={(e) => setAirtimeAmountUsd(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>

                <div>
                  <label htmlFor="air-rail" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Payment Method
                  </label>
                  <select
                    id="air-rail"
                    value={airtimePaymentRail}
                    onChange={(e) => setAirtimePaymentRail(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    <option value="ussd-789">*789# Universal Shortcode (0.75% Fee)</option>
                    <option value="ghana-pay">GhanaPay / MTN MoMo (0.5% Fee)</option>
                    <option value="newshub-app-wallet">News Hub 24+ App Wallet ($0 Fee)</option>
                    <option value="flutterwave-africa">Flutterwave Africa / Verve / M-Pesa</option>
                    <option value="card">International Visa / Mastercard</option>
                    <option value="bank-wire">Bank Wire / Instant Transfer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="air-buyer-name" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Buyer Name
                  </label>
                  <input
                    id="air-buyer-name"
                    type="text"
                    value={airtimeBuyerName}
                    onChange={(e) => setAirtimeBuyerName(e.target.value)}
                    placeholder="Kwame Mensah"
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label htmlFor="air-buyer-email" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Receipt Email
                  </label>
                  <input
                    id="air-buyer-email"
                    type="email"
                    value={airtimeBuyerEmail}
                    onChange={(e) => setAirtimeBuyerEmail(e.target.value)}
                    placeholder="receipt@domain.com"
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
              </div>

              {airtimeQuote && (
                <div className="p-3.5 bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-md text-xs font-mono space-y-1 tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-[#166534] dark:text-[#BBF7D0]">Local Airtime Credit:</span>
                    <strong className="text-[#14532D] dark:text-[#4ADE80]">
                      {airtimeQuote.country.currency} {airtimeQuote.localTopupAmount.toFixed(2)} ({airtimeQuote.country.countryName})
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#166534] dark:text-[#BBF7D0]">
                      Service Fee ({airtimeQuote.feePercentApplied}%):
                    </span>
                    <span className="text-[#14532D] dark:text-[#86EFAC]">${airtimeQuote.feeUsd.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#BBF7D0] dark:border-[#166534]">
                    <span className="font-semibold text-[#14532D] dark:text-[#4ADE80]">Total Charged:</span>
                    <strong className="text-[#14532D] dark:text-[#4ADE80]">
                      ${airtimeQuote.totalChargedUsd.toFixed(2)} USD
                    </strong>
                  </div>
                </div>
              )}

              {airtimeFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium px-3.5 py-2.5 rounded-md border ${
                    airtimeFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  {airtimeFeedback.text}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingAirtime}
                className="w-full px-5 py-3 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-60 transition-colors"
              >
                {submittingAirtime ? 'Delivering Global Airtime…' : 'Send Instant Universal Airtime'}
              </button>
            </form>

            {/* Right 6 cols: Universal Airtime Orders */}
            <div className="lg:col-span-6 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
                <span className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Delivered Universal Airtime Orders
                </span>
                <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                  {airtimeOrders.length} orders
                </span>
              </div>

              {airtimeOrders.length === 0 ? (
                <p className="p-6 text-xs text-[#57534E] dark:text-[#A8A29E]">
                  No airtime top-ups dispatched yet. Purchase local or international airtime for any mobile phone on the left.
                </p>
              ) : (
                <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-[30rem] overflow-y-auto">
                  {airtimeOrders.map((ord) => (
                    <div key={ord.id} className="p-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                          {ord.recipientPhone} · {ord.carrier} ({ord.countryName})
                        </p>
                        <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          {ord.providerRef} · {ord.channel === 'ussd_789' ? '*789# USSD' : ord.paymentRail} · Fee ${ord.feeUsd.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <p className="font-bold text-[#14532D] dark:text-[#4ADE80]">
                          {ord.localCurrency} {ord.localTopupAmount.toFixed(2)}
                        </p>
                        <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          ${ord.totalChargedUsd.toFixed(2)} USD · {ord.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: *789# UNIVERSAL SHORTCODE INTERACTIVE USSD TERMINAL   */}
        {/* ============================================================ */}
        {activeTab === 'ussd' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" role="tabpanel" aria-label="Universal *789# USSD Portal">
            {/* Left 6 cols: Interactive Handset USSD Dialer */}
            <div className="lg:col-span-6 p-6 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-lg space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                    Universal *789# USSD Service Dialer
                  </h3>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                    Access Remittance (*789*1#), Airtime (*789*2#), Subscriptions &amp; Ads (*789*3#), KYC (*789*4#), Track MTCN (*789*5#), or Merchant 0557711975 (*789*6#).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void sendUssdCommand('*789#', true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-sm shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${dialingUssd ? 'animate-spin' : ''}`} />
                  <span>Dial *789#</span>
                </button>
              </div>

              <div>
                <label htmlFor="ussd-caller-msisdn" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Subscriber Mobile Number (MSISDN)
                </label>
                <input
                  id="ussd-caller-msisdn"
                  type="tel"
                  value={ussdMsisdn}
                  onChange={(e) => setUssdMsisdn(e.target.value)}
                  placeholder="+233557711975"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              {/* Authentic USSD Session Display */}
              <div className="p-5 bg-[#141413] text-[#F5F3EE] border border-[#2C2A26] rounded-md space-y-4">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#A8A29E] border-b border-[#2C2A26] pb-2">
                  <span>CARRIER GATEWAY: *789# ({ussdMsisdn})</span>
                  <span className={ussdScreenType === 'CON' ? 'text-[#4ADE80]' : 'text-[#FBBF24]'}>
                    {ussdScreenType}
                  </span>
                </div>

                <pre className="font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed text-[#F5F3EE] min-h-[150px]">
                  {ussdDisplayText}
                </pre>

                {ussdQuickOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#2C2A26]">
                    {ussdQuickOptions.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={dialingUssd}
                        onClick={() =>
                          void sendUssdCommand(
                            opt.key,
                            opt.key.startsWith('*789')
                          )
                        }
                        className="px-2.5 py-1 text-[11px] font-mono bg-[#242320] hover:bg-[#3A3732] text-[#F5F3EE] border border-[#3A3732] rounded-sm disabled:opacity-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!ussdInput.trim()) return;
                    void sendUssdCommand(ussdInput, ussdInput.trim().startsWith('*789'));
                  }}
                  className="flex gap-2 pt-2 border-t border-[#2C2A26]"
                >
                  <input
                    type="text"
                    aria-label="USSD reply input"
                    value={ussdInput}
                    onChange={(e) => setUssdInput(e.target.value)}
                    placeholder="Type menu option (1..6, MTCN, phone) or *789#…"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-[#1C1B19] border border-[#3A3732] rounded-sm text-white placeholder:text-[#78716C]"
                  />
                  <button
                    type="submit"
                    disabled={dialingUssd}
                    className="px-4 py-2 text-xs font-semibold text-[#141413] bg-[#F5F3EE] hover:bg-[#E5E2DC] rounded-sm disabled:opacity-50"
                  >
                    {dialingUssd ? 'Sending…' : 'Send USSD'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right 6 cols: Direct Shortcodes Directory & *789# Receipts */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Direct *789# Universal Shortcode Directory (1-Tap Dial)
                </div>
                <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] text-xs">
                  {[
                    { code: '*789#', desc: 'Open Main Universal Services Menu' },
                    { code: '*789*1#', desc: 'Western Union Africa ↔ Continents Remittance' },
                    { code: '*789*2#', desc: 'Universal Global Airtime Top-Up (Any Country)' },
                    { code: '*789*3#', desc: 'Activate Subscriptions & Commercial Ad Boosts' },
                    { code: '*789*4#', desc: 'Check Customer KYC Limit & Creator Balance' },
                    { code: '*789*5#', desc: 'Track MTCN Remittance or Withdrawal Reference' },
                    { code: '*789*6#', desc: 'Pay News Hub 24+ Merchant (0557711975) / 3rd-Party' },
                    { code: '*789*7#', desc: 'Instant Creator Payout to Primary MoMo / Wallet' }
                  ].map((item) => (
                    <div key={item.code} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-[#991B1B] dark:text-[#F87171]">
                          {item.code}
                        </span>
                        <span className="ml-2 text-[#44403C] dark:text-[#D6D3CD]">{item.desc}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void sendUssdCommand(item.code, true)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm hover:border-[#141413] shrink-0"
                      >
                        Run
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Telecom Carrier & Gateway Readiness Strip */}
              <div className="p-4 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Live *789# Carrier &amp; Telecom Gateway Readiness
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
                    {ussdGatewayStatus?.liveMode ? 'LIVE CARRIER API ACTIVE' : 'CARRIER WEBHOOK & TREASURY READY'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                  {[
                    { label: 'MTN MoMo', ok: ussdGatewayStatus?.mtnMomoConfigured },
                    { label: 'GhanaPay', ok: ussdGatewayStatus?.ghanaPayConfigured },
                    { label: 'Flutterwave', ok: ussdGatewayStatus?.flutterwaveConfigured },
                    { label: 'Reloadly', ok: ussdGatewayStatus?.reloadlyConfigured },
                    { label: "Africa's Talking", ok: ussdGatewayStatus?.africasTalkingConfigured }
                  ].map((rail) => (
                    <span
                      key={rail.label}
                      className={`px-2 py-0.5 rounded border ${
                        rail.ok
                          ? 'bg-[#F0FDF4] dark:bg-[#0E2416] text-[#14532D] dark:text-[#4ADE80] border-[#BBF7D0] dark:border-[#166534]'
                          : 'bg-[#F5F2EB] dark:bg-[#1C1B19] text-[#57534E] dark:text-[#A8A29E] border-[#E5E2DC] dark:border-[#2C2A26]'
                      }`}
                    >
                      {rail.label}: {rail.ok ? 'LIVE' : 'Treasury Ready'}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                  <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                    Telecom Callback: {typeof window !== 'undefined' ? window.location.origin : ''}/api/ussd/789/callback
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/ussd/789/callback`;
                      void navigator.clipboard.writeText(url).then(() => {
                        setCopiedCallback(true);
                        window.setTimeout(() => setCopiedCallback(false), 1800);
                      });
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm shrink-0"
                  >
                    {copiedCallback ? 'Copied' : 'Copy Webhook'}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    *789# Settled USSD Receipts
                  </span>
                  <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                    {ussdReceipts.length} receipts
                  </span>
                </div>
                {ussdReceipts.length === 0 ? (
                  <p className="p-6 text-xs text-[#57534E] dark:text-[#A8A29E]">
                    No *789# transactions executed yet. Dial any shortcode on the left to test and record an instant receipt.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-64 overflow-y-auto">
                    {ussdReceipts.map((r) => (
                      <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                            {r.service} · {r.msisdn}
                          </p>
                          <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                            {r.id} · {r.providerChannel ?? (r.verifiedRealFunds ? 'Live Carrier API' : 'Verified Treasury Rail')} · {r.summary}
                          </p>
                        </div>
                        <div className="text-right font-mono tabular-nums shrink-0">
                          <p className="font-bold text-[#14532D] dark:text-[#4ADE80]">
                            ${r.amountUsd.toFixed(2)} (GH₵ {r.amountGhs.toFixed(2)})
                          </p>
                          <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                            Fee ${r.feeUsd.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: CUSTOMER BACKGROUND / KYC PLATFORM                    */}
        {/* ============================================================ */}
        {activeTab === 'kyc' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" role="tabpanel" aria-label="Customer Background KYC">
            <form
              onSubmit={handleSubmitKyc}
              noValidate
              className="lg:col-span-7 p-6 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-lg space-y-4"
            >
              <div className="pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Customer Background &amp; Compliance Onboarding (KYC)
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Required for transfers above $500 USD, intercontinental payouts, and higher daily settlement limits. Government ID numbers are masked automatically before storage.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="kyc-fullname" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Full Legal Name *
                  </label>
                  <input
                    id="kyc-fullname"
                    type="text"
                    required
                    value={kycFullName}
                    onChange={(e) => setKycFullName(e.target.value)}
                    placeholder="Ama Serwaa Mensah"
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label htmlFor="kyc-email" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Verified Email *
                  </label>
                  <input
                    id="kyc-email"
                    type="email"
                    required
                    value={kycEmail}
                    onChange={(e) => setKycEmail(e.target.value)}
                    placeholder="ama@domain.com"
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label htmlFor="kyc-phone" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Mobile Phone (E.164) *
                  </label>
                  <input
                    id="kyc-phone"
                    type="tel"
                    required
                    value={kycPhone}
                    onChange={(e) => setKycPhone(e.target.value)}
                    placeholder="+233557711975"
                    className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="kyc-nationality" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Nationality *
                  </label>
                  <input
                    id="kyc-nationality"
                    type="text"
                    required
                    value={kycNationality}
                    onChange={(e) => setKycNationality(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label htmlFor="kyc-residence" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Country of Residence *
                  </label>
                  <input
                    id="kyc-residence"
                    type="text"
                    required
                    value={kycResidence}
                    onChange={(e) => setKycResidence(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label htmlFor="kyc-continent" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Continent *
                  </label>
                  <select
                    id="kyc-continent"
                    value={kycContinent}
                    onChange={(e) => setKycContinent(e.target.value as ContinentKey)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    <option value="Africa">Africa</option>
                    <option value="Europe">Europe</option>
                    <option value="North America">North America</option>
                    <option value="Asia & Middle East">Asia &amp; Middle East</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="kyc-dob" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Date of Birth
                  </label>
                  <input
                    id="kyc-dob"
                    type="date"
                    value={kycDob}
                    onChange={(e) => setKycDob(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label htmlFor="kyc-idtype" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Government ID Type
                  </label>
                  <select
                    id="kyc-idtype"
                    value={kycIdType}
                    onChange={(e) =>
                      setKycIdType(
                        e.target.value as 'national_id' | 'passport' | 'drivers_license' | 'voters_id'
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    <option value="national_id">National ID / Ghana Card / NIN</option>
                    <option value="passport">International Passport</option>
                    <option value="drivers_license">Driver&apos;s License</option>
                    <option value="voters_id">Voter&apos;s ID Card</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="kyc-idnum" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Document Number (8+ chars for Enhanced) *
                  </label>
                  <input
                    id="kyc-idnum"
                    type="text"
                    required
                    value={kycIdNumber}
                    onChange={(e) => setKycIdNumber(e.target.value)}
                    placeholder="GHA-72839104-5"
                    className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="kyc-address" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Residential Street Address *
                  </label>
                  <input
                    id="kyc-address"
                    type="text"
                    required
                    value={kycAddress}
                    onChange={(e) => setKycAddress(e.target.value)}
                    placeholder="14 Independence Ave, Ridge"
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label htmlFor="kyc-city" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    City / Region *
                  </label>
                  <input
                    id="kyc-city"
                    type="text"
                    required
                    value={kycCity}
                    onChange={(e) => setKycCity(e.target.value)}
                    placeholder="Accra"
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="kyc-occupation" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Occupation / Profession *
                  </label>
                  <input
                    id="kyc-occupation"
                    type="text"
                    required
                    value={kycOccupation}
                    onChange={(e) => setKycOccupation(e.target.value)}
                    placeholder="Media Publisher / Export Trader"
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label htmlFor="kyc-source-funds" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Primary Source of Funds *
                  </label>
                  <select
                    id="kyc-source-funds"
                    value={kycSourceOfFunds}
                    onChange={(e) =>
                      setKycSourceOfFunds(
                        e.target.value as
                          | 'salary'
                          | 'business_revenue'
                          | 'creator_payouts'
                          | 'remittance_family'
                          | 'savings'
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    <option value="business_revenue">Business Revenue &amp; Trade</option>
                    <option value="salary">Employment Salary / Income</option>
                    <option value="creator_payouts">Creator &amp; Digital Publishing Earnings</option>
                    <option value="remittance_family">Family Remittance</option>
                    <option value="savings">Personal Savings</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="kyc-purpose" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Purpose of Transactions
                </label>
                <input
                  id="kyc-purpose"
                  type="text"
                  value={kycPurpose}
                  onChange={(e) => setKycPurpose(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              {kycFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium px-3.5 py-2.5 rounded-md border ${
                    kycFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  {kycFeedback.text}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingKyc}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-60 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{submittingKyc ? 'Verifying Customer KYC…' : 'Verify & Save Customer Background Profile'}</span>
              </button>
            </form>

            {/* Right 5 cols: Verified Customer Profiles Directory */}
            <div className="lg:col-span-5 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
                <span className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Verified Customer Directory
                </span>
                <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                  {loadingInitial ? 'Syncing…' : `${kycProfiles.length} active`}
                </span>
              </div>

              {kycProfiles.length === 0 ? (
                <p className="p-6 text-xs text-[#57534E] dark:text-[#A8A29E]">
                  No KYC profiles verified yet. Complete the customer background form to unlock $5,000–$15,000/day transfer limits.
                </p>
              ) : (
                <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-[34rem] overflow-y-auto">
                  {kycProfiles.map((k) => (
                    <div key={k.id} className="p-4 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80] shrink-0" />
                          <span>{k.fullName}</span>
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
                          {k.verificationTier.toUpperCase()} · ${k.dailyLimitUsd.toLocaleString()}/day
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                        {k.countryOfResidence} ({k.continent}) · {k.city} · ID: {k.idNumberMasked}
                      </p>
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                        {k.occupation} · Source: {k.sourceOfFunds.replace('_', ' ')}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectRemitKyc(k.id);
                          setActiveTab('remittance');
                        }}
                        className="mt-1 px-2.5 py-1 text-[11px] font-medium bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm hover:border-[#141413]"
                      >
                        Use in Global Remittance
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
