import path from 'node:path';
import fs from 'node:fs';
import {
  calculateTransactionFeeQuote,
  type AfricaFxRates,
  writeJsonAtomic
} from './realMonetization.ts';

export type ContinentKey =
  | 'Africa'
  | 'Europe'
  | 'North America'
  | 'Asia & Middle East';

export type CorridorId =
  | 'africa_domestic'
  | 'intra_africa'
  | 'africa_europe'
  | 'africa_north_america'
  | 'africa_asia_mena'
  | 'intercontinental_global';

export interface CustomerKycProfile {
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

export interface RemittanceCorridorConfig {
  id: CorridorId;
  label: string;
  description: string;
  percentageFee: number;
  flatFeeUsd: number;
  minFeeUsd: number;
  maxFeeUsd: number;
  fxSpreadPercent: number;
  etaLabel: string;
  supportedPayoutRails: string[];
}

export interface RemittanceCountrySpec {
  code: string;
  name: string;
  continent: ContinentKey;
  currency: string;
  currencySymbol: string;
  dialCode: string;
  payoutRails: Array<'mobile_money' | 'bank_deposit' | 'cash_pickup' | 'newshub_wallet'>;
  popularCarriers: string[];
}

export interface RemittanceTransferRecord {
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
  corridorId: CorridorId;
  corridorLabel: string;
  payoutMethod: 'mobile_money' | 'bank_deposit' | 'cash_pickup' | 'newshub_wallet' | 'ussd_789';
  paymentRail: string;
  sendAmountUsd: number;
  sendAmountLocal: number;
  corridorFeeUsd: number;
  fxSpreadUsd: number;
  totalFeeUsd: number;
  totalChargedUsd: number;
  effectiveRate: number;
  receiveAmountLocal: number;
  receiveAmountUsdEquivalent: number;
  pickupCode: string;
  etaLabel: string;
  status: 'Ready for Pickup' | 'In Transit' | 'Collected / Settled' | 'Reversed';
  settlementMode: 'live_gateway' | 'verified_corridor_ledger' | 'ussd_789';
  purpose: string;
  createdAt: string;
  updatedAt: string;
  collectedAt?: string;
  reversalReason?: string;
}

export interface AirtimeCarrierCountry {
  countryCode: string;
  countryName: string;
  continent: ContinentKey;
  dialCode: string;
  currency: string;
  currencySymbol: string;
  carriers: string[];
  domesticFeePercent: number;
  internationalFeePercent: number;
  minUsd: number;
  maxUsd: number;
}

export interface AirtimeOrderRecord {
  id: string;
  ownerUid: string;
  customerKycId?: string;
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

export interface UssdSessionRecord {
  id: string;
  msisdn: string;
  shortcode: string;
  serviceCategory:
    | 'menu'
    | 'remittance'
    | 'airtime'
    | 'subscriptions_ads'
    | 'kyc_wallet'
    | 'track_mtcn'
    | 'merchant_third_party'
    | 'creator_withdraw';
  step: number;
  draft: Record<string, string>;
  status: 'active' | 'completed' | 'cancelled';
  lastScreenText: string;
  receiptRef?: string;
  updatedAt: string;
}

export interface LiveSubscriptionRecord {
  id: string;
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  amountUsd: number;
  processorFeeUsd: number;
  netRevenueUsd: number;
  customerName: string;
  customerEmail: string;
  customerKycId?: string;
  paymentMethodId: string;
  paymentReference: string;
  verifiedRealFunds: boolean;
  status: 'active' | 'paused' | 'cancelled';
  nextBillingAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalPaymentsState {
  kycProfiles: CustomerKycProfile[];
  remittances: RemittanceTransferRecord[];
  airtimeOrders: AirtimeOrderRecord[];
  ussdReceipts: Array<{
    id: string;
    shortcode: string;
    msisdn: string;
    service: string;
    amountUsd: number;
    feeUsd: number;
    amountGhs: number;
    reference: string;
    summary: string;
    settlementMode?: 'live_carrier_api' | 'live_ghanapay_api' | 'verified_treasury_ledger';
    providerChannel?: string;
    verifiedRealFunds?: boolean;
    createdAt: string;
  }>;
  subscriptions: LiveSubscriptionRecord[];
}

export const REMITTANCE_CORRIDORS: Record<CorridorId, RemittanceCorridorConfig> = {
  africa_domestic: {
    id: 'africa_domestic',
    label: 'Africa Domestic Transfer',
    description: 'Same-country instant transfer across Mobile Money, GhanaPay, or local bank accounts.',
    percentageFee: 0.75,
    flatFeeUsd: 0.25,
    minFeeUsd: 0.25,
    maxFeeUsd: 12.0,
    fxSpreadPercent: 0.35,
    etaLabel: 'Instant (under 60 seconds)',
    supportedPayoutRails: ['mobile_money', 'bank_deposit', 'cash_pickup', 'newshub_wallet', 'ussd_789']
  },
  intra_africa: {
    id: 'intra_africa',
    label: 'Intra-Africa Cross-Border (PAPSS & MoMo)',
    description: 'Cross-border transfers between African nations (Ghana, Nigeria, Kenya, South Africa, Senegal, Côte d\'Ivoire, Uganda, Egypt).',
    percentageFee: 1.85,
    flatFeeUsd: 0.75,
    minFeeUsd: 0.95,
    maxFeeUsd: 35.0,
    fxSpreadPercent: 0.85,
    etaLabel: '1–10 minutes (PAPSS / Pan-African MoMo)',
    supportedPayoutRails: ['mobile_money', 'bank_deposit', 'cash_pickup', 'newshub_wallet', 'ussd_789']
  },
  africa_europe: {
    id: 'africa_europe',
    label: 'Africa ↔ Europe Corridor (UK / EU / Switzerland)',
    description: 'Bilateral transfers between African countries and Europe (GBP Faster Payments, EUR SEPA, CHF).',
    percentageFee: 3.2,
    flatFeeUsd: 2.5,
    minFeeUsd: 2.75,
    maxFeeUsd: 65.0,
    fxSpreadPercent: 1.1,
    etaLabel: '15 mins (Mobile/Cash) · Same-Day SEPA/UK',
    supportedPayoutRails: ['mobile_money', 'bank_deposit', 'cash_pickup', 'newshub_wallet']
  },
  africa_north_america: {
    id: 'africa_north_america',
    label: 'Africa ↔ North America Corridor (USA / Canada)',
    description: 'Bilateral transfers between Africa and United States / Canada (USD ACH / FedNow / Interac / MoMo).',
    percentageFee: 3.65,
    flatFeeUsd: 3.5,
    minFeeUsd: 3.75,
    maxFeeUsd: 78.0,
    fxSpreadPercent: 1.25,
    etaLabel: '15 mins (Pickup/MoMo) · 1 Business Day Bank',
    supportedPayoutRails: ['mobile_money', 'bank_deposit', 'cash_pickup', 'newshub_wallet']
  },
  africa_asia_mena: {
    id: 'africa_asia_mena',
    label: 'Africa ↔ Asia-Pacific & Middle East (UAE / India / China / SG)',
    description: 'Cross-continent corridor linking Africa with UAE, Saudi Arabia, India, China, Japan, and Singapore.',
    percentageFee: 3.4,
    flatFeeUsd: 3.0,
    minFeeUsd: 3.25,
    maxFeeUsd: 70.0,
    fxSpreadPercent: 1.2,
    etaLabel: '15–45 mins (UPI / Wallet / Pickup / SWIFT)',
    supportedPayoutRails: ['mobile_money', 'bank_deposit', 'cash_pickup', 'newshub_wallet']
  },
  intercontinental_global: {
    id: 'intercontinental_global',
    label: 'Global Intercontinental Corridor (EU ↔ Americas ↔ Asia)',
    description: 'International transfers connecting Europe, North America, and Asia-Pacific bureaus.',
    percentageFee: 2.95,
    flatFeeUsd: 2.0,
    minFeeUsd: 2.5,
    maxFeeUsd: 55.0,
    fxSpreadPercent: 0.95,
    etaLabel: 'Same-day / Instant Agent Pickup',
    supportedPayoutRails: ['bank_deposit', 'cash_pickup', 'newshub_wallet']
  }
};

export const REMITTANCE_COUNTRIES: RemittanceCountrySpec[] = [
  {
    code: 'GH',
    name: 'Ghana',
    continent: 'Africa',
    currency: 'GHS',
    currencySymbol: 'GH₵',
    dialCode: '+233',
    payoutRails: ['mobile_money', 'bank_deposit', 'cash_pickup', 'newshub_wallet'],
    popularCarriers: ['MTN MoMo', 'Telecel Cash', 'AT Money', 'GhanaPay']
  },
  {
    code: 'NG',
    name: 'Nigeria',
    continent: 'Africa',
    currency: 'NGN',
    currencySymbol: '₦',
    dialCode: '+234',
    payoutRails: ['bank_deposit', 'mobile_money', 'cash_pickup', 'newshub_wallet'],
    popularCarriers: ['MTN Nigeria', 'Airtel Nigeria', 'OPay', 'GTBank / Zenith']
  },
  {
    code: 'KE',
    name: 'Kenya',
    continent: 'Africa',
    currency: 'KES',
    currencySymbol: 'KSh',
    dialCode: '+254',
    payoutRails: ['mobile_money', 'bank_deposit', 'cash_pickup'],
    popularCarriers: ['M-Pesa Safaricom', 'Airtel Money Kenya']
  },
  {
    code: 'ZA',
    name: 'South Africa',
    continent: 'Africa',
    currency: 'ZAR',
    currencySymbol: 'R',
    dialCode: '+27',
    payoutRails: ['bank_deposit', 'cash_pickup', 'mobile_money'],
    popularCarriers: ['Vodacom', 'MTN SA', 'FNB / Capitec']
  },
  {
    code: 'CI',
    name: "Côte d'Ivoire",
    continent: 'Africa',
    currency: 'XOF',
    currencySymbol: 'CFA',
    dialCode: '+225',
    payoutRails: ['mobile_money', 'cash_pickup', 'bank_deposit'],
    popularCarriers: ['Orange Money', 'MTN MoMo CI', 'Wave']
  },
  {
    code: 'SN',
    name: 'Senegal',
    continent: 'Africa',
    currency: 'XOF',
    currencySymbol: 'CFA',
    dialCode: '+221',
    payoutRails: ['mobile_money', 'cash_pickup', 'bank_deposit'],
    popularCarriers: ['Wave Senegal', 'Orange Money SN']
  },
  {
    code: 'UG',
    name: 'Uganda',
    continent: 'Africa',
    currency: 'UGX',
    currencySymbol: 'USh',
    dialCode: '+256',
    payoutRails: ['mobile_money', 'cash_pickup', 'bank_deposit'],
    popularCarriers: ['MTN MoMo Uganda', 'Airtel Money Uganda']
  },
  {
    code: 'EG',
    name: 'Egypt',
    continent: 'Africa',
    currency: 'EGP',
    currencySymbol: 'E£',
    dialCode: '+20',
    payoutRails: ['mobile_money', 'bank_deposit', 'cash_pickup'],
    popularCarriers: ['Vodafone Cash', 'InstaPay / CIB']
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    continent: 'Europe',
    currency: 'GBP',
    currencySymbol: '£',
    dialCode: '+44',
    payoutRails: ['bank_deposit', 'cash_pickup', 'newshub_wallet'],
    popularCarriers: ['UK Faster Payments', 'Monzo / Barclays']
  },
  {
    code: 'EU',
    name: 'Eurozone (FR / DE / NL / IT / ES)',
    continent: 'Europe',
    currency: 'EUR',
    currencySymbol: '€',
    dialCode: '+33',
    payoutRails: ['bank_deposit', 'cash_pickup', 'newshub_wallet'],
    popularCarriers: ['SEPA Instant', 'BNP / Deutsche Bank']
  },
  {
    code: 'CH',
    name: 'Switzerland',
    continent: 'Europe',
    currency: 'CHF',
    currencySymbol: 'CHF',
    dialCode: '+41',
    payoutRails: ['bank_deposit', 'cash_pickup'],
    popularCarriers: ['UBS / Swiss IBAN']
  },
  {
    code: 'US',
    name: 'United States',
    continent: 'North America',
    currency: 'USD',
    currencySymbol: '$',
    dialCode: '+1',
    payoutRails: ['bank_deposit', 'cash_pickup', 'newshub_wallet'],
    popularCarriers: ['US ACH / FedNow', 'Western Union Agent Network']
  },
  {
    code: 'CA',
    name: 'Canada',
    continent: 'North America',
    currency: 'CAD',
    currencySymbol: 'C$',
    dialCode: '+1',
    payoutRails: ['bank_deposit', 'cash_pickup', 'newshub_wallet'],
    popularCarriers: ['Interac e-Transfer', 'RBC / TD Canada']
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    continent: 'Asia & Middle East',
    currency: 'AED',
    currencySymbol: 'AED',
    dialCode: '+971',
    payoutRails: ['bank_deposit', 'cash_pickup', 'mobile_money'],
    popularCarriers: ['UAE Emirates NBD', 'Al Ansari / e& money']
  },
  {
    code: 'IN',
    name: 'India',
    continent: 'Asia & Middle East',
    currency: 'INR',
    currencySymbol: '₹',
    dialCode: '+91',
    payoutRails: ['bank_deposit', 'mobile_money', 'cash_pickup'],
    popularCarriers: ['UPI Instant', 'HDFC / SBI / Airtel']
  },
  {
    code: 'CN',
    name: 'China',
    continent: 'Asia & Middle East',
    currency: 'CNY',
    currencySymbol: '¥',
    dialCode: '+86',
    payoutRails: ['mobile_money', 'bank_deposit'],
    popularCarriers: ['Alipay Global', 'WeChat Pay', 'UnionPay']
  },
  {
    code: 'SG',
    name: 'Singapore',
    continent: 'Asia & Middle East',
    currency: 'SGD',
    currencySymbol: 'S$',
    dialCode: '+65',
    payoutRails: ['bank_deposit', 'cash_pickup'],
    popularCarriers: ['PayNow / DBS']
  }
];

export const UNIVERSAL_AIRTIME_CATALOG: AirtimeCarrierCountry[] = [
  {
    countryCode: 'GH',
    countryName: 'Ghana',
    continent: 'Africa',
    dialCode: '+233',
    currency: 'GHS',
    currencySymbol: 'GH₵',
    carriers: ['MTN Ghana', 'Telecel Ghana', 'AT (AirtelTigo)'],
    domesticFeePercent: 1.0,
    internationalFeePercent: 2.2,
    minUsd: 1,
    maxUsd: 250
  },
  {
    countryCode: 'NG',
    countryName: 'Nigeria',
    continent: 'Africa',
    dialCode: '+234',
    currency: 'NGN',
    currencySymbol: '₦',
    carriers: ['MTN Nigeria', 'Airtel Nigeria', 'Glo Mobile', '9mobile'],
    domesticFeePercent: 1.2,
    internationalFeePercent: 2.4,
    minUsd: 1,
    maxUsd: 250
  },
  {
    countryCode: 'KE',
    countryName: 'Kenya',
    continent: 'Africa',
    dialCode: '+254',
    currency: 'KES',
    currencySymbol: 'KSh',
    carriers: ['Safaricom Kenya', 'Airtel Kenya', 'Telkom Kenya'],
    domesticFeePercent: 1.2,
    internationalFeePercent: 2.4,
    minUsd: 1,
    maxUsd: 250
  },
  {
    countryCode: 'ZA',
    countryName: 'South Africa',
    continent: 'Africa',
    dialCode: '+27',
    currency: 'ZAR',
    currencySymbol: 'R',
    carriers: ['Vodacom SA', 'MTN South Africa', 'Cell C', 'Telkom Mobile'],
    domesticFeePercent: 1.5,
    internationalFeePercent: 2.6,
    minUsd: 2,
    maxUsd: 250
  },
  {
    countryCode: 'CI',
    countryName: "Côte d'Ivoire",
    continent: 'Africa',
    dialCode: '+225',
    currency: 'XOF',
    currencySymbol: 'CFA',
    carriers: ['Orange Côte d\'Ivoire', 'MTN CI', 'Moov Africa'],
    domesticFeePercent: 1.4,
    internationalFeePercent: 2.5,
    minUsd: 1,
    maxUsd: 200
  },
  {
    countryCode: 'SN',
    countryName: 'Senegal',
    continent: 'Africa',
    dialCode: '+221',
    currency: 'XOF',
    currencySymbol: 'CFA',
    carriers: ['Orange Senegal', 'Free Senegal', 'Expresso'],
    domesticFeePercent: 1.4,
    internationalFeePercent: 2.5,
    minUsd: 1,
    maxUsd: 200
  },
  {
    countryCode: 'UG',
    countryName: 'Uganda',
    continent: 'Africa',
    dialCode: '+256',
    currency: 'UGX',
    currencySymbol: 'USh',
    carriers: ['MTN Uganda', 'Airtel Uganda'],
    domesticFeePercent: 1.3,
    internationalFeePercent: 2.4,
    minUsd: 1,
    maxUsd: 200
  },
  {
    countryCode: 'EG',
    countryName: 'Egypt',
    continent: 'Africa',
    dialCode: '+20',
    currency: 'EGP',
    currencySymbol: 'E£',
    carriers: ['Vodafone Egypt', 'Orange Egypt', 'Etisalat Egypt', 'WE'],
    domesticFeePercent: 1.5,
    internationalFeePercent: 2.8,
    minUsd: 1,
    maxUsd: 200
  },
  {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    continent: 'Europe',
    dialCode: '+44',
    currency: 'GBP',
    currencySymbol: '£',
    carriers: ['EE UK', 'Vodafone UK', 'O2 UK', 'Three UK', 'Lycamobile'],
    domesticFeePercent: 1.8,
    internationalFeePercent: 3.4,
    minUsd: 2,
    maxUsd: 250
  },
  {
    countryCode: 'FR',
    countryName: 'France & Eurozone',
    continent: 'Europe',
    dialCode: '+33',
    currency: 'EUR',
    currencySymbol: '€',
    carriers: ['Orange France', 'SFR', 'Bouygues', 'Deutsche Telekom', 'Vodafone DE'],
    domesticFeePercent: 1.8,
    internationalFeePercent: 3.4,
    minUsd: 2,
    maxUsd: 250
  },
  {
    countryCode: 'US',
    countryName: 'United States & Canada',
    continent: 'North America',
    dialCode: '+1',
    currency: 'USD',
    currencySymbol: '$',
    carriers: ['AT&T', 'T-Mobile US', 'Verizon', 'Rogers Canada', 'Bell Mobility'],
    domesticFeePercent: 1.8,
    internationalFeePercent: 3.5,
    minUsd: 5,
    maxUsd: 300
  },
  {
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    continent: 'Asia & Middle East',
    dialCode: '+971',
    currency: 'AED',
    currencySymbol: 'AED',
    carriers: ['e& (Etisalat UAE)', 'du Mobile'],
    domesticFeePercent: 1.6,
    internationalFeePercent: 3.2,
    minUsd: 2,
    maxUsd: 250
  },
  {
    countryCode: 'IN',
    countryName: 'India',
    continent: 'Asia & Middle East',
    dialCode: '+91',
    currency: 'INR',
    currencySymbol: '₹',
    carriers: ['Reliance Jio', 'Bharti Airtel India', 'Vi (Vodafone Idea)', 'BSNL'],
    domesticFeePercent: 1.5,
    internationalFeePercent: 3.1,
    minUsd: 1,
    maxUsd: 200
  },
  {
    countryCode: 'CN',
    countryName: 'China',
    continent: 'Asia & Middle East',
    dialCode: '+86',
    currency: 'CNY',
    currencySymbol: '¥',
    carriers: ['China Mobile', 'China Unicom', 'China Telecom'],
    domesticFeePercent: 1.8,
    internationalFeePercent: 3.5,
    minUsd: 2,
    maxUsd: 250
  },
  {
    countryCode: 'INTL',
    countryName: 'Any Other Country (Universal E.164)',
    continent: 'Asia & Middle East',
    dialCode: '+',
    currency: 'USD',
    currencySymbol: '$',
    carriers: ['Auto-Detect International Carrier (Reloadly / Ding Global)', 'Universal Roaming PIN'],
    domesticFeePercent: 2.5,
    internationalFeePercent: 3.5,
    minUsd: 2,
    maxUsd: 250
  }
];

const globalPaymentsPath = path.join(process.cwd(), 'server', 'global-payments-state.json');

const DEFAULT_GLOBAL_STATE: GlobalPaymentsState = {
  kycProfiles: [
    {
      id: 'kyc-owner-nh24',
      ownerUid: 'owner',
      fullName: 'News Hub 24+ Treasury Desk',
      email: 'newshub24plus@gmail.com',
      phone: '+233557711975',
      nationality: 'Ghana',
      countryOfResidence: 'Ghana',
      continent: 'Africa',
      dateOfBirth: '1992-04-12',
      idType: 'national_id',
      idNumberMasked: 'GHA-••••••-1975',
      residentialAddress: '14 Independence Avenue, Ridge, Accra',
      city: 'Accra',
      occupation: 'Publisher & Digital Media Agency',
      sourceOfFunds: 'business_revenue',
      purposeOfTransaction: 'Editorial creator payouts, subscriptions, and cross-border bureau operations',
      verificationTier: 'enhanced',
      status: 'verified',
      dailyLimitUsd: 25000,
      createdAt: '2026-11-10T09:00:00Z',
      updatedAt: '2026-11-16T08:30:00Z'
    }
  ],
  remittances: [],
  airtimeOrders: [],
  ussdReceipts: [],
  subscriptions: []
};

export function loadGlobalPaymentsState(): GlobalPaymentsState {
  try {
    if (fs.existsSync(globalPaymentsPath)) {
      const parsed = JSON.parse(fs.readFileSync(globalPaymentsPath, 'utf8')) as Partial<GlobalPaymentsState>;
      return {
        kycProfiles: Array.isArray(parsed.kycProfiles) && parsed.kycProfiles.length > 0
          ? parsed.kycProfiles
          : [...DEFAULT_GLOBAL_STATE.kycProfiles],
        remittances: Array.isArray(parsed.remittances) ? parsed.remittances : [],
        airtimeOrders: Array.isArray(parsed.airtimeOrders) ? parsed.airtimeOrders : [],
        ussdReceipts: Array.isArray(parsed.ussdReceipts) ? parsed.ussdReceipts : [],
        subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : []
      };
    }
  } catch {
    // Fallback cleanly
  }
  return {
    kycProfiles: [...DEFAULT_GLOBAL_STATE.kycProfiles],
    remittances: [],
    airtimeOrders: [],
    ussdReceipts: [],
    subscriptions: []
  };
}

export function saveGlobalPaymentsState(state: GlobalPaymentsState): void {
  writeJsonAtomic(globalPaymentsPath, {
    kycProfiles: state.kycProfiles.slice(0, 100),
    remittances: state.remittances.slice(0, 120),
    airtimeOrders: state.airtimeOrders.slice(0, 120),
    ussdReceipts: state.ussdReceipts.slice(0, 120),
    subscriptions: state.subscriptions.slice(0, 120)
  });
}

export function maskDocumentNumber(rawDoc: string): string {
  const cleaned = rawDoc.replace(/\s+/g, '').trim();
  if (cleaned.length <= 4) {
    return `••••-${cleaned}`;
  }
  const prefix = cleaned.slice(0, Math.min(3, Math.max(0, cleaned.length - 4)));
  const suffix = cleaned.slice(-4);
  return `${prefix ? `${prefix}-` : ''}••••-${suffix}`;
}

export function resolveRemittanceCorridor(
  senderCountryCode: string,
  recipientCountryCode: string
): {
  corridor: RemittanceCorridorConfig;
  sender: RemittanceCountrySpec;
  recipient: RemittanceCountrySpec;
} {
  const sender =
    REMITTANCE_COUNTRIES.find((c) => c.code === senderCountryCode.toUpperCase()) ?? REMITTANCE_COUNTRIES[0];
  const recipient =
    REMITTANCE_COUNTRIES.find((c) => c.code === recipientCountryCode.toUpperCase()) ?? REMITTANCE_COUNTRIES[1];

  let corridorId: CorridorId = 'intercontinental_global';
  if (sender.code === recipient.code && sender.continent === 'Africa') {
    corridorId = 'africa_domestic';
  } else if (sender.continent === 'Africa' && recipient.continent === 'Africa') {
    corridorId = 'intra_africa';
  } else if (
    (sender.continent === 'Africa' && recipient.continent === 'Europe') ||
    (sender.continent === 'Europe' && recipient.continent === 'Africa')
  ) {
    corridorId = 'africa_europe';
  } else if (
    (sender.continent === 'Africa' && recipient.continent === 'North America') ||
    (sender.continent === 'North America' && recipient.continent === 'Africa')
  ) {
    corridorId = 'africa_north_america';
  } else if (
    (sender.continent === 'Africa' && recipient.continent === 'Asia & Middle East') ||
    (sender.continent === 'Asia & Middle East' && recipient.continent === 'Africa')
  ) {
    corridorId = 'africa_asia_mena';
  }

  return {
    corridor: REMITTANCE_CORRIDORS[corridorId],
    sender,
    recipient
  };
}

export function computeRemittanceQuote(params: {
  senderCountryCode: string;
  recipientCountryCode: string;
  sendAmountUsd: number;
  fxRates: AfricaFxRates;
  paymentRail?: string;
}) {
  const { corridor, sender, recipient } = resolveRemittanceCorridor(
    params.senderCountryCode,
    params.recipientCountryCode
  );
  const sendAmountUsd = Math.max(1, Math.min(25000, Number(params.sendAmountUsd.toFixed(2))));

  const rawCorridorFee = (sendAmountUsd * corridor.percentageFee) / 100 + corridor.flatFeeUsd;
  const corridorFeeUsd = Number(
    Math.min(corridor.maxFeeUsd, Math.max(corridor.minFeeUsd, rawCorridorFee)).toFixed(2)
  );
  const fxSpreadUsd = Number(((sendAmountUsd * corridor.fxSpreadPercent) / 100).toFixed(2));

  const railFeeQuote = params.paymentRail
    ? calculateTransactionFeeQuote({
        methodId: params.paymentRail,
        amountUsd: sendAmountUsd,
        fxRates: params.fxRates,
        currencyLocal: sender.currency,
        corridorType:
          corridor.id === 'africa_domestic'
            ? 'domestic'
            : corridor.id === 'intra_africa'
              ? 'intra_africa'
              : 'cross_continent'
      })
    : null;

  // For *789# USSD or App Wallet remittances, give discounted rail fee (only corridor fee applies for App Wallet)
  const gatewaySurchargeUsd =
    !railFeeQuote || params.paymentRail === 'newshub-app-wallet'
      ? 0
      : Number(Math.min(10, railFeeQuote.gatewayFeeUsd * 0.5).toFixed(2));

  const totalFeeUsd = Number((corridorFeeUsd + fxSpreadUsd + gatewaySurchargeUsd).toFixed(2));
  const totalChargedUsd = Number((sendAmountUsd + totalFeeUsd).toFixed(2));

  const senderUsdRate = params.fxRates.rates[sender.currency] ?? 1;
  const recipientUsdRate = params.fxRates.rates[recipient.currency] ?? 1;
  const sendAmountLocal = Number((sendAmountUsd * senderUsdRate).toFixed(2));
  const netUsdDelivered = Math.max(0.5, sendAmountUsd - fxSpreadUsd);
  const effectiveRate = Number((recipientUsdRate / Math.max(0.01, senderUsdRate)).toFixed(4));
  const receiveAmountLocal = Number((netUsdDelivered * recipientUsdRate).toFixed(2));

  return {
    corridor,
    sender,
    recipient,
    sendAmountUsd,
    sendAmountLocal,
    corridorFeeUsd,
    fxSpreadUsd,
    gatewaySurchargeUsd,
    totalFeeUsd,
    totalChargedUsd,
    senderUsdRate,
    recipientUsdRate,
    effectiveRate,
    receiveAmountLocal,
    receiveAmountUsdEquivalent: Number(netUsdDelivered.toFixed(2)),
    etaLabel: corridor.etaLabel
  };
}

export function generateMtcnCode(): string {
  const digits = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
  return `NH24-${digits}`;
}

export function computeAirtimeQuote(params: {
  countryCode: string;
  amountUsd: number;
  buyerCountryCode?: string;
  paymentRail?: string;
  fxRates: AfricaFxRates;
}) {
  const country =
    UNIVERSAL_AIRTIME_CATALOG.find((c) => c.countryCode === params.countryCode.toUpperCase()) ??
    UNIVERSAL_AIRTIME_CATALOG[UNIVERSAL_AIRTIME_CATALOG.length - 1];
  const amountUsd = Math.max(country.minUsd, Math.min(country.maxUsd, Number(params.amountUsd.toFixed(2))));

  const isSameCountry =
    Boolean(params.buyerCountryCode) &&
    params.buyerCountryCode?.toUpperCase() === country.countryCode;
  const isUssd = params.paymentRail === 'ussd-789';
  const feePercent = isUssd
    ? 0.75
    : isSameCountry
      ? country.domesticFeePercent
      : country.internationalFeePercent;

  const feeUsd = Number(Math.max(0.05, (amountUsd * feePercent) / 100).toFixed(2));
  const totalChargedUsd = Number((amountUsd + feeUsd).toFixed(2));
  const localFx = params.fxRates.rates[country.currency] ?? 1;
  const localTopupAmount = Number((amountUsd * localFx).toFixed(2));
  const ghsTotal = Number((totalChargedUsd * params.fxRates.GHS).toFixed(2));

  return {
    country,
    amountUsd,
    feePercent,
    feeUsd,
    totalChargedUsd,
    localFx,
    localTopupAmount,
    ghsTotal
  };
}
