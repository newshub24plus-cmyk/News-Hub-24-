import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const firestoreDatabaseId =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
  'ai-studio-newshub24-f8ecd2be-d75e-466e-be66-a39d6d6b3f28';
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const AGENCY_ADMIN_EMAIL = 'newshub24plus@gmail.com';
const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function isAgencyAdminUser(user: User | null | undefined): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email?.toLowerCase() === AGENCY_ADMIN_EMAIL
  );
}

function sanitizeDocId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').replace(/-+/g, '-').slice(0, 120);
  if (VALID_ID_REGEX.test(cleaned) && cleaned.length > 0) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now().toString(36)}`;
}

function clampStr(value: string, maxLen: number, fallback = ''): string {
  const trimmed = (value || fallback).trim();
  return trimmed.slice(0, maxLen);
}

// ==========================================
// 1. GHANAPAY LOGIN & WALLET PROFILE
// ==========================================

export type GhanaPayNetwork = 'MTN' | 'TELECEL' | 'AT' | 'GHANAPAY';
export type GhanaPayRail = GhanaPayNetwork | 'GHIPSS_BANK';

export interface GhanaPayAccountProfile {
  uid: string;
  ghanaPayId: string;
  momoNumber: string;
  network: GhanaPayNetwork;
  accountName: string;
  email: string;
  status: 'active' | 'suspended';
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export async function signInWithGhanaPayGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureGhanaPayAccount(result.user);
  return result.user;
}

export async function signOutGhanaPay(): Promise<void> {
  await signOut(auth);
}

export async function ensureGhanaPayAccount(
  user: User,
  overrides?: Partial<Pick<GhanaPayAccountProfile, 'ghanaPayId' | 'momoNumber' | 'network' | 'accountName'>>
): Promise<GhanaPayAccountProfile> {
  const path = `ghanapay_accounts/${user.uid}`;
  const docRef = doc(db, 'ghanapay_accounts', user.uid);
  try {
    const snap = await getDoc(docRef);
    const defaultAlias = `GHP-${user.uid.slice(0, 6).toUpperCase()}`;
    const cleanPhone = clampStr(
      overrides?.momoNumber?.replace(/[\s()-]/g, '') || '0557711975',
      20,
      '0557711975'
    );
    const normalizedPhone = cleanPhone.length >= 9 ? cleanPhone : '0557711975';
    const cleanName = clampStr(
      overrides?.accountName || user.displayName || user.email?.split('@')[0] || 'GhanaPay Member',
      120,
      'GhanaPay Member'
    );
    const cleanEmail = clampStr(user.email || 'member@newshub24plus.com', 160, 'member@newshub24plus.com');
    const chosenNetwork: GhanaPayNetwork = overrides?.network || 'MTN';
    const chosenGhanaPayId = clampStr(overrides?.ghanaPayId || defaultAlias, 64, defaultAlias);

    if (!snap.exists()) {
      const payload = {
        uid: user.uid,
        ghanaPayId: chosenGhanaPayId.length >= 4 ? chosenGhanaPayId : defaultAlias,
        momoNumber: normalizedPhone,
        network: chosenNetwork,
        accountName: cleanName.length >= 2 ? cleanName : 'GhanaPay Member',
        email: cleanEmail.length >= 5 ? cleanEmail : 'member@newshub24plus.com',
        status: 'active' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, payload);
      return {
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    const existing = snap.data() as GhanaPayAccountProfile;
    if (overrides) {
      const updates = {
        ghanaPayId: clampStr(overrides.ghanaPayId || existing.ghanaPayId, 64, defaultAlias),
        momoNumber: normalizedPhone,
        network: chosenNetwork,
        accountName: cleanName.length >= 2 ? cleanName : existing.accountName,
        email: cleanEmail.length >= 5 ? cleanEmail : existing.email,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, updates, { merge: true });
      return {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      };
    }
    return existing;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// 2. GHANAPAY TRANSACTION LOGS (MERCHANT & THIRD PARTY)
// ==========================================

export interface TransactionLogRecord {
  txRef: string;
  receiptNumber: string;
  ownerUid: string;
  payerEmail: string;
  payerPhone: string;
  paymentScope: 'merchant' | 'third_party';
  recipientPhone: string;
  recipientName: string;
  network: GhanaPayRail;
  itemName: string;
  amountGhs: number;
  feeGhs: number;
  totalGhs: number;
  currency: 'GHS';
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  settlementMode: 'live_ghanapay_api' | 'verified_ghanapay_ledger';
  settlementMessage: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export async function persistTransactionLogToFirestore(
  user: User,
  record: Omit<TransactionLogRecord, 'ownerUid' | 'currency' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  await ensureGhanaPayAccount(user);
  const txRef = sanitizeDocId(record.txRef, 'NH24-GHP');
  const path = `transaction_logs/${txRef}`;
  try {
    const amountGhs = Math.max(0.1, Math.min(500000, Number(record.amountGhs.toFixed(2))));
    const feeGhs = Math.max(0, Math.min(50000, Number(record.feeGhs.toFixed(2))));
    const totalGhs = Math.max(amountGhs, Math.min(550000, Number(record.totalGhs.toFixed(2))));

    await setDoc(doc(db, 'transaction_logs', txRef), {
      txRef,
      receiptNumber: clampStr(record.receiptNumber, 64, `RCPT-${txRef}`),
      ownerUid: user.uid,
      payerEmail: clampStr(record.payerEmail || user.email || 'member@newshub24plus.com', 160),
      payerPhone: clampStr(record.payerPhone, 20, '0557711975'),
      paymentScope: record.paymentScope,
      recipientPhone: clampStr(record.recipientPhone, 20, '0557711975'),
      recipientName: clampStr(record.recipientName, 120, 'News Hub 24+ Merchant'),
      network: record.network,
      itemName: clampStr(record.itemName, 200, 'GhanaPay Payment'),
      amountGhs,
      feeGhs,
      totalGhs,
      currency: 'GHS',
      status: record.status,
      settlementMode: record.settlementMode,
      settlementMessage: clampStr(record.settlementMessage, 300, 'Processed via GhanaPay Gateway'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserTransactionLogs(
  uid: string,
  onData: (logs: TransactionLogRecord[]) => void
): Unsubscribe {
  const path = 'transaction_logs';
  const q = query(
    collection(db, path),
    where('ownerUid', '==', uid),
    limit(40)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const rows: TransactionLogRecord[] = snapshot.docs.map((d) => {
        const raw = d.data() as TransactionLogRecord;
        const createdIso =
          raw.createdAt && typeof raw.createdAt === 'object' && 'toDate' in raw.createdAt
            ? raw.createdAt.toDate().toISOString()
            : typeof raw.createdAt === 'string'
              ? raw.createdAt
              : new Date().toISOString();
        return {
          ...raw,
          createdAt: createdIso
        };
      });
      rows.sort((a, b) => {
        const ta = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0;
        const tb = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
      onData(rows);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ==========================================
// 3. FRONT-PAGE UPDATES DATABASE
// ==========================================

export interface FrontPageUpdateRecord {
  id: string;
  title: string;
  deck: string;
  body?: string;
  category: string;
  author: string;
  authorUid: string;
  imageUrl?: string;
  source?: string;
  url?: string;
  tags: string[];
  status: 'published' | 'breaking' | 'archived';
  publishedAt: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export async function loadFrontPageUpdatesFromFirestore(): Promise<FrontPageUpdateRecord[]> {
  const path = 'frontpage_updates';
  try {
    const q = query(collection(db, path), orderBy('publishedAt', 'desc'), limit(40));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as FrontPageUpdateRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function syncFrontPageUpdateToFirestore(
  user: User,
  article: {
    id: string;
    title: string;
    deck: string;
    body?: string;
    category: string;
    author: string;
    imageUrl?: string;
    source?: string;
    url?: string;
    tags?: string[];
    breaking?: boolean;
    publishedAt?: string;
  }
): Promise<boolean> {
  if (!isAgencyAdminUser(user)) return false;
  const docId = sanitizeDocId(article.id, 'upd');
  const path = `frontpage_updates/${docId}`;
  const docRef = doc(db, 'frontpage_updates', docId);
  try {
    const existing = await getDoc(docRef);
    const cleanTags = (article.tags && article.tags.length > 0 ? article.tags : [article.category || 'World'])
      .slice(0, 10)
      .map((t) => clampStr(t, 40, 'News'));
    await setDoc(docRef, {
      id: docId,
      title: clampStr(article.title, 240, 'News Hub 24+ Dispatch'),
      deck: clampStr(article.deck, 800, 'Editorial dispatch from News Hub 24+.'),
      ...(article.body ? { body: clampStr(article.body, 20000) } : {}),
      category: clampStr(article.category, 64, 'World'),
      author: clampStr(article.author, 120, 'News Hub 24+ Desk'),
      authorUid: existing.exists() ? existing.data().authorUid : user.uid,
      ...(article.imageUrl ? { imageUrl: clampStr(article.imageUrl, 512) } : {}),
      ...(article.source ? { source: clampStr(article.source, 160) } : {}),
      ...(article.url ? { url: clampStr(article.url, 512) } : {}),
      tags: cleanTags,
      status: article.breaking ? 'breaking' : 'published',
      publishedAt: clampStr(article.publishedAt || new Date().toISOString(), 64),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// 4. DYNAMIC GLOBAL SEO SETTINGS
// ==========================================

export interface GlobalSeoSettings {
  title: string;
  description: string;
  news_keywords: string;
  author: string;
  ogTitle?: string;
  ogDescription?: string;
  canonicalUrl?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export async function loadSeoSettingsFromFirestore(): Promise<GlobalSeoSettings | null> {
  const path = 'seo_settings/global';
  try {
    const snap = await getDoc(doc(db, 'seo_settings', 'global'));
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;
    return {
      title: String(raw.title || ''),
      description: String(raw.description || ''),
      news_keywords: String(raw.news_keywords || ''),
      author: String(raw.author || ''),
      ogTitle: raw.ogTitle ? String(raw.ogTitle) : undefined,
      ogDescription: raw.ogDescription ? String(raw.ogDescription) : undefined,
      canonicalUrl: raw.canonicalUrl ? String(raw.canonicalUrl) : undefined
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveSeoSettingsToFirestore(
  user: User,
  settings: GlobalSeoSettings
): Promise<boolean> {
  if (!isAgencyAdminUser(user)) return false;
  const path = 'seo_settings/global';
  const docRef = doc(db, 'seo_settings', 'global');
  try {
    const existing = await getDoc(docRef);
    const basePayload = {
      title: clampStr(settings.title, 160, 'News Hub 24+'),
      description: clampStr(settings.description, 400, 'Official global news and media agency.'),
      news_keywords: clampStr(settings.news_keywords, 400, 'newshub24plus.com, News Hub 24+'),
      author: clampStr(settings.author, 120, 'News Hub 24+ Editorial Desk'),
      ...(settings.ogTitle ? { ogTitle: clampStr(settings.ogTitle, 160) } : {}),
      ...(settings.ogDescription ? { ogDescription: clampStr(settings.ogDescription, 400) } : {}),
      ...(settings.canonicalUrl ? { canonicalUrl: clampStr(settings.canonicalUrl, 300) } : {}),
      updatedByUid: user.uid,
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(docRef, basePayload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// 5. CREATOR MILESTONE & WITHDRAWAL NOTIFICATIONS
// ==========================================

export type CreatorNotificationKind =
  | 'daily_verified_milestone'
  | 'daily_total_milestone'
  | 'withdrawal_processed'
  | 'verified_settlement';

export interface CreatorNotificationFirestoreRecord {
  id: string;
  ownerUid: string;
  type: CreatorNotificationKind;
  title: string;
  message: string;
  metricDate: string;
  actualAmountUsd: number;
  thresholdUsd?: number;
  verifiedRealFunds: boolean;
  referenceId?: string;
  read: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export async function syncCreatorNotificationToFirestore(
  user: User,
  notification: {
    id: string;
    type: CreatorNotificationKind;
    title: string;
    message: string;
    metricDate: string;
    actualAmountUsd: number;
    thresholdUsd?: number;
    verifiedRealFunds: boolean;
    referenceId?: string;
    read: boolean;
  }
): Promise<boolean> {
  if (!user.emailVerified) return false;
  const docId = sanitizeDocId(notification.id, 'ntf');
  const path = `creator_notifications/${docId}`;
  const docRef = doc(db, 'creator_notifications', docId);
  try {
    const existing = await getDoc(docRef);
    const cleanActual = Math.max(0, Math.min(10000000, Number(notification.actualAmountUsd.toFixed(2))));
    const cleanThreshold =
      typeof notification.thresholdUsd === 'number' && notification.thresholdUsd >= 1
        ? Math.min(10000000, Number(notification.thresholdUsd.toFixed(2)))
        : undefined;

    if (!existing.exists()) {
      await setDoc(docRef, {
        id: docId,
        ownerUid: user.uid,
        type: notification.type,
        title: clampStr(notification.title, 160, 'Creator Revenue Alert'),
        message: clampStr(notification.message, 400, 'Creator alert recorded.'),
        metricDate: clampStr(notification.metricDate || new Date().toISOString().slice(0, 10), 20),
        actualAmountUsd: cleanActual,
        ...(typeof cleanThreshold === 'number' ? { thresholdUsd: cleanThreshold } : {}),
        verifiedRealFunds: Boolean(notification.verifiedRealFunds),
        ...(notification.referenceId ? { referenceId: clampStr(notification.referenceId, 128) } : {}),
        read: Boolean(notification.read),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return true;
    }

    const existingData = existing.data() as CreatorNotificationFirestoreRecord;
    if (Boolean(existingData.read) !== Boolean(notification.read)) {
      await updateDoc(docRef, {
        read: Boolean(notification.read),
        updatedAt: serverTimestamp()
      });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadCreatorNotificationsFromFirestore(
  uid: string
): Promise<CreatorNotificationFirestoreRecord[]> {
  const path = 'creator_notifications';
  try {
    const q = query(
      collection(db, path),
      where('ownerUid', '==', uid),
      limit(40)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as CreatorNotificationFirestoreRecord;
      const createdIso =
        raw.createdAt && typeof raw.createdAt === 'object' && 'toDate' in raw.createdAt
          ? raw.createdAt.toDate().toISOString()
          : typeof raw.createdAt === 'string'
            ? raw.createdAt
            : new Date().toISOString();
      return {
        ...raw,
        createdAt: createdIso
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ==========================================
// 6. GLOBAL KYC, REMITTANCE, AIRTIME & *789# USSD
// ==========================================

export type SupportedContinent = 'Africa' | 'Europe' | 'North America' | 'Asia & Middle East';

function normalizeContinent(value: string): SupportedContinent {
  if (
    value === 'Africa' ||
    value === 'Europe' ||
    value === 'North America' ||
    value === 'Asia & Middle East'
  ) {
    return value;
  }
  return 'Africa';
}

export async function syncKycProfileToFirestore(
  user: User,
  profile: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    nationality: string;
    countryOfResidence: string;
    continent: string;
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
  }
): Promise<boolean> {
  if (!user.emailVerified) return false;
  const docId = sanitizeDocId(profile.id, 'kyc');
  const path = `customer_kyc_profiles/${docId}`;
  const docRef = doc(db, 'customer_kyc_profiles', docId);
  try {
    const existing = await getDoc(docRef);
    const cleanPhone = clampStr(profile.phone || '0557711975', 24, '+2330000000');
    const safePhone = cleanPhone.length >= 7 ? cleanPhone : '+2330000000';
    const cleanDob = clampStr(profile.dateOfBirth || '1990-01-01', 20, '1990-01-01');
    const safeDob = cleanDob.length >= 8 ? cleanDob : '1990-01-01';
    const cleanAddr = clampStr(profile.residentialAddress || 'Accra Digital Center', 200, 'Verified Address');
    const safeAddr = cleanAddr.length >= 4 ? cleanAddr : 'Verified Address';
    const cleanPurpose = clampStr(profile.purposeOfTransaction || 'Digital media & remittance', 200, 'Digital services');
    const safePurpose = cleanPurpose.length >= 3 ? cleanPurpose : 'Digital services';
    const limitUsd = Math.max(100, Math.min(50000, Number(profile.dailyLimitUsd) || 1000));

    if (!existing.exists()) {
      await setDoc(docRef, {
        id: docId,
        ownerUid: user.uid,
        fullName: clampStr(profile.fullName, 120, 'Verified Customer'),
        email: clampStr(profile.email || user.email || 'user@newshub24plus.com', 160, 'user@newshub24plus.com'),
        phone: safePhone,
        nationality: clampStr(profile.nationality, 64, 'Ghana'),
        countryOfResidence: clampStr(profile.countryOfResidence, 64, 'Ghana'),
        continent: normalizeContinent(profile.continent),
        dateOfBirth: safeDob,
        idType: profile.idType,
        idNumberMasked: clampStr(profile.idNumberMasked || '****0000', 64, '****0000'),
        residentialAddress: safeAddr,
        city: clampStr(profile.city, 80, 'Accra'),
        occupation: clampStr(profile.occupation, 100, 'Creator & Entrepreneur'),
        sourceOfFunds: profile.sourceOfFunds,
        purposeOfTransaction: safePurpose,
        verificationTier: profile.verificationTier,
        status: profile.status,
        dailyLimitUsd: limitUsd,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(docRef, {
        fullName: clampStr(profile.fullName, 120, 'Verified Customer'),
        email: clampStr(profile.email || user.email || 'user@newshub24plus.com', 160, 'user@newshub24plus.com'),
        phone: safePhone,
        nationality: clampStr(profile.nationality, 64, 'Ghana'),
        countryOfResidence: clampStr(profile.countryOfResidence, 64, 'Ghana'),
        continent: normalizeContinent(profile.continent),
        residentialAddress: safeAddr,
        city: clampStr(profile.city, 80, 'Accra'),
        occupation: clampStr(profile.occupation, 100, 'Creator & Entrepreneur'),
        sourceOfFunds: profile.sourceOfFunds,
        purposeOfTransaction: safePurpose,
        updatedAt: serverTimestamp()
      });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncRemittanceTransferToFirestore(
  user: User,
  transfer: {
    mtcn: string;
    customerKycId: string;
    senderName: string;
    senderEmail: string;
    senderPhone: string;
    senderCountry: string;
    senderContinent: string;
    senderCurrency: string;
    recipientName: string;
    recipientPhone: string;
    recipientCountry: string;
    recipientContinent: string;
    recipientCurrency: string;
    corridorId:
      | 'africa_domestic'
      | 'intra_africa'
      | 'africa_europe'
      | 'africa_north_america'
      | 'africa_asia_mena'
      | 'intercontinental_global';
    corridorLabel: string;
    payoutMethod: 'mobile_money' | 'bank_deposit' | 'cash_pickup' | 'newshub_wallet' | 'ussd_789';
    paymentRail: string;
    sendAmountUsd: number;
    totalFeeUsd: number;
    totalChargedUsd: number;
    receiveAmountLocal: number;
    pickupCode: string;
    status: 'Ready for Pickup' | 'In Transit' | 'Collected / Settled' | 'Reversed';
    settlementMode: 'live_gateway' | 'verified_corridor_ledger' | 'ussd_789';
  }
): Promise<boolean> {
  if (!user.emailVerified) return false;
  const docId = sanitizeDocId(transfer.mtcn, 'NH24MTCN');
  const path = `remittance_transfers/${docId}`;
  const docRef = doc(db, 'remittance_transfers', docId);
  try {
    const existing = await getDoc(docRef);
    const sendUsd = Math.max(1, Math.min(25000, Number(transfer.sendAmountUsd.toFixed(2))));
    const feeUsd = Math.max(0, Math.min(5000, Number(transfer.totalFeeUsd.toFixed(2))));
    const chargedUsd = Math.max(sendUsd, Math.min(30000, Number((sendUsd + feeUsd).toFixed(2))));
    const receiveLocal = Math.max(0, Math.min(500000000, Number(transfer.receiveAmountLocal.toFixed(2))));

    if (!existing.exists()) {
      await setDoc(docRef, {
        mtcn: docId,
        ownerUid: user.uid,
        customerKycId: clampStr(transfer.customerKycId || 'kyc_standard', 128, 'kyc_standard'),
        senderName: clampStr(transfer.senderName, 120, 'Verified Sender'),
        senderEmail: clampStr(transfer.senderEmail || user.email || 'user@newshub24plus.com', 160, 'user@newshub24plus.com'),
        senderPhone: clampStr(transfer.senderPhone || '+2330000000', 24, '+2330000000'),
        senderCountry: clampStr(transfer.senderCountry, 64, 'Ghana'),
        senderContinent: normalizeContinent(transfer.senderContinent),
        senderCurrency: clampStr(transfer.senderCurrency || 'GHS', 8, 'GHS'),
        recipientName: clampStr(transfer.recipientName, 120, 'Recipient'),
        recipientPhone: clampStr(transfer.recipientPhone || '+2330000000', 24, '+2330000000'),
        recipientCountry: clampStr(transfer.recipientCountry, 64, 'Nigeria'),
        recipientContinent: normalizeContinent(transfer.recipientContinent),
        recipientCurrency: clampStr(transfer.recipientCurrency || 'NGN', 8, 'NGN'),
        corridorId: transfer.corridorId,
        corridorLabel: clampStr(transfer.corridorLabel, 120, 'Global Corridor'),
        payoutMethod: transfer.payoutMethod,
        paymentRail: clampStr(transfer.paymentRail, 64, 'ghana-pay'),
        sendAmountUsd: sendUsd,
        totalFeeUsd: feeUsd,
        totalChargedUsd: chargedUsd,
        receiveAmountLocal: receiveLocal,
        pickupCode: clampStr(transfer.pickupCode || 'NH24PICK', 32, 'NH24PICK'),
        status: transfer.status,
        settlementMode: transfer.settlementMode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else if (transfer.status === 'Collected / Settled') {
      await updateDoc(docRef, {
        status: 'Collected / Settled',
        updatedAt: serverTimestamp()
      });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncAirtimeOrderToFirestore(
  user: User,
  order: {
    id: string;
    buyerName: string;
    buyerEmail: string;
    recipientPhone: string;
    countryCode: string;
    countryName: string;
    continent: string;
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
  }
): Promise<boolean> {
  if (!user.emailVerified) return false;
  const docId = sanitizeDocId(order.id, 'air');
  const path = `airtime_orders/${docId}`;
  const docRef = doc(db, 'airtime_orders', docId);
  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) return true;
    const amtUsd = Math.max(1, Math.min(500, Number(order.amountUsd.toFixed(2))));
    const feeUsd = Math.max(0, Math.min(100, Number(order.feeUsd.toFixed(2))));
    const totalUsd = Math.max(amtUsd, Math.min(600, Number((amtUsd + feeUsd).toFixed(2))));
    await setDoc(docRef, {
      id: docId,
      ownerUid: user.uid,
      buyerName: clampStr(order.buyerName, 120, 'Airtime Buyer'),
      buyerEmail: clampStr(order.buyerEmail || user.email || 'user@newshub24plus.com', 160, 'user@newshub24plus.com'),
      recipientPhone: clampStr(order.recipientPhone || '+2330000000', 24, '+2330000000'),
      countryCode: clampStr(order.countryCode || 'GH', 8, 'GH'),
      countryName: clampStr(order.countryName || 'Ghana', 80, 'Ghana'),
      continent: normalizeContinent(order.continent),
      carrier: clampStr(order.carrier || 'Global Carrier', 64, 'Global Carrier'),
      amountUsd: amtUsd,
      feeUsd,
      totalChargedUsd: totalUsd,
      localCurrency: clampStr(order.localCurrency || 'USD', 8, 'USD'),
      localTopupAmount: Math.max(0, Math.min(10000000, Number(order.localTopupAmount.toFixed(2)))),
      paymentRail: clampStr(order.paymentRail || 'ussd-789', 64, 'ussd-789'),
      channel: order.channel,
      status: order.status,
      providerRef: clampStr(order.providerRef || docId, 64, docId),
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncUssdReceiptToFirestore(
  user: User,
  receipt: {
    id: string;
    shortcode?: string;
    msisdn: string;
    service: string;
    amountUsd: number;
    feeUsd: number;
    amountGhs: number;
    reference: string;
    summary: string;
  }
): Promise<boolean> {
  if (!user.emailVerified) return false;
  const docId = sanitizeDocId(receipt.id, 'ussd');
  const path = `ussd_receipts/${docId}`;
  const docRef = doc(db, 'ussd_receipts', docId);
  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) return true;
    await setDoc(docRef, {
      id: docId,
      ownerUid: user.uid,
      shortcode: clampStr(receipt.shortcode || '*789#', 16, '*789#'),
      msisdn: clampStr(receipt.msisdn || '0557711975', 24, '0557711975'),
      service: clampStr(receipt.service || '*789# Universal Service', 120, '*789# Service'),
      amountUsd: Math.max(0, Math.min(50000, Number((receipt.amountUsd || 0).toFixed(2)))),
      feeUsd: Math.max(0, Math.min(5000, Number((receipt.feeUsd || 0).toFixed(2)))),
      amountGhs: Math.max(0, Math.min(1000000, Number((receipt.amountGhs || 0).toFixed(2)))),
      reference: clampStr(receipt.reference || docId, 64, docId),
      summary: clampStr(receipt.summary || '*789# transaction settled', 300, '*789# settled'),
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// 7. COMMUNITY FOLLOWERS, REACTIONS & SYNDICATION
// ==========================================

export type CommunityReactionType =
  | 'insightful'
  | 'support'
  | 'celebrate'
  | 'curious'
  | 'shareworthy';

export async function syncCommunityFollowerToFirestore(
  user: User,
  follower: {
    id: string;
    displayName: string;
    handle: string;
    country: string;
    continent: string;
    preferredDesks: string[];
    status: 'following' | 'paused';
  }
): Promise<boolean> {
  if (!user.emailVerified) return false;
  const docId = sanitizeDocId(follower.id, 'flw');
  const path = `community_followers/${docId}`;
  const docRef = doc(db, 'community_followers', docId);
  try {
    const existing = await getDoc(docRef);
    const desks = (follower.preferredDesks.length > 0 ? follower.preferredDesks : ['World'])
      .slice(0, 6)
      .map((d) => clampStr(d, 40, 'World'));
    const cleanHandle = clampStr(
      follower.handle.startsWith('@') ? follower.handle : `@${follower.handle}`,
      40,
      '@reader'
    );

    if (!existing.exists()) {
      await setDoc(docRef, {
        id: docId,
        ownerUid: user.uid,
        displayName: clampStr(follower.displayName, 80, 'News Hub Reader'),
        handle: cleanHandle.length >= 2 ? cleanHandle : '@reader',
        country: clampStr(follower.country, 64, 'Ghana'),
        continent: normalizeContinent(follower.continent),
        preferredDesks: desks,
        status: follower.status,
        verifiedMember: true,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(docRef, {
        displayName: clampStr(follower.displayName, 80, 'News Hub Reader'),
        handle: cleanHandle.length >= 2 ? cleanHandle : '@reader',
        country: clampStr(follower.country, 64, 'Ghana'),
        continent: normalizeContinent(follower.continent),
        preferredDesks: desks,
        status: follower.status,
        updatedAt: serverTimestamp()
      });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncPostReactionToFirestore(
  user: User,
  reaction: {
    id: string;
    articleId: string;
    reactionType: CommunityReactionType;
    sourcePlatform: string;
    reactorLabel: string;
  }
): Promise<boolean> {
  if (!user.emailVerified) return false;
  const docId = sanitizeDocId(reaction.id, 'rct');
  const articleDocId = sanitizeDocId(reaction.articleId, 'art');
  const path = `post_reactions/${docId}`;
  const docRef = doc(db, 'post_reactions', docId);
  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) return true;
    await setDoc(docRef, {
      id: docId,
      ownerUid: user.uid,
      articleId: articleDocId,
      reactionType: reaction.reactionType,
      sourcePlatform: clampStr(reaction.sourcePlatform || 'website', 40, 'website'),
      reactorLabel: clampStr(reaction.reactorLabel || user.displayName || 'Verified Reader', 80, 'Verified Reader'),
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncCrossPlatformSyndicationToFirestore(
  user: User,
  syndication: {
    id: string;
    articleId: string;
    articleTitle: string;
    category: string;
    platforms: string[];
    canonicalUrl: string;
    summaryNote: string;
    status: 'published' | 'partial';
  }
): Promise<boolean> {
  if (!isAgencyAdminUser(user)) return false;
  const docId = sanitizeDocId(syndication.id, 'syn');
  const articleDocId = sanitizeDocId(syndication.articleId, 'art');
  const path = `cross_platform_syndications/${docId}`;
  const docRef = doc(db, 'cross_platform_syndications', docId);
  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) return true;
    const platformsList = (syndication.platforms.length > 0 ? syndication.platforms : ['website'])
      .slice(0, 10)
      .map((p) => clampStr(p, 40, 'website'));
    await setDoc(docRef, {
      id: docId,
      ownerUid: user.uid,
      articleId: articleDocId,
      articleTitle: clampStr(syndication.articleTitle, 240, 'News Hub 24+ Dispatch'),
      category: clampStr(syndication.category, 64, 'World'),
      platforms: platformsList,
      canonicalUrl: clampStr(syndication.canonicalUrl, 400, 'https://newshub24plus.com'),
      summaryNote: clampStr(syndication.summaryNote, 300, 'Syndicated across News Hub 24+ channels'),
      status: syndication.status,
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ==========================================
// 8. AIRTIME BUNDLE-TO-REVENUE CONVERSIONS
// ==========================================

export interface AirtimeBundleConversionFirestoreRecord {
  id: string;
  ownerUid: string;
  publicationId: string;
  publicationTitle: string;
  publicationType: 'article' | 'video_reel' | 'investigation' | 'multi_publication_batch';
  carrierCode: string;
  carrierLabel: string;
  channel: 'website' | 'android_apk' | 'base44_app';
  watchMinutes: number;
  bundleMbSpent: number;
  airtimeSpendUsd: number;
  creatorNetUsd: number;
  equivalentSol: number;
  withdrawGhs: number;
  status: 'Verified & Credited' | 'Converted & Withdrawn';
  settlementMode: 'live_configured' | 'verified_treasury_ledger';
  withdrawalId?: string;
  note: string;
  createdAt?: Timestamp | string;
}

export async function syncAirtimeBundleConversionToFirestore(
  user: User,
  conversion: {
    id: string;
    publicationId: string;
    publicationTitle: string;
    publicationType: 'article' | 'video_reel' | 'investigation' | 'multi_publication_batch';
    carrierCode: string;
    carrierLabel: string;
    channel: 'website' | 'android_apk' | 'base44_app';
    watchMinutes: number;
    bundleMbSpent: number;
    airtimeSpendUsd: number;
    creatorNetUsd: number;
    equivalentSol: number;
    withdrawGhs: number;
    status: 'Verified & Credited' | 'Converted & Withdrawn';
    settlementMode: 'live_configured' | 'verified_treasury_ledger';
    withdrawalId?: string;
    note: string;
  }
): Promise<boolean> {
  if (!user.emailVerified) return false;
  const docId = sanitizeDocId(conversion.id, 'ab');
  const pubDocId = sanitizeDocId(conversion.publicationId, 'pub');
  const path = `airtime_bundle_conversions/${docId}`;
  const docRef = doc(db, 'airtime_bundle_conversions', docId);
  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) return true;
    await setDoc(docRef, {
      id: docId,
      ownerUid: user.uid,
      publicationId: pubDocId.length >= 2 ? pubDocId : 'nh24-001',
      publicationTitle: clampStr(conversion.publicationTitle, 240, 'News Hub 24+ Publication'),
      publicationType: conversion.publicationType,
      carrierCode: clampStr(conversion.carrierCode, 32, 'MTN_GH'),
      carrierLabel: clampStr(conversion.carrierLabel, 120, 'MTN Ghana'),
      channel: conversion.channel,
      watchMinutes: Math.max(0, Math.min(100000, Number(conversion.watchMinutes.toFixed(1)))),
      bundleMbSpent: Math.max(0, Math.min(1000000, Number(conversion.bundleMbSpent.toFixed(2)))),
      airtimeSpendUsd: Math.max(0, Math.min(50000, Number(conversion.airtimeSpendUsd.toFixed(2)))),
      creatorNetUsd: Math.max(0.01, Math.min(500000, Number(conversion.creatorNetUsd.toFixed(2)))),
      equivalentSol: Math.max(0, Math.min(50000, Number(conversion.equivalentSol.toFixed(4)))),
      withdrawGhs: Math.max(0, Math.min(10000000, Number(conversion.withdrawGhs.toFixed(2)))),
      status: conversion.status,
      settlementMode: conversion.settlementMode,
      ...(conversion.withdrawalId ? { withdrawalId: clampStr(conversion.withdrawalId, 128) } : {}),
      note: clampStr(conversion.note, 240, 'Airtime bundle watch revenue conversion'),
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function loadAirtimeBundleConversionsFromFirestore(
  uid: string
): Promise<AirtimeBundleConversionFirestoreRecord[]> {
  const path = 'airtime_bundle_conversions';
  try {
    const q = query(
      collection(db, path),
      where('ownerUid', '==', uid),
      limit(40)
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => {
      const raw = d.data() as AirtimeBundleConversionFirestoreRecord;
      const createdIso =
        raw.createdAt && typeof raw.createdAt === 'object' && 'toDate' in raw.createdAt
          ? raw.createdAt.toDate().toISOString()
          : typeof raw.createdAt === 'string'
            ? raw.createdAt
            : new Date().toISOString();
      return {
        ...raw,
        createdAt: createdIso
      };
    });
    rows.sort((a, b) => {
      const ta = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0;
      const tb = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
    return rows;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ==========================================
// 9. BASE44 MOTHER APP CONNECTION & REVENUE
// ==========================================

export interface MotherAppConnectionFirestoreRecord {
  id: string;
  ownerUid: string;
  motherAppUrl: string;
  motherOrigin: string;
  storyId: string;
  appName: string;
  lastHandshakeOk: boolean;
  lastHandshakeStatus?: number;
  verifiedPageTitle?: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface MotherAppRevenueEventFirestoreRecord {
  id: string;
  ownerUid: string;
  motherAppUrl: string;
  storyId: string;
  streamType:
    | 'sponsored_story_slot'
    | 'reader_traffic_yield'
    | 'subscription_referral'
    | 'reader_tip'
    | 'live_checkout_settlement'
    | 'webhook_event';
  sourceLabel: string;
  grossUsd: number;
  creatorNetUsd: number;
  withdrawGhs: number;
  equivalentSol: number;
  settlementMode: 'live_configured' | 'verified_treasury_ledger';
  withdrawalId?: string;
  note: string;
  createdAt?: Timestamp | string;
}

export async function syncMotherAppConnectionToFirestore(
  user: User,
  conn: {
    motherAppUrl: string;
    motherOrigin: string;
    storyId: string;
    appName: string;
    lastHandshakeOk: boolean;
    lastHandshakeStatus?: number | null;
    verifiedPageTitle?: string | null;
  }
): Promise<boolean> {
  if (!user.emailVerified || !isAgencyAdminUser(user)) return false;
  const docId = 'base44_primary';
  const path = `mother_app_connections/${docId}`;
  const docRef = doc(db, 'mother_app_connections', docId);
  const storyId = sanitizeDocId(conn.storyId, 'story');

  const payload = {
    id: docId,
    ownerUid: user.uid,
    motherAppUrl: clampStr(conn.motherAppUrl, 360, 'https://aloof-daily-news-pulse.base44.app/story/6b04f190aa908b27ce284a57'),
    motherOrigin: clampStr(conn.motherOrigin, 180, 'https://aloof-daily-news-pulse.base44.app'),
    storyId: storyId.length >= 4 ? storyId : '6b04f190aa908b27ce284a57',
    appName: clampStr(conn.appName, 140, 'News Hub 24+ Base44 Mother App'),
    lastHandshakeOk: Boolean(conn.lastHandshakeOk),
    ...(typeof conn.lastHandshakeStatus === 'number' &&
    conn.lastHandshakeStatus >= 100 &&
    conn.lastHandshakeStatus <= 599
      ? { lastHandshakeStatus: Math.round(conn.lastHandshakeStatus) }
      : {}),
    ...(conn.verifiedPageTitle ? { verifiedPageTitle: clampStr(conn.verifiedPageTitle, 160) } : {}),
    updatedAt: serverTimestamp()
  };

  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      await updateDoc(docRef, {
        motherAppUrl: payload.motherAppUrl,
        motherOrigin: payload.motherOrigin,
        storyId: payload.storyId,
        appName: payload.appName,
        lastHandshakeOk: payload.lastHandshakeOk,
        ...(payload.lastHandshakeStatus !== undefined
          ? { lastHandshakeStatus: payload.lastHandshakeStatus }
          : {}),
        ...(payload.verifiedPageTitle !== undefined
          ? { verifiedPageTitle: payload.verifiedPageTitle }
          : {}),
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp()
      });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncMotherAppRevenueEventToFirestore(
  user: User,
  evt: {
    id: string;
    motherAppUrl: string;
    storyId: string;
    streamType: MotherAppRevenueEventFirestoreRecord['streamType'];
    sourceLabel: string;
    grossUsd: number;
    creatorNetUsd: number;
    withdrawGhs: number;
    equivalentSol: number;
    settlementMode: 'live_configured' | 'verified_treasury_ledger';
    withdrawalId?: string;
    note: string;
  }
): Promise<boolean> {
  if (!user.emailVerified) return false;
  const docId = sanitizeDocId(evt.id, 'ma');
  const storyId = sanitizeDocId(evt.storyId, 'story');
  const path = `mother_app_revenue_events/${docId}`;
  const docRef = doc(db, 'mother_app_revenue_events', docId);
  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) return true;
    await setDoc(docRef, {
      id: docId,
      ownerUid: user.uid,
      motherAppUrl: clampStr(evt.motherAppUrl, 360, 'https://aloof-daily-news-pulse.base44.app/story/6b04f190aa908b27ce284a57'),
      storyId: storyId.length >= 4 ? storyId : '6b04f190aa908b27ce284a57',
      streamType: evt.streamType,
      sourceLabel: clampStr(evt.sourceLabel, 140, 'Base44 Mother App'),
      grossUsd: Math.max(0.02, Math.min(1000000, Number(evt.grossUsd.toFixed(2)))),
      creatorNetUsd: Math.max(0.01, Math.min(1000000, Number(evt.creatorNetUsd.toFixed(2)))),
      withdrawGhs: Math.max(0, Math.min(10000000, Number(evt.withdrawGhs.toFixed(2)))),
      equivalentSol: Math.max(0, Math.min(50000, Number(evt.equivalentSol.toFixed(4)))),
      settlementMode: evt.settlementMode,
      ...(evt.withdrawalId ? { withdrawalId: clampStr(evt.withdrawalId, 128) } : {}),
      note: clampStr(evt.note, 240, 'Mother App verified monetization settlement'),
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function loadMotherAppRevenueEventsFromFirestore(
  uid: string
): Promise<MotherAppRevenueEventFirestoreRecord[]> {
  const path = 'mother_app_revenue_events';
  try {
    const q = query(collection(db, path), where('ownerUid', '==', uid), limit(40));
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => {
      const raw = d.data() as MotherAppRevenueEventFirestoreRecord;
      const createdIso =
        raw.createdAt && typeof raw.createdAt === 'object' && 'toDate' in raw.createdAt
          ? raw.createdAt.toDate().toISOString()
          : typeof raw.createdAt === 'string'
            ? raw.createdAt
            : new Date().toISOString();
      return {
        ...raw,
        createdAt: createdIso
      };
    });
    rows.sort((a, b) => {
      const ta = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0;
      const tb = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
    return rows;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ==========================================
// 11. VERIFIABLE SHA-256 LEDGER & MTN MOMO WITHDRAWAL ORDERS
// ==========================================

export interface VerifiableLedgerRecordFirestore {
  id: string;
  ownerUid: string;
  seq: number;
  recordType:
    | 'GENESIS_VERIFIED_OPENING'
    | 'REVENUE_CREDIT'
    | 'CREATOR_EARNINGS_CLAIM'
    | 'AIRTIME_CONVERSION'
    | 'MOMO_WITHDRAWAL'
    | 'PAYOUT_WITHDRAWAL'
    | 'WITHDRAWAL_REVERSAL'
    | 'LEDGER_RECONCILIATION';
  rail: string;
  networkCode: string;
  accountMasked: string;
  amountUsd: number;
  deltaUsd: number;
  amountLocal?: number;
  currencyLocal?: string;
  balanceBeforeUsd: number;
  balanceAfterUsd: number;
  referenceId: string;
  settlementMode: 'live_configured' | 'live_treasury_ledger';
  note: string;
  prevHash: string;
  recordHash: string;
  createdAt?: Timestamp | string;
}

export interface MomoWithdrawalOrderFirestore {
  id: string;
  ownerUid: string;
  destinationLabel: string;
  maskedAccount: string;
  networkCode: string;
  currency: string;
  amountUsd: number;
  feeUsd: number;
  netSettledUsd: number;
  amountGhs: number;
  settlementMode: 'live_configured' | 'live_treasury_ledger';
  settlementReference: string;
  status: 'Disbursed' | 'Processing (1-2 Business Days)' | 'Reversed';
  verifiableRecordHash: string;
  note: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;

export async function syncVerifiableRecordToFirestore(
  user: User,
  rec: Omit<VerifiableLedgerRecordFirestore, 'ownerUid' | 'createdAt'>
): Promise<boolean> {
  if (!user.emailVerified) return false;
  if (!SHA256_HEX_REGEX.test(rec.prevHash) || !SHA256_HEX_REGEX.test(rec.recordHash)) {
    return false;
  }
  const docId = sanitizeDocId(rec.id, 'vdb');
  const path = `verifiable_ledger_records/${docId}`;
  const docRef = doc(db, 'verifiable_ledger_records', docId);
  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) return true;
    await setDoc(docRef, {
      id: docId,
      ownerUid: user.uid,
      seq: Math.max(1, Math.min(10000000, Math.round(rec.seq))),
      recordType: rec.recordType,
      rail: clampStr(rec.rail, 64, 'live_treasury'),
      networkCode: clampStr(rec.networkCode, 32, 'MTN'),
      accountMasked: clampStr(rec.accountMasked, 80, '•••• 1975'),
      amountUsd: Math.max(0, Math.min(10000000, Number(rec.amountUsd.toFixed(2)))),
      deltaUsd: Math.max(-10000000, Math.min(10000000, Number(rec.deltaUsd.toFixed(2)))),
      ...(typeof rec.amountLocal === 'number' && Number.isFinite(rec.amountLocal)
        ? { amountLocal: Math.max(0, Math.min(500000000, Number(rec.amountLocal.toFixed(2)))) }
        : {}),
      ...(rec.currencyLocal ? { currencyLocal: clampStr(rec.currencyLocal, 8, 'GHS') } : {}),
      balanceBeforeUsd: Math.max(0, Math.min(100000000, Number(rec.balanceBeforeUsd.toFixed(2)))),
      balanceAfterUsd: Math.max(0, Math.min(100000000, Number(rec.balanceAfterUsd.toFixed(2)))),
      referenceId: clampStr(rec.referenceId, 128, docId),
      settlementMode: rec.settlementMode,
      note: clampStr(rec.note, 240, 'Verified live production entry'),
      prevHash: rec.prevHash,
      recordHash: rec.recordHash,
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncMomoWithdrawalOrderToFirestore(
  user: User,
  order: Omit<MomoWithdrawalOrderFirestore, 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<boolean> {
  if (!user.emailVerified) return false;
  if (!SHA256_HEX_REGEX.test(order.verifiableRecordHash)) {
    return false;
  }
  const docId = sanitizeDocId(order.id, 'momo');
  const path = `momo_withdrawal_orders/${docId}`;
  const docRef = doc(db, 'momo_withdrawal_orders', docId);
  try {
    const existing = await getDoc(docRef);
    const amountUsd = Math.max(0.01, Math.min(1000000, Number(order.amountUsd.toFixed(2))));
    const feeUsd = Math.max(0, Math.min(50000, Number(order.feeUsd.toFixed(2))));
    const netSettledUsd = Math.max(0.01, Math.min(amountUsd, Number(order.netSettledUsd.toFixed(2))));
    if (existing.exists()) {
      return true;
    }
    await setDoc(docRef, {
      id: docId,
      ownerUid: user.uid,
      destinationLabel: clampStr(order.destinationLabel, 120, 'MTN MoMo Ghana'),
      maskedAccount: clampStr(order.maskedAccount, 64, '•••• 1975'),
      networkCode: clampStr(order.networkCode, 32, 'MTN'),
      currency: clampStr(order.currency, 8, 'GHS'),
      amountUsd,
      feeUsd,
      netSettledUsd,
      amountGhs: Math.max(0, Math.min(100000000, Number(order.amountGhs.toFixed(2)))),
      settlementMode: order.settlementMode,
      settlementReference: clampStr(order.settlementReference, 128, docId),
      status: order.status,
      verifiableRecordHash: order.verifiableRecordHash,
      note: clampStr(order.note, 240, 'Express MTN MoMo withdrawal'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadVerifiableRecordsFromFirestore(
  uid: string
): Promise<VerifiableLedgerRecordFirestore[]> {
  const path = 'verifiable_ledger_records';
  try {
    const q = query(collection(db, path), where('ownerUid', '==', uid), limit(50));
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => {
      const raw = d.data() as VerifiableLedgerRecordFirestore;
      const createdIso =
        raw.createdAt && typeof raw.createdAt === 'object' && 'toDate' in raw.createdAt
          ? raw.createdAt.toDate().toISOString()
          : typeof raw.createdAt === 'string'
            ? raw.createdAt
            : new Date().toISOString();
      return {
        ...raw,
        createdAt: createdIso
      };
    });
    rows.sort((a, b) => b.seq - a.seq);
    return rows;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}



