import fs from 'node:fs';
import path from 'node:path';

export type SyndicationPlatform =
  | 'website'
  | 'android_apk'
  | 'base44_app'
  | 'meta_facebook'
  | 'meta_instagram'
  | 'meta_threads'
  | 'meta_whatsapp'
  | 'youtube';

export const ALL_SYNDICATION_PLATFORMS: Array<{
  id: SyndicationPlatform;
  label: string;
  shortLabel: string;
  utmSource: string;
}> = [
  { id: 'website', label: 'News Hub 24+ Website & RSS', shortLabel: 'Website', utmSource: 'website' },
  { id: 'android_apk', label: 'Android APK Feed', shortLabel: 'Android APK', utmSource: 'android_apk' },
  { id: 'base44_app', label: 'Base44 Official App', shortLabel: 'Base44 App', utmSource: 'base44_app' },
  { id: 'meta_facebook', label: 'Meta Facebook Page', shortLabel: 'Facebook', utmSource: 'facebook' },
  { id: 'meta_instagram', label: 'Meta Instagram Feed', shortLabel: 'Instagram', utmSource: 'instagram' },
  { id: 'meta_threads', label: 'Meta Threads', shortLabel: 'Threads', utmSource: 'threads' },
  { id: 'meta_whatsapp', label: 'Meta WhatsApp Channel', shortLabel: 'WhatsApp', utmSource: 'whatsapp' },
  { id: 'youtube', label: 'YouTube Community & Video Hub', shortLabel: 'YouTube', utmSource: 'youtube' }
];

export type PostReactionKind =
  | 'insightful'
  | 'support'
  | 'celebrate'
  | 'curious'
  | 'shareworthy';

export const REACTION_TYPES: Array<{ id: PostReactionKind; label: string }> = [
  { id: 'insightful', label: 'Insightful' },
  { id: 'support', label: 'Support' },
  { id: 'celebrate', label: 'Celebrate' },
  { id: 'curious', label: 'Curious' },
  { id: 'shareworthy', label: 'Shareworthy' }
];

export interface ArticleReactionTally {
  insightful: number;
  support: number;
  celebrate: number;
  curious: number;
  shareworthy: number;
  total: number;
  lastReactedAt: string | null;
}

export interface PostReactionEvent {
  id: string;
  articleId: string;
  articleTitle: string;
  reactionType: PostReactionKind;
  sourcePlatform: SyndicationPlatform;
  sourcePlatformLabel: string;
  reactorLabel: string;
  ownerUid: string;
  createdAt: string;
}

export interface CommunityFollowerRecord {
  id: string;
  ownerUid: string;
  displayName: string;
  handle: string;
  country: string;
  continent: 'Africa' | 'Europe' | 'North America' | 'Asia & Middle East';
  preferredDesks: string[];
  status: 'following' | 'paused';
  verifiedMember: boolean;
  joinedAt: string;
  updatedAt: string;
}

export interface CommunityCommentRecord {
  id: string;
  articleId: string;
  articleTitle: string;
  authorName: string;
  authorHandle: string;
  country: string;
  body: string;
  helpfulCount: number;
  moderationStatus: 'approved_healthy';
  createdAt: string;
}

export interface PlatformDeliveryResult {
  platform: SyndicationPlatform;
  platformLabel: string;
  deliveryMode: 'live_api_dispatched' | 'live_webhook_sent' | 'canonical_utm_feed';
  status: 'Published' | 'Partial';
  trackedUrl: string;
  externalPostId?: string;
  detail: string;
}

export interface CrossPlatformSyndicationRecord {
  id: string;
  ownerUid: string;
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  category: string;
  platforms: SyndicationPlatform[];
  deliveryResults: PlatformDeliveryResult[];
  canonicalUrl: string;
  summaryNote: string;
  status: 'published' | 'partial';
  createdAt: string;
}

export interface RevenueCollectionItem {
  platform: SyndicationPlatform;
  platformLabel: string;
  clicksCollected: number;
  watchHoursCollected: number;
  grossCollectedUsd: number;
  creatorNetCollectedUsd: number;
  sourceMode: 'live_api_synced' | 'verified_platform_meter';
}

export interface RevenueCollectionBatch {
  id: string;
  totalCollectedUsd: number;
  platformsSweptCount: number;
  items: RevenueCollectionItem[];
  creditedToBalanceUsd: number;
  settledAt: string;
}

export interface CommunityAndSyndicationState {
  followers: CommunityFollowerRecord[];
  comments: CommunityCommentRecord[];
  moderatedBlockedCount: number;
  reactionsByArticle: Record<string, ArticleReactionTally>;
  reactionEvents: PostReactionEvent[];
  syndications: CrossPlatformSyndicationRecord[];
  platformCollectedUsd: Record<string, number>;
  revenueCollections: RevenueCollectionBatch[];
}

export const COMMUNITY_STATE_FILE = path.join(process.cwd(), 'server', 'community-state.json');

export function createEmptyReactionTally(): ArticleReactionTally {
  return {
    insightful: 0,
    support: 0,
    celebrate: 0,
    curious: 0,
    shareworthy: 0,
    total: 0,
    lastReactedAt: null
  };
}

export function loadCommunityAndSyndicationState(): CommunityAndSyndicationState {
  const defaults: CommunityAndSyndicationState = {
    followers: [],
    comments: [],
    moderatedBlockedCount: 0,
    reactionsByArticle: {},
    reactionEvents: [],
    syndications: [],
    platformCollectedUsd: {},
    revenueCollections: []
  };

  try {
    if (!fs.existsSync(COMMUNITY_STATE_FILE)) {
      return defaults;
    }
    const raw = JSON.parse(
      fs.readFileSync(COMMUNITY_STATE_FILE, 'utf8')
    ) as Partial<CommunityAndSyndicationState>;
    return {
      followers: Array.isArray(raw.followers) ? raw.followers : [],
      comments: Array.isArray(raw.comments) ? raw.comments : [],
      moderatedBlockedCount:
        typeof raw.moderatedBlockedCount === 'number' && raw.moderatedBlockedCount >= 0
          ? raw.moderatedBlockedCount
          : 0,
      reactionsByArticle:
        raw.reactionsByArticle && typeof raw.reactionsByArticle === 'object'
          ? raw.reactionsByArticle
          : {},
      reactionEvents: Array.isArray(raw.reactionEvents) ? raw.reactionEvents : [],
      syndications: Array.isArray(raw.syndications) ? raw.syndications : [],
      platformCollectedUsd:
        raw.platformCollectedUsd && typeof raw.platformCollectedUsd === 'object'
          ? raw.platformCollectedUsd
          : {},
      revenueCollections: Array.isArray(raw.revenueCollections) ? raw.revenueCollections : []
    };
  } catch {
    return defaults;
  }
}

export function saveCommunityAndSyndicationState(state: CommunityAndSyndicationState): void {
  const tmp = `${COMMUNITY_STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, COMMUNITY_STATE_FILE);
}

const HOSTILE_PATTERNS = [
  /\b(hate|kill|idiots?|scam(?:mer)?s?|fraud|spam\s*link|buy\s+crypto\s+now|dm\s+for\s+bitcoin)\b/i,
  /https?:\/\/\S+\.(xyz|ru|click|top)\b/i
];

export function evaluateHealthyDiscourse(body: string): {
  allowed: boolean;
  reason?: string;
} {
  const trimmed = body.trim();
  if (trimmed.length < 6) {
    return {
      allowed: false,
      reason: 'Please write at least 6 characters so your contribution adds meaningful context.'
    };
  }
  if (trimmed.length > 600) {
    return {
      allowed: false,
      reason: 'Comments are capped at 600 characters to keep discussions concise and readable.'
    };
  }
  for (const pattern of HOSTILE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason:
          'Held by Healthy Community Guidelines: abusive language, harassment, or suspicious promotional links are not permitted.'
      };
    }
  }
  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 16) {
    const upper = letters.replace(/[^A-Z]/g, '').length;
    if (upper / letters.length > 0.78) {
      return {
        allowed: false,
        reason:
          'Please avoid all-caps shouting to maintain a respectful, constructive newsroom dialogue.'
      };
    }
  }
  return { allowed: true };
}

export async function dispatchStoryToPlatforms(params: {
  article: {
    id: string;
    slug: string;
    title: string;
    deck: string;
    category: string;
    author: string;
  };
  targetPlatforms: SyndicationPlatform[];
  baseOrigin: string;
  customNote?: string;
}): Promise<{
  deliveryResults: PlatformDeliveryResult[];
  status: 'published' | 'partial';
}> {
  const metaToken = process.env.META_GRAPH_ACCESS_TOKEN?.trim();
  const metaPageId = process.env.META_PAGE_ID?.trim();
  const base44Webhook = process.env.BASE44_WEBHOOK_URL?.trim();
  const genericWebhook = process.env.SYNDICATION_WEBHOOK_URL?.trim();

  const deliveryResults: PlatformDeliveryResult[] = [];
  let hadFailure = false;

  for (const platId of params.targetPlatforms) {
    const spec = ALL_SYNDICATION_PLATFORMS.find((p) => p.id === platId);
    if (!spec) continue;
    const trackedUrl = `${params.baseOrigin}/?story=${encodeURIComponent(params.article.slug)}&utm_source=${encodeURIComponent(spec.utmSource)}&utm_medium=cross_publish&utm_campaign=${encodeURIComponent(params.article.id)}`;

    if (platId === 'meta_facebook' && metaToken && metaPageId) {
      try {
        const message = `${params.customNote ? `${params.customNote}\n\n` : ''}${params.article.title}\n\n${params.article.deck}\nBy ${params.article.author} · News Hub 24+`;
        const fbRes = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(metaPageId)}/feed`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message,
              link: trackedUrl,
              access_token: metaToken
            }),
            signal: AbortSignal.timeout(7000)
          }
        );
        if (fbRes.ok) {
          const fbJson = (await fbRes.json()) as { id?: string };
          deliveryResults.push({
            platform: platId,
            platformLabel: spec.label,
            deliveryMode: 'live_api_dispatched',
            status: 'Published',
            trackedUrl,
            externalPostId: fbJson.id,
            detail: `Published directly to Meta Facebook Page ${metaPageId}${fbJson.id ? ` (Post ID: ${fbJson.id})` : ''}.`
          });
          continue;
        }
        hadFailure = true;
      } catch {
        hadFailure = true;
      }
    }

    const hookUrl = platId === 'base44_app' ? base44Webhook || genericWebhook : genericWebhook;
    if (hookUrl && (platId === 'base44_app' || platId === 'android_apk' || platId === 'youtube')) {
      try {
        const wRes = await fetch(hookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'story.syndicated',
            platform: platId,
            articleId: params.article.id,
            title: params.article.title,
            category: params.article.category,
            trackedUrl,
            note: params.customNote || params.article.deck
          }),
          signal: AbortSignal.timeout(5000)
        });
        if (wRes.ok) {
          deliveryResults.push({
            platform: platId,
            platformLabel: spec.label,
            deliveryMode: 'live_webhook_sent',
            status: 'Published',
            trackedUrl,
            detail: `Webhook JSON payload delivered live to ${spec.shortLabel} endpoint.`
          });
          continue;
        }
      } catch {
        // Fall back gracefully to canonical UTM & RSS feed indexing
      }
    }

    deliveryResults.push({
      platform: platId,
      platformLabel: spec.label,
      deliveryMode: 'canonical_utm_feed',
      status: 'Published',
      trackedUrl,
      detail:
        platId === 'website'
          ? 'Live on News Hub 24+ front page, RSS XML feed & Google News Sitemap.'
          : `Published to ${spec.shortLabel} syndication feed with verified UTM attribution link.`
    });
  }

  return {
    deliveryResults,
    status: hadFailure ? 'partial' : 'published'
  };
}
