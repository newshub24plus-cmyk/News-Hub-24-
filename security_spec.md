# News Hub 24+ Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every unspecified collection or path is denied by `match /{document=**} { allow read, write: if false; }`.
2. **Verified Identity**: All authenticated writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Admin Authority**: Administrative operations (`admins`, `frontpage_updates` mutations, `seo_settings` mutations, viewing other users' `ghanapay_accounts` or `transaction_logs`) require either verified bootstrap owner email `newshub24plus@gmail.com` or an existing `/admins/$(request.auth.uid)` record. Self-assignment to `/admins` is impossible.
4. **Front-Page Updates (`frontpage_updates/{updateId}`)**:
   - Publicly readable (`get`, `list`) since they represent published public news dispatches without PII.
   - Only verified admins may create, update, or delete dispatches; `tags` is strictly bounded (`1..10` items, first element string `<= 40` chars); every string has strict `.size()` bounds; `createdAt` is immutable and equals `request.time` on creation.
5. **Dynamic SEO Settings (`seo_settings/{settingId}`)**:
   - Single-document public `get` allowed (so search crawlers & visitors receive global meta configuration without PII); `list` disabled; writes strictly restricted to verified admins with exact allowed keys and bounded sizes.
6. **GhanaPay Login Accounts (`ghanapay_accounts/{userId}`)**:
   - Contains PII (`email`, `momoNumber`). Strictly isolated to `isOwner(userId)` or `isAdmin()` for `get`; `list` enforces `existing().uid == request.auth.uid` (zero `get()`/`exists()` inside `allow list`).
   - Users cannot escalate roles, change `uid`, or forge `createdAt`.
7. **Transaction Logs (`transaction_logs/{txId}`)**:
   - Contains financial PII (`payerEmail`, `payerPhone`, `recipientPhone`). Strictly isolated to `existing().ownerUid == request.auth.uid` or admin.
   - Creation requires an existing `ghanapay_accounts/$(incoming().ownerUid)` record (relational consistency check) and enforces `incoming().ownerUid == request.auth.uid`, `amountGhs > 0`, `totalGhs >= amountGhs`, `currency == 'GHS'`, and `createdAt == request.time`.
   - **Terminal State Locking**: Once `status` reaches `'completed'` or `'reversed'`, non-admins cannot update the log. Financial logs cannot be deleted (`allow delete: if false;`).
8. **Creator Notifications (`creator_notifications/{notificationId}`)**:
   - Strictly owner- and admin-isolated (`existing().ownerUid == request.auth.uid || isAdmin()`).
   - Creation enforces `incoming().ownerUid == request.auth.uid`, valid enum `type`, bounded string lengths, `createdAt == request.time`, and `updatedAt == request.time`.
   - Updates are restricted to marking `read` status with `updatedAt == request.time` and immutable financial/type fields (`id`, `ownerUid`, `type`, `actualAmountUsd`, `createdAt`).

---

## 2. The "Dirty Dozen" Attack Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated Transaction Creation**: Anonymous/unauthenticated user attempts `CREATE /transaction_logs/tx_unauth_01`.
2. **Unverified Email Write**: Signed-in user with `email_verified: false` attempts `CREATE /ghanapay_accounts/{uid}` or `/transaction_logs/{txId}`.
3. **Identity Spoofing on GhanaPay Profile**: Attacker `uid_A` attempts `CREATE /ghanapay_accounts/uid_A` with `uid: "uid_B"`.
4. **Admin Self-Escalation**: Non-admin user `uid_A` attempts `CREATE /admins/uid_A` with `role: "admin"`.
5. **Email Spoofing Attack**: User with `email: "newshub24plus@gmail.com"` and `email_verified: false` attempts `CREATE /seo_settings/global`.
6. **PII Blanket Read on GhanaPay Account**: Signed-in `uid_A` attempts `GET /ghanapay_accounts/uid_B` (another user's MoMo profile).
7. **Collection Scraping List on Transaction Logs**: Signed-in `uid_A` executes an unfiltered `LIST /transaction_logs` query expecting documents belonging to `uid_B`.
8. **Shadow / Ghost Field Injection**: Signed-in `uid_A` attempts `UPDATE /ghanapay_accounts/uid_A` injecting `isSuperAdmin: true` or `balanceGhs: 999999`.
9. **Value Poisoning / Resource Exhaustion**: Attacker attempts `CREATE /frontpage_updates/upd_poison` with a `title` > 240 chars or `tags` array > 10 items.
10. **ID Poisoning**: Attacker attempts `CREATE /transaction_logs/${'a'.repeat(200)}` or path with invalid characters (`tx$bad`).
11. **Terminal State Mutation**: Signed-in `uid_A` attempts `UPDATE /transaction_logs/tx_done` (where `status == 'completed'`) to alter `amountGhs` or `status` back to `'pending'`.
12. **Timestamp Forgery & Orphaned Transaction**: Attacker `uid_A` attempts `CREATE /transaction_logs/tx_orphan` with `createdAt` set to a client-chosen past timestamp OR without an existing `/ghanapay_accounts/uid_A` document.
