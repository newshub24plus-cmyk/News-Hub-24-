import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_MOTHER_APP_URL =
  'https://aloof-daily-news-pulse.base44.app/story/6b04f190aa908b27ce284a57';

export type MotherAppStreamType =
  | 'sponsored_story_slot'
  | 'reader_traffic_yield'
  | 'subscription_referral'
  | 'reader_tip'
  | 'live_checkout_settlement'
  | 'webhook_event';

export interface MotherAppRevenueEventRecord {
  id: string;
  motherAppUrl: string;
  storyId: string;
  streamType: MotherAppStreamType;
  streamLabel: string;
  sourceLabel: string;
  clicksAttributed: number;
  watchSecondsAttributed: number;
  grossUsd: number;
  platformFeeUsd: number;
  creatorNetUsd: number;
  withdrawGhs: number;
  equivalentSol: number;
  verifiedRealFunds: boolean;
  gatewayProvider?: string;
  settlementMode: 'live_configured' | 'verified_treasury_ledger';
  externalTxRef?: string;
  withdrawalId?: string;
  note: string;
  createdAt: string;
}

export interface MotherAppConnectionState {
  motherAppUrl: string;
  motherOrigin: string;
  storyId: string;
  appName: string;
  relationshipRole: 'mother_app';
  connectedAt: string;
  updatedAt: string;
  lastHandshakeAt: string | null;
  lastHandshakeStatus: number | null;
  lastHandshakeOk: boolean;
  verifiedPageTitle: string | null;
  handshakeError: string | null;
  totalEventsCount: number;
  totalClicksAttributed: number;
  totalWatchSecondsAttributed: number;
  totalGrossUsd: number;
  totalPlatformFeeUsd: number;
  totalCreatorNetUsd: number;
  totalWithdrawnUsd: number;
  events: MotherAppRevenueEventRecord[];
}

const motherAppLedgerPath = path.join(__dirname, 'mother-app-ledger.json');

export function isAllowedBase44MotherUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('169.254.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      host.includes(':')
    ) {
      return false;
    }
    return (
      host === 'base44.com' ||
      host.endsWith('.base44.com') ||
      host === 'base44.app' ||
      host.endsWith('.base44.app')
    );
  } catch {
    return false;
  }
}

export function extractMotherAppParts(urlStr: string): {
  cleanUrl: string;
  origin: string;
  storyId: string;
} {
  const safe = isAllowedBase44MotherUrl(urlStr.trim())
    ? urlStr.trim().replace(/\/$/, '')
    : DEFAULT_MOTHER_APP_URL;
  const parsed = new URL(safe);
  const segments = parsed.pathname.split('/').filter(Boolean);
  const storyIdx = segments.findIndex((s) => s === 'story' || s === 'article' || s === 'post');
  const rawStoryId =
    storyIdx >= 0 && segments[storyIdx + 1]
      ? segments[storyIdx + 1]
      : segments[segments.length - 1] || '6b04f190aa908b27ce284a57';
  const cleanStoryId = rawStoryId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96) || '6b04f190aa908b27ce284a57';
  return {
    cleanUrl: safe,
    origin: parsed.origin,
    storyId: cleanStoryId
  };
}

function buildInitialMotherAppState(initialUrl?: string): MotherAppConnectionState {
  const parts = extractMotherAppParts(initialUrl || DEFAULT_MOTHER_APP_URL);
  const nowIso = new Date().toISOString();
  return {
    motherAppUrl: parts.cleanUrl,
    motherOrigin: parts.origin,
    storyId: parts.storyId,
    appName: 'News Hub 24+ Base44 Mother App',
    relationshipRole: 'mother_app',
    connectedAt: nowIso,
    updatedAt: nowIso,
    lastHandshakeAt: null,
    lastHandshakeStatus: null,
    lastHandshakeOk: false,
    verifiedPageTitle: 'Article | News Hub 24+',
    handshakeError: null,
    totalEventsCount: 0,
    totalClicksAttributed: 0,
    totalWatchSecondsAttributed: 0,
    totalGrossUsd: 0,
    totalPlatformFeeUsd: 0,
    totalCreatorNetUsd: 0,
    totalWithdrawnUsd: 0,
    events: []
  };
}

export function loadMotherAppState(initialUrl?: string): MotherAppConnectionState {
  try {
    if (fs.existsSync(motherAppLedgerPath)) {
      const parsed = JSON.parse(fs.readFileSync(motherAppLedgerPath, 'utf8')) as Partial<MotherAppConnectionState>;
      if (parsed && typeof parsed.motherAppUrl === 'string' && isAllowedBase44MotherUrl(parsed.motherAppUrl)) {
        const parts = extractMotherAppParts(parsed.motherAppUrl);
        return {
          ...buildInitialMotherAppState(parts.cleanUrl),
          ...parsed,
          motherAppUrl: parts.cleanUrl,
          motherOrigin: parts.origin,
          storyId: parts.storyId,
          events: Array.isArray(parsed.events)
            ? parsed.events.slice(0, 60).map((ev) => ({
                ...ev,
                verifiedRealFunds: ev.verifiedRealFunds === true
              }))
            : []
        };
      }
    }
  } catch {
    // Fallback cleanly to default Mother App state
  }
  const fresh = buildInitialMotherAppState(initialUrl);
  saveMotherAppState(fresh);
  return fresh;
}

export function saveMotherAppState(state: MotherAppConnectionState): void {
  try {
    fs.mkdirSync(path.dirname(motherAppLedgerPath), { recursive: true });
    const tmpPath = `${motherAppLedgerPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpPath, motherAppLedgerPath);
  } catch {
    // Non-fatal in read-only filesystem edge cases
  }
}

export async function probeMotherAppHandshake(targetUrl: string): Promise<{
  ok: boolean;
  httpStatus: number | null;
  pageTitle: string | null;
  finalUrl: string;
  error: string | null;
  checkedAt: string;
}> {
  const checkedAt = new Date().toISOString();
  if (!isAllowedBase44MotherUrl(targetUrl)) {
    return {
      ok: false,
      httpStatus: null,
      pageTitle: null,
      finalUrl: targetUrl,
      error: 'Only HTTPS base44.app or base44.com URLs are allowed for Mother App verification.',
      checkedAt
    };
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'NewsHub24Plus-MotherAppVerifier/1.0 (+https://newshub24plus.com)',
        Accept: 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(8000)
    });

    // Follow at most 1 verified Base44 redirect safely
    let finalResponse = response;
    let finalUrl = targetUrl;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const resolved = new URL(location, targetUrl).toString();
        if (!isAllowedBase44MotherUrl(resolved)) {
          return {
            ok: false,
            httpStatus: response.status,
            pageTitle: null,
            finalUrl: targetUrl,
            error: 'Redirect target leaves approved Base44 host boundary.',
            checkedAt
          };
        }
        finalUrl = resolved;
        finalResponse = await fetch(resolved, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'NewsHub24Plus-MotherAppVerifier/1.0 (+https://newshub24plus.com)',
            Accept: 'text/html,application/xhtml+xml'
          },
          signal: AbortSignal.timeout(8000)
        });
      }
    }

    const html = await finalResponse.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const ogMatch = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const rawTitle = (ogMatch?.[1] || titleMatch?.[1] || '').replace(/\s+/g, ' ').trim();
    const cleanTitle = rawTitle ? rawTitle.replace(/[<>]/g, '').slice(0, 140) : null;

    return {
      ok: finalResponse.ok,
      httpStatus: finalResponse.status,
      pageTitle: cleanTitle,
      finalUrl,
      error: finalResponse.ok ? null : `Mother app responded with HTTP ${finalResponse.status}.`,
      checkedAt
    };
  } catch (err: unknown) {
    return {
      ok: false,
      httpStatus: null,
      pageTitle: null,
      finalUrl: targetUrl,
      error: err instanceof Error ? err.message.slice(0, 160) : 'Unable to reach Base44 Mother App.',
      checkedAt
    };
  }
}
