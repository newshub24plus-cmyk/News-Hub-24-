/**
 * Security Rules Verification Suite (Dirty Dozen Adversarial Payloads)
 * Documents exact test assertions against Firestore Security Rules for News Hub 24+.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Transaction Creation',
    operation: 'create',
    path: 'transaction_logs/tx_unauth_01',
    auth: null,
    payload: { txRef: 'tx_unauth_01', ownerUid: 'anon', amountGhs: 10 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write to GhanaPay Account',
    operation: 'create',
    path: 'ghanapay_accounts/user_unverified',
    auth: { uid: 'user_unverified', email: 'unverified@example.com', email_verified: false },
    payload: { uid: 'user_unverified', ghanaPayId: 'GHP-1111', momoNumber: '0550000000', network: 'MTN', accountName: 'Test', email: 'unverified@example.com', status: 'active' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on GhanaPay Profile',
    operation: 'create',
    path: 'ghanapay_accounts/user_a',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { uid: 'user_b', ghanaPayId: 'GHP-2222', momoNumber: '0557711975', network: 'MTN', accountName: 'Spoofer', email: 'a@example.com', status: 'active' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Admin Self-Escalation',
    operation: 'create',
    path: 'admins/user_a',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { uid: 'user_a', email: 'a@example.com', role: 'admin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Email Spoofing Attack on Global SEO Settings',
    operation: 'update',
    path: 'seo_settings/global',
    auth: { uid: 'spoofer_uid', email: 'newshub24plus@gmail.com', email_verified: false },
    payload: { title: 'Hijacked', description: 'Hijacked global description', news_keywords: 'spam', author: 'Hacker' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'PII Blanket Read on Another User GhanaPay Account',
    operation: 'get',
    path: 'ghanapay_accounts/user_b',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Unfiltered Collection List on Transaction Logs',
    operation: 'list',
    path: 'transaction_logs',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Shadow / Ghost Field Injection on GhanaPay Update',
    operation: 'update',
    path: 'ghanapay_accounts/user_a',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { momoNumber: '0551234567', isSuperAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Value Poisoning / Oversized String on Front-Page Update',
    operation: 'create',
    path: 'frontpage_updates/upd_poison',
    auth: { uid: 'admin_uid', email: 'newshub24plus@gmail.com', email_verified: true },
    payload: { id: 'upd_poison', title: 'X'.repeat(300) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'ID Poisoning with Oversized or Invalid Document ID',
    operation: 'create',
    path: 'transaction_logs/' + 'a'.repeat(180),
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { txRef: 'bad$id' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Mutation on Completed Transaction Log',
    operation: 'update',
    path: 'transaction_logs/tx_completed_01',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { status: 'pending', amountGhs: 1 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Timestamp Forgery & Orphaned Transaction Log',
    operation: 'create',
    path: 'transaction_logs/tx_orphan_01',
    auth: { uid: 'user_no_wallet', email: 'nowallet@example.com', email_verified: true },
    payload: { txRef: 'tx_orphan_01', ownerUid: 'user_no_wallet', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 13,
    name: 'Cross-Tenant Read on Creator Notifications',
    operation: 'get',
    path: 'creator_notifications/ntf_admin_01',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 14,
    name: 'Tampering with Notification Amount During Read Mark',
    operation: 'update',
    path: 'creator_notifications/ntf_user_a_01',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { read: true, actualAmountUsd: 999999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 15,
    name: 'Immutable Tampering on Airtime Bundle Conversion Audit Record',
    operation: 'update',
    path: 'airtime_bundle_conversions/NH24-AB-84F19',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { creatorNetUsd: 500000, status: 'Converted & Withdrawn' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 16,
    name: 'Non-Admin Mother App Connection Overwrite',
    operation: 'create',
    path: 'mother_app_connections/base44_primary',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { id: 'base44_primary', ownerUid: 'user_a', motherAppUrl: 'https://evil.example.com' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 17,
    name: 'Immutable Tampering on Mother App Revenue Event',
    operation: 'update',
    path: 'mother_app_revenue_events/NH24-MA-BASE01',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { creatorNetUsd: 999999 },
    expectedResult: 'PERMISSION_DENIED',
  },
];
