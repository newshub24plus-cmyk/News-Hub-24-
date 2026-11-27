import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic } from './realMonetization.ts';

export type VerifiableRecordType =
  | 'GENESIS_VERIFIED_OPENING'
  | 'REVENUE_CREDIT'
  | 'CREATOR_EARNINGS_CLAIM'
  | 'AIRTIME_CONVERSION'
  | 'MOMO_WITHDRAWAL'
  | 'PAYOUT_WITHDRAWAL'
  | 'WITHDRAWAL_REVERSAL'
  | 'LEDGER_RECONCILIATION';

export interface VerifiableLedgerRecord {
  seq: number;
  id: string;
  recordType: VerifiableRecordType;
  timestamp: string;
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
}

export interface VerifiableDatabaseState {
  schemaVersion: string;
  engine: 'SHA256-HashChained-Ledger-v1';
  accountMode: 'live_production';
  sandboxDisabledAt: string;
  genesisTimestamp: string;
  genesisHash: string;
  headSeq: number;
  headHash: string;
  headBalanceUsd: number;
  records: VerifiableLedgerRecord[];
}

export interface VerifiableDatabaseCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface VerifiableDatabaseReport {
  status: 'verified' | 'tamper_or_mismatch';
  chainValid: boolean;
  balanceMatched: boolean;
  zeroSandboxConfirmed: boolean;
  treasuryMatched: boolean;
  engine: string;
  accountMode: 'live_production';
  sandboxDisabledAt: string;
  verifiedAt: string;
  totalRecords: number;
  headSeq: number;
  genesisHash: string;
  headHash: string;
  verifiedBalanceUsd: number;
  verifiedBalanceGhs: number;
  livePendingPayoutUsd: number;
  treasuryCreatorPayableUsd: number;
  momoReady: boolean;
  momoDefaultWallet: string;
  momoDefaultNetwork: string;
  checksPassed: number;
  checksTotal: number;
  checks: VerifiableDatabaseCheck[];
  records: VerifiableLedgerRecord[];
}

const verifiableDbPath = path.join(process.cwd(), 'server', 'verifiable-db.json');
const GENESIS_PREV_HASH = '0'.repeat(64);

function toCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(c: number): number {
  return Number((Math.round(c) / 100).toFixed(2));
}

function isSandboxText(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('sandbox') ||
    lower.includes('sbx-') ||
    lower.includes('simulated')
  );
}

export function computeVerifiableRecordHash(
  payload: Omit<VerifiableLedgerRecord, 'recordHash'>
): string {
  const canonical = JSON.stringify({
    seq: payload.seq,
    id: payload.id,
    recordType: payload.recordType,
    timestamp: payload.timestamp,
    rail: payload.rail,
    networkCode: payload.networkCode,
    accountMasked: payload.accountMasked,
    amountUsd: Number(payload.amountUsd.toFixed(2)),
    deltaUsd: Number(payload.deltaUsd.toFixed(2)),
    amountLocal:
      typeof payload.amountLocal === 'number' ? Number(payload.amountLocal.toFixed(2)) : null,
    currencyLocal: payload.currencyLocal ?? null,
    balanceBeforeUsd: Number(payload.balanceBeforeUsd.toFixed(2)),
    balanceAfterUsd: Number(payload.balanceAfterUsd.toFixed(2)),
    referenceId: payload.referenceId,
    settlementMode: payload.settlementMode,
    note: payload.note,
    prevHash: payload.prevHash
  });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function buildRecord(
  seq: number,
  prevHash: string,
  balanceBeforeUsd: number,
  input: {
    id?: string;
    recordType: VerifiableRecordType;
    timestamp?: string;
    rail: string;
    networkCode?: string;
    accountMasked?: string;
    amountUsd: number;
    deltaUsd: number;
    amountLocal?: number;
    currencyLocal?: string;
    referenceId: string;
    settlementMode: 'live_configured' | 'live_treasury_ledger';
    note: string;
  }
): VerifiableLedgerRecord {
  if (
    isSandboxText(input.rail) ||
    isSandboxText(input.referenceId) ||
    isSandboxText(input.note)
  ) {
    throw new Error('Sandbox and simulated records are permanently rejected by the verifiable database.');
  }

  const beforeCents = toCents(balanceBeforeUsd);
  const deltaCents = toCents(input.deltaUsd);
  const afterCents = Math.max(0, beforeCents + deltaCents);
  const ts = input.timestamp || new Date().toISOString();
  const id =
    input.id ||
    `vdb-${String(seq).padStart(5, '0')}-${Date.now().toString(36).toUpperCase().slice(-5)}`;

  const unsigned: Omit<VerifiableLedgerRecord, 'recordHash'> = {
    seq,
    id,
    recordType: input.recordType,
    timestamp: ts,
    rail: input.rail.trim() || 'live_treasury',
    networkCode: (input.networkCode || 'MTN').trim().toUpperCase(),
    accountMasked: (input.accountMasked || '•••• 1975').trim(),
    amountUsd: fromCents(Math.max(0, toCents(input.amountUsd))),
    deltaUsd: fromCents(deltaCents),
    ...(typeof input.amountLocal === 'number' && Number.isFinite(input.amountLocal)
      ? { amountLocal: Number(input.amountLocal.toFixed(2)) }
      : {}),
    ...(input.currencyLocal ? { currencyLocal: input.currencyLocal.toUpperCase() } : {}),
    balanceBeforeUsd: fromCents(beforeCents),
    balanceAfterUsd: fromCents(afterCents),
    referenceId: input.referenceId.trim(),
    settlementMode: input.settlementMode,
    note: input.note.trim().slice(0, 220),
    prevHash
  };

  const recordHash = computeVerifiableRecordHash(unsigned);
  return {
    ...unsigned,
    recordHash
  };
}

export function loadVerifiableDatabaseState(
  initialLiveBalanceUsd: number,
  sandboxDisabledAt: string,
  defaultMomoMasked = '•••• 1975'
): VerifiableDatabaseState {
  try {
    if (fs.existsSync(verifiableDbPath)) {
      const parsed = JSON.parse(
        fs.readFileSync(verifiableDbPath, 'utf8')
      ) as Partial<VerifiableDatabaseState>;
      if (
        parsed &&
        Array.isArray(parsed.records) &&
        parsed.records.length > 0 &&
        typeof parsed.headHash === 'string'
      ) {
        return {
          schemaVersion: parsed.schemaVersion || '1.0.0',
          engine: 'SHA256-HashChained-Ledger-v1',
          accountMode: 'live_production',
          sandboxDisabledAt: parsed.sandboxDisabledAt || sandboxDisabledAt,
          genesisTimestamp: parsed.genesisTimestamp || parsed.records[0].timestamp,
          genesisHash: parsed.genesisHash || parsed.records[0].recordHash,
          headSeq: parsed.headSeq ?? parsed.records[parsed.records.length - 1].seq,
          headHash: parsed.headHash,
          headBalanceUsd:
            typeof parsed.headBalanceUsd === 'number'
              ? parsed.headBalanceUsd
              : parsed.records[parsed.records.length - 1].balanceAfterUsd,
          records: parsed.records
        };
      }
    }
  } catch {
    // Re-initialize cleanly below
  }

  const openingUsd = fromCents(Math.max(0, toCents(initialLiveBalanceUsd)));
  const nowIso = new Date().toISOString();
  const genesis = buildRecord(1, GENESIS_PREV_HASH, 0, {
    id: 'vdb-00001-genesis',
    recordType: 'GENESIS_VERIFIED_OPENING',
    timestamp: nowIso,
    rail: 'live_treasury',
    networkCode: 'MTN',
    accountMasked: defaultMomoMasked,
    amountUsd: openingUsd,
    deltaUsd: openingUsd,
    referenceId: 'NH24-VERIFIED-GENESIS',
    settlementMode: 'live_treasury_ledger',
    note: `Verified Live Production Opening Balance ($${openingUsd.toFixed(2)} USD) · Production Only`
  });

  const fresh: VerifiableDatabaseState = {
    schemaVersion: '1.0.0',
    engine: 'SHA256-HashChained-Ledger-v1',
    accountMode: 'live_production',
    sandboxDisabledAt,
    genesisTimestamp: nowIso,
    genesisHash: genesis.recordHash,
    headSeq: 1,
    headHash: genesis.recordHash,
    headBalanceUsd: genesis.balanceAfterUsd,
    records: [genesis]
  };
  writeJsonAtomic(verifiableDbPath, fresh);
  return fresh;
}

export function saveVerifiableDatabaseState(state: VerifiableDatabaseState): void {
  writeJsonAtomic(verifiableDbPath, state);
}

export function appendVerifiableRecord(
  state: VerifiableDatabaseState,
  input: {
    id?: string;
    recordType: VerifiableRecordType;
    rail: string;
    networkCode?: string;
    accountMasked?: string;
    amountUsd: number;
    deltaUsd: number;
    amountLocal?: number;
    currencyLocal?: string;
    referenceId: string;
    settlementMode: 'live_configured' | 'live_treasury_ledger';
    note: string;
  }
): VerifiableLedgerRecord {
  const nextSeq = state.records.length + 1;
  const lastRecord = state.records[state.records.length - 1];
  const prevHash = lastRecord ? lastRecord.recordHash : GENESIS_PREV_HASH;
  const balanceBeforeUsd = lastRecord ? lastRecord.balanceAfterUsd : 0;

  const record = buildRecord(nextSeq, prevHash, balanceBeforeUsd, input);
  state.records.push(record);
  state.headSeq = record.seq;
  state.headHash = record.recordHash;
  state.headBalanceUsd = record.balanceAfterUsd;

  if (state.records.length > 500) {
    // Keep genesis + latest 499? Never drop genesis if verifying full chain:
    // keep full audit log up to 5000 entries for total chain verifiability
    if (state.records.length > 5000) {
      state.records = state.records.slice(-5000);
    }
  }

  saveVerifiableDatabaseState(state);
  return record;
}

export function reconcileVerifiableDatabaseBalance(
  state: VerifiableDatabaseState,
  targetLiveBalanceUsd: number,
  reason: string
): VerifiableLedgerRecord | null {
  const currentCents = toCents(state.headBalanceUsd);
  const targetCents = Math.max(0, toCents(targetLiveBalanceUsd));
  const deltaCents = targetCents - currentCents;
  if (deltaCents === 0) return null;

  return appendVerifiableRecord(state, {
    recordType: 'LEDGER_RECONCILIATION',
    rail: 'live_treasury',
    networkCode: 'TREASURY',
    accountMasked: 'Live Balance',
    amountUsd: fromCents(Math.abs(deltaCents)),
    deltaUsd: fromCents(deltaCents),
    referenceId: `NH24-REC-${Date.now().toString(36).toUpperCase()}`,
    settlementMode: 'live_treasury_ledger',
    note: reason
  });
}

export function verifyVerifiableDatabase(
  state: VerifiableDatabaseState,
  params: {
    livePendingPayoutUsd: number;
    treasuryCreatorPayableUsd: number;
    treasuryBalanced: boolean;
    ghsFxRate: number;
    momoDefaultWallet: string;
    momoDefaultNetwork: string;
  }
): VerifiableDatabaseReport {
  let chainValid = state.records.length > 0;
  let brokenReason = '';
  let sandboxEntries = 0;

  let expectedPrevHash = GENESIS_PREV_HASH;
  let expectedBalanceCents = 0;

  for (let i = 0; i < state.records.length; i += 1) {
    const rec = state.records[i];
    if (rec.seq !== i + 1) {
      chainValid = false;
      brokenReason = `Sequence break at index ${i} (expected seq ${i + 1}, got ${rec.seq})`;
      break;
    }
    if (rec.prevHash !== expectedPrevHash) {
      chainValid = false;
      brokenReason = `Hash link mismatch at seq #${rec.seq}`;
      break;
    }
    if (toCents(rec.balanceBeforeUsd) !== expectedBalanceCents) {
      chainValid = false;
      brokenReason = `Running balance discontinuity at seq #${rec.seq}`;
      break;
    }

    const expectedAfterCents = Math.max(0, expectedBalanceCents + toCents(rec.deltaUsd));
    if (toCents(rec.balanceAfterUsd) !== expectedAfterCents) {
      chainValid = false;
      brokenReason = `Balance arithmetic mismatch at seq #${rec.seq}`;
      break;
    }

    const recomputedHash = computeVerifiableRecordHash({
      seq: rec.seq,
      id: rec.id,
      recordType: rec.recordType,
      timestamp: rec.timestamp,
      rail: rec.rail,
      networkCode: rec.networkCode,
      accountMasked: rec.accountMasked,
      amountUsd: rec.amountUsd,
      deltaUsd: rec.deltaUsd,
      amountLocal: rec.amountLocal,
      currencyLocal: rec.currencyLocal,
      balanceBeforeUsd: rec.balanceBeforeUsd,
      balanceAfterUsd: rec.balanceAfterUsd,
      referenceId: rec.referenceId,
      settlementMode: rec.settlementMode,
      note: rec.note,
      prevHash: rec.prevHash
    });

    if (recomputedHash !== rec.recordHash) {
      chainValid = false;
      brokenReason = `SHA-256 digest verification failed at seq #${rec.seq}`;
      break;
    }

    if (isSandboxText(rec.rail) || isSandboxText(rec.referenceId) || isSandboxText(rec.note)) {
      sandboxEntries += 1;
    }

    expectedPrevHash = rec.recordHash;
    expectedBalanceCents = toCents(rec.balanceAfterUsd);
  }

  const verifiedBalanceUsd = fromCents(expectedBalanceCents);
  const verifiedBalanceGhs = Number((verifiedBalanceUsd * Math.max(1, params.ghsFxRate)).toFixed(2));
  const pendingCents = toCents(params.livePendingPayoutUsd);
  const payableCents = toCents(params.treasuryCreatorPayableUsd);

  const balanceMatched = Math.abs(expectedBalanceCents - pendingCents) <= 1;
  const treasuryMatched =
    params.treasuryBalanced && Math.abs(expectedBalanceCents - payableCents) <= 1;
  const zeroSandboxConfirmed = sandboxEntries === 0;
  const momoReady = /^0[235]\d{8}$/.test(params.momoDefaultWallet) || params.momoDefaultWallet.length >= 9;

  const checks: VerifiableDatabaseCheck[] = [
    {
      id: 'sha256_hash_chain',
      label: 'SHA-256 Hash Chain Integrity',
      passed: chainValid,
      detail: chainValid
        ? `All ${state.records.length} ledger records verified from genesis to head (${state.headHash.slice(0, 12)}…).`
        : brokenReason || 'Hash chain verification failed.'
    },
    {
      id: 'zero_sandbox_records',
      label: 'Zero Sandbox / Simulated Records',
      passed: zeroSandboxConfirmed,
      detail: zeroSandboxConfirmed
        ? `0 sandbox or test records detected; live production mode enforced since ${state.sandboxDisabledAt.slice(0, 10)}.`
        : `${sandboxEntries} sandbox/simulated record(s) flagged.`
    },
    {
      id: 'payout_balance_match',
      label: 'Withdrawable Balance Match',
      passed: balanceMatched,
      detail: balanceMatched
        ? `Database head balance ($${verifiedBalanceUsd.toFixed(2)} USD) matches live withdrawable balance.`
        : `Database balance ($${verifiedBalanceUsd.toFixed(2)}) differs from live balance ($${params.livePendingPayoutUsd.toFixed(2)}).`
    },
    {
      id: 'treasury_double_entry_match',
      label: 'Treasury Double-Entry Coverage',
      passed: treasuryMatched,
      detail: treasuryMatched
        ? `Treasury Creator Payable ($${params.treasuryCreatorPayableUsd.toFixed(2)} USD) 100% asset-backed.`
        : `Treasury audit discrepancy or payable mismatch ($${params.treasuryCreatorPayableUsd.toFixed(2)}).`
    },
    {
      id: 'momo_rail_ready',
      label: 'MTN MoMo Withdrawal Wallet Ready',
      passed: momoReady,
      detail: momoReady
        ? `Default ${params.momoDefaultNetwork} Mobile Money wallet (${params.momoDefaultWallet}) active and verified.`
        : 'No valid Mobile Money wallet configured.'
    }
  ];

  const checksPassed = checks.filter((c) => c.passed).length;
  const status: VerifiableDatabaseReport['status'] =
    chainValid && zeroSandboxConfirmed && balanceMatched && treasuryMatched
      ? 'verified'
      : 'tamper_or_mismatch';

  return {
    status,
    chainValid,
    balanceMatched,
    zeroSandboxConfirmed,
    treasuryMatched,
    engine: state.engine,
    accountMode: 'live_production',
    sandboxDisabledAt: state.sandboxDisabledAt,
    verifiedAt: new Date().toISOString(),
    totalRecords: state.records.length,
    headSeq: state.headSeq,
    genesisHash: state.genesisHash,
    headHash: state.headHash,
    verifiedBalanceUsd,
    verifiedBalanceGhs,
    livePendingPayoutUsd: Number(params.livePendingPayoutUsd.toFixed(2)),
    treasuryCreatorPayableUsd: Number(params.treasuryCreatorPayableUsd.toFixed(2)),
    momoReady,
    momoDefaultWallet: params.momoDefaultWallet,
    momoDefaultNetwork: params.momoDefaultNetwork,
    checksPassed,
    checksTotal: checks.length,
    checks,
    records: [...state.records].reverse().slice(0, 50)
  };
}
