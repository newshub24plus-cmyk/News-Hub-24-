import {
  Award,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  HelpCircle,
  Lightbulb,
  MessageSquareHeart,
  Radio,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  ThumbsUp,
  UserCheck,
  UserPlus,
  Users
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ARTICLE_CATALOGS, type NewsArticle } from '../data/newsData';
import {
  auth,
  isAgencyAdminUser,
  syncCommunityFollowerToFirestore,
  syncCrossPlatformSyndicationToFirestore,
  syncPostReactionToFirestore
} from '../lib/firebase';

export type PostReactionKind =
  | 'insightful'
  | 'support'
  | 'celebrate'
  | 'curious'
  | 'shareworthy';

export type SyndicationPlatformId =
  | 'website'
  | 'android_apk'
  | 'base44_app'
  | 'meta_facebook'
  | 'meta_instagram'
  | 'meta_threads'
  | 'meta_whatsapp'
  | 'youtube';

export interface ArticleReactionTally {
  insightful: number;
  support: number;
  celebrate: number;
  curious: number;
  shareworthy: number;
  total: number;
  lastReactedAt: string | null;
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

export interface PostReactionEvent {
  id: string;
  articleId: string;
  articleTitle: string;
  reactionType: PostReactionKind;
  sourcePlatform: SyndicationPlatformId;
  sourcePlatformLabel: string;
  reactorLabel: string;
  ownerUid: string;
  createdAt: string;
}

export interface PlatformDeliveryResult {
  platform: SyndicationPlatformId;
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
  platforms: SyndicationPlatformId[];
  deliveryResults: PlatformDeliveryResult[];
  canonicalUrl: string;
  summaryNote: string;
  status: 'published' | 'partial';
  createdAt: string;
}

export interface CommunitySnapshotResponse {
  stats: {
    totalFollowers: number;
    verifiedFollowers: number;
    totalReactions: number;
    totalComments: number;
    moderatedBlockedCount: number;
    healthyScorePct: number;
    engagementRatePct: number;
    totalArticleViews: number;
    totalSyndications: number;
    continentCounts: Record<string, number>;
  };
  followers: CommunityFollowerRecord[];
  comments: CommunityCommentRecord[];
  reactionsByArticle: Record<string, ArticleReactionTally>;
  recentReactionEvents: PostReactionEvent[];
  syndications: CrossPlatformSyndicationRecord[];
  allPlatforms: Array<{
    id: SyndicationPlatformId;
    label: string;
    shortLabel: string;
    utmSource: string;
  }>;
  reactionTypes: Array<{
    id: PostReactionKind;
    label: string;
  }>;
}

export interface DeployStatusResponse {
  deployed: boolean;
  distBuilt: boolean;
  firestoreRulesReady: boolean;
  firebaseProjectId: string;
  firestoreDatabaseId: string;
  primaryDomain: string;
  runtimeOrigin: string;
  developmentAppUrl: string;
  sharedAppUrl: string;
  base44AppUrl: string;
  apkFilename: string;
  apkDownloadUrl: string;
  sitemaps: string[];
  integrations: {
    stripeLive: boolean;
    flutterwaveLive: boolean;
    paypalLive: boolean;
    solanaRpcLive: boolean;
    metaGraphLive: boolean;
    adsensePublisherConfigured: boolean;
  };
  checkedAt: string;
}

interface CommunityEngagementSectionProps {
  community: CommunitySnapshotResponse | null;
  deployStatus: DeployStatusResponse | null;
  articles: NewsArticle[];
  onCommunityUpdated: (next: CommunitySnapshotResponse) => void;
  onRefreshDeployStatus: () => void;
  onOpenArticle: (article: NewsArticle) => void;
  onOpenPublishModal: () => void;
}

type ActiveTab = 'followers' | 'reactions' | 'syndicate' | 'deploy';

const REACTION_META: Array<{
  id: PostReactionKind;
  label: string;
  icon: typeof Lightbulb;
}> = [
  { id: 'insightful', label: 'Insightful', icon: Lightbulb },
  { id: 'support', label: 'Support', icon: ThumbsUp },
  { id: 'celebrate', label: 'Celebrate', icon: Award },
  { id: 'curious', label: 'Curious', icon: HelpCircle },
  { id: 'shareworthy', label: 'Shareworthy', icon: Share2 }
];

const PLATFORM_OPTIONS: Array<{
  id: SyndicationPlatformId;
  shortLabel: string;
  label: string;
}> = [
  { id: 'website', shortLabel: 'Website', label: 'News Hub 24+ Website & RSS' },
  { id: 'android_apk', shortLabel: 'Android APK', label: 'Android APK Feed' },
  { id: 'base44_app', shortLabel: 'Base44 App', label: 'Base44 Official App' },
  { id: 'meta_facebook', shortLabel: 'Facebook', label: 'Meta Facebook Page' },
  { id: 'meta_instagram', shortLabel: 'Instagram', label: 'Meta Instagram Feed' },
  { id: 'meta_threads', shortLabel: 'Threads', label: 'Meta Threads' },
  { id: 'meta_whatsapp', shortLabel: 'WhatsApp', label: 'Meta WhatsApp Channel' },
  { id: 'youtube', shortLabel: 'YouTube', label: 'YouTube Community & Video Hub' }
];

const CONTINENTS: Array<'Africa' | 'Europe' | 'North America' | 'Asia & Middle East'> = [
  'Africa',
  'Europe',
  'North America',
  'Asia & Middle East'
];

export function CommunityEngagementSection({
  community,
  deployStatus,
  articles,
  onCommunityUpdated,
  onRefreshDeployStatus,
  onOpenArticle,
  onOpenPublishModal
}: CommunityEngagementSectionProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('followers');

  // Follow form state
  const [followName, setFollowName] = useState('');
  const [followHandle, setFollowHandle] = useState('');
  const [followCountry, setFollowCountry] = useState('Ghana');
  const [followContinent, setFollowContinent] = useState<
    'Africa' | 'Europe' | 'North America' | 'Asia & Middle East'
  >('Africa');
  const [followDesks, setFollowDesks] = useState<string[]>(['World', 'Economy']);
  const [followSubmitting, setFollowSubmitting] = useState(false);
  const [followMessage, setFollowMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Healthy comment form state
  const [commentArticleId, setCommentArticleId] = useState<string>(() => articles[0]?.id ?? '');
  const [commentAuthorName, setCommentAuthorName] = useState('');
  const [commentCountry, setCommentCountry] = useState('Ghana');
  const [commentBody, setCommentBody] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentFeedback, setCommentFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Post reaction studio state
  const [reactArticleId, setReactArticleId] = useState<string>(() => articles[0]?.id ?? '');
  const [reactPlatform, setReactPlatform] = useState<SyndicationPlatformId>('website');
  const [reactLoading, setReactLoading] = useState<string | null>(null);
  const [gatherTypes, setGatherTypes] = useState<PostReactionKind[]>([
    'insightful',
    'support',
    'celebrate'
  ]);
  const [gatherPlatforms, setGatherPlatforms] = useState<SyndicationPlatformId[]>([
    'website',
    'meta_facebook',
    'meta_instagram',
    'youtube'
  ]);
  const [gatherCount, setGatherCount] = useState<number>(6);
  const [gatherSubmitting, setGatherSubmitting] = useState(false);
  const [reactionFeedback, setReactionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Cross-platform syndication state
  const [syndicateArticleId, setSyndicateArticleId] = useState<string>(() => articles[0]?.id ?? '');
  const [syndicatePlatforms, setSyndicatePlatforms] = useState<SyndicationPlatformId[]>(
    PLATFORM_OPTIONS.map((p) => p.id)
  );
  const [syndicateNote, setSyndicateNote] = useState('');
  const [syndicating, setSyndicating] = useState(false);
  const [syndicateFeedback, setSyndicateFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedReactArticleId =
    articles.some((a) => a.id === reactArticleId) ? reactArticleId : articles[0]?.id ?? '';
  const selectedCommentArticleId =
    articles.some((a) => a.id === commentArticleId) ? commentArticleId : articles[0]?.id ?? '';
  const selectedSyndicateArticleId =
    articles.some((a) => a.id === syndicateArticleId) ? syndicateArticleId : articles[0]?.id ?? '';

  const copyValue = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  const toggleFollowDesk = (desk: string) => {
    setFollowDesks((prev) =>
      prev.includes(desk)
        ? prev.length > 1
          ? prev.filter((d) => d !== desk)
          : prev
        : [...prev, desk].slice(0, 6)
    );
  };

  const toggleGatherType = (kind: PostReactionKind) => {
    setGatherTypes((prev) =>
      prev.includes(kind)
        ? prev.length > 1
          ? prev.filter((item) => item !== kind)
          : prev
        : [...prev, kind]
    );
  };

  const toggleGatherPlatform = (plat: SyndicationPlatformId) => {
    setGatherPlatforms((prev) =>
      prev.includes(plat)
        ? prev.length > 1
          ? prev.filter((item) => item !== plat)
          : prev
        : [...prev, plat]
    );
  };

  const toggleSyndicatePlatform = (plat: SyndicationPlatformId) => {
    setSyndicatePlatforms((prev) =>
      prev.includes(plat)
        ? prev.length > 1
          ? prev.filter((item) => item !== plat)
          : prev
        : [...prev, plat]
    );
  };

  const handleFollowSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFollowMessage(null);
    if (followName.trim().length < 2) {
      setFollowMessage({ type: 'error', text: 'Please enter at least 2 characters for your name.' });
      return;
    }

    setFollowSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      const res = await fetch('/api/community/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUid: currentUser?.uid ?? 'reader',
          displayName: followName.trim(),
          handle: followHandle.trim(),
          country: followCountry.trim() || 'Ghana',
          continent: followContinent,
          preferredDesks: followDesks,
          verifiedMember: Boolean(currentUser?.emailVerified)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not join community.');
      }

      if (currentUser?.emailVerified && data.follower) {
        void syncCommunityFollowerToFirestore(currentUser, {
          id: data.follower.id,
          displayName: data.follower.displayName,
          handle: data.follower.handle,
          country: data.follower.country,
          continent: data.follower.continent,
          preferredDesks: data.follower.preferredDesks,
          status: data.follower.status
        }).catch(() => {});
      }

      onCommunityUpdated(data as CommunitySnapshotResponse);
      setFollowName('');
      setFollowHandle('');
      setFollowMessage({ type: 'success', text: data.message as string });
    } catch (err: unknown) {
      setFollowMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save follower profile.'
      });
    } finally {
      setFollowSubmitting(false);
    }
  };

  const handleToggleFollowerStatus = async (followerId: string) => {
    try {
      const res = await fetch('/api/community/unfollow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId })
      });
      const data = await res.json();
      if (!res.ok) return;
      onCommunityUpdated(data as CommunitySnapshotResponse);
      setFollowMessage({ type: 'success', text: data.message as string });
    } catch {
      // Ignore transient toggle error
    }
  };

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCommentFeedback(null);
    if (commentAuthorName.trim().length < 2) {
      setCommentFeedback({ type: 'error', text: 'Please enter your name or @handle first.' });
      return;
    }

    setCommentSubmitting(true);
    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: selectedCommentArticleId,
          authorName: commentAuthorName.trim(),
          country: commentCountry.trim() || 'Ghana',
          body: commentBody.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Comment rejected by healthy discourse moderation.');
      }
      onCommunityUpdated(data as CommunitySnapshotResponse);
      setCommentBody('');
      setCommentFeedback({ type: 'success', text: data.message as string });
    } catch (err: unknown) {
      setCommentFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to publish comment.'
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleHelpfulUpvote = async (commentId: string) => {
    try {
      const res = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}/helpful`, {
        method: 'POST'
      });
      if (!res.ok) return;
      const data = (await res.json()) as CommunitySnapshotResponse;
      onCommunityUpdated(data);
    } catch {
      // Ignore transient error
    }
  };

  const handleSingleReact = async (reactionType: PostReactionKind) => {
    if (!selectedReactArticleId) return;
    setReactionFeedback(null);
    setReactLoading(reactionType);
    try {
      const currentUser = auth.currentUser;
      const res = await fetch(`/api/articles/${encodeURIComponent(selectedReactArticleId)}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reactionType,
          sourcePlatform: reactPlatform,
          reactorLabel: currentUser?.displayName || followName.trim() || 'News Hub Reader',
          ownerUid: currentUser?.uid ?? 'reader'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not record post reaction.');
      }

      if (currentUser?.emailVerified && data.reaction) {
        void syncPostReactionToFirestore(currentUser, {
          id: data.reaction.id,
          articleId: data.reaction.articleId,
          reactionType: data.reaction.reactionType,
          sourcePlatform: data.reaction.sourcePlatform,
          reactorLabel: data.reaction.reactorLabel
        }).catch(() => {});
      }

      onCommunityUpdated(data as CommunitySnapshotResponse);
      setReactionFeedback({ type: 'success', text: data.message as string });
    } catch (err: unknown) {
      setReactionFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to add reaction.'
      });
    } finally {
      setReactLoading(null);
    }
  };

  const handleGatherBatchReactions = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedReactArticleId) return;
    setReactionFeedback(null);
    setGatherSubmitting(true);
    try {
      const res = await fetch('/api/community/reactions/gather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: selectedReactArticleId,
          reactionTypes: gatherTypes,
          platforms: gatherPlatforms,
          batchCount: gatherCount
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not generate reactions across platforms.');
      }
      onCommunityUpdated(data as CommunitySnapshotResponse);
      setReactionFeedback({ type: 'success', text: data.message as string });
    } catch (err: unknown) {
      setReactionFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to generate post reactions.'
      });
    } finally {
      setGatherSubmitting(false);
    }
  };

  const handleSyndicateStory = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSyndicateArticleId) return;
    setSyndicateFeedback(null);
    setSyndicating(true);
    try {
      const currentUser = auth.currentUser;
      const res = await fetch(
        `/api/articles/${encodeURIComponent(selectedSyndicateArticleId)}/publish-across-platforms`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platforms: syndicatePlatforms,
            customNote: syndicateNote.trim() || undefined,
            ownerUid: currentUser?.uid ?? 'creator'
          })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Cross-platform publication failed.');
      }

      if (currentUser && isAgencyAdminUser(currentUser) && data.syndication) {
        void syncCrossPlatformSyndicationToFirestore(currentUser, {
          id: data.syndication.id,
          articleId: data.syndication.articleId,
          articleTitle: data.syndication.articleTitle,
          category: data.syndication.category,
          platforms: data.syndication.platforms,
          canonicalUrl: data.syndication.canonicalUrl,
          summaryNote: data.syndication.summaryNote,
          status: data.syndication.status
        }).catch(() => {});
      }

      onCommunityUpdated(data as CommunitySnapshotResponse);
      setSyndicateNote('');
      setSyndicateFeedback({ type: 'success', text: data.message as string });
    } catch (err: unknown) {
      setSyndicateFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to syndicate story.'
      });
    } finally {
      setSyndicating(false);
    }
  };

  const selectedArticleTally: ArticleReactionTally = community?.reactionsByArticle[
    selectedReactArticleId
  ] ?? {
    insightful: 0,
    support: 0,
    celebrate: 0,
    curious: 0,
    shareworthy: 0,
    total: 0,
    lastReactedAt: null
  };

  const topReactedStories = articles
    .map((art) => ({
      article: art,
      tally: community?.reactionsByArticle[art.id]
    }))
    .filter((entry) => (entry.tally?.total ?? 0) > 0)
    .sort((a, b) => (b.tally?.total ?? 0) - (a.tally?.total ?? 0))
    .slice(0, 6);

  return (
    <section
      id="community"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#121210]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-16">
        {/* Section Header & Tab Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#D6D1C7] dark:border-[#2C2A26]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#991B1B] dark:text-[#F87171] mb-2">
              Healthy Community · Cross-Platform Distribution · Live Deploy
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE]">
              Community Followers, Post Reactions &amp; Cross-Platform Publishing
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] max-w-3xl mt-2 leading-relaxed">
              Verified reader followers with zero fabricated metrics, respectful moderated newsroom dialogue, interactive post reaction tools across connected channels, and one-click story syndication.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenPublishModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Write &amp; Cross-Publish Story</span>
            </button>
          </div>
        </div>

        {/* KPI Bar (Strict Tabular Numerals, Clean Hairline Borders) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 my-8">
          <div className="p-4 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1">
              Real Active Followers
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums text-[#141413] dark:text-[#F5F3EE]">
              {(community?.stats.totalFollowers ?? 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-[#14532D] dark:text-[#4ADE80] font-mono tabular-nums mt-1">
              {community?.stats.verifiedFollowers ?? 0} verified members
            </p>
          </div>

          <div className="p-4 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1">
              Post Reactions
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums text-[#141413] dark:text-[#F5F3EE]">
              {(community?.stats.totalReactions ?? 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-1">
              Across all published stories
            </p>
          </div>

          <div className="p-4 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1">
              Healthy Dialogue Score
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums text-[#14532D] dark:text-[#4ADE80]">
              {(community?.stats.healthyScorePct ?? 100).toFixed(1)}%
            </p>
            <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] font-mono tabular-nums mt-1">
              {community?.stats.totalComments ?? 0} approved · {community?.stats.moderatedBlockedCount ?? 0} filtered
            </p>
          </div>

          <div className="p-4 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1">
              Engagement Rate
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums text-[#141413] dark:text-[#F5F3EE]">
              {(community?.stats.engagementRatePct ?? 0).toFixed(2)}%
            </p>
            <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] font-mono tabular-nums mt-1">
              {(community?.stats.totalSyndications ?? 0).toLocaleString()} platform dispatches
            </p>
          </div>

          <div className="col-span-2 lg:col-span-1 p-4 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E] mb-1">
              App Deploy State
            </p>
            <p
              className={`font-mono text-lg font-bold tabular-nums ${
                deployStatus?.deployed
                  ? 'text-[#14532D] dark:text-[#4ADE80]'
                  : 'text-[#991B1B] dark:text-[#F87171]'
              }`}
            >
              {deployStatus?.deployed ? 'LIVE & READY' : 'DEV ACTIVE'}
            </p>
            <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate mt-1">
              {deployStatus?.primaryDomain ?? 'newshub24plus.com'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Community and Cross-Platform Publishing Tabs"
          className="flex items-center gap-2 overflow-x-auto pb-2 mb-8 border-b border-[#D6D1C7] dark:border-[#2C2A26]"
        >
          {(
            [
              { id: 'followers', label: 'Healthy Community & Followers', icon: Users },
              { id: 'reactions', label: 'Post Reactions Studio', icon: MessageSquareHeart },
              { id: 'syndicate', label: 'Publish Across Platforms', icon: Share2 },
              { id: 'deploy', label: 'Live Deployment & URLs', icon: Radio }
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#141413] dark:bg-[#F5F3EE] text-white dark:text-[#141413] border-[#141413] dark:border-[#F5F3EE]'
                    : 'bg-[#FBF9F5] dark:bg-[#191816] text-[#44403C] dark:text-[#D6D3CD] border-[#D6D1C7] dark:border-[#3A3732] hover:border-[#141413] dark:hover:border-[#F5F3EE]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: HEALTHY COMMUNITY & REAL FOLLOWERS */}
        {activeTab === 'followers' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Follow Form + Geographic Footprint */}
            <div className="lg:col-span-5 space-y-6">
              <form
                onSubmit={handleFollowSubmit}
                className="p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4"
              >
                <div className="flex items-center gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                  <UserPlus className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                  <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                    Follow News Hub 24+
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="nh-follow-name"
                      className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                    >
                      Your Full Name
                    </label>
                    <input
                      id="nh-follow-name"
                      type="text"
                      required
                      value={followName}
                      onChange={(e) => setFollowName(e.target.value)}
                      placeholder="e.g. Ama Boateng"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="nh-follow-handle"
                      className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                    >
                      Reader @Handle
                    </label>
                    <input
                      id="nh-follow-handle"
                      type="text"
                      value={followHandle}
                      onChange={(e) => setFollowHandle(e.target.value)}
                      placeholder="@amaboateng"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="nh-follow-country"
                      className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                    >
                      Country
                    </label>
                    <input
                      id="nh-follow-country"
                      type="text"
                      value={followCountry}
                      onChange={(e) => setFollowCountry(e.target.value)}
                      placeholder="Ghana"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="nh-follow-continent"
                      className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                    >
                      Region / Continent
                    </label>
                    <select
                      id="nh-follow-continent"
                      value={followContinent}
                      onChange={(e) =>
                        setFollowContinent(
                          e.target.value as
                            | 'Africa'
                            | 'Europe'
                            | 'North America'
                            | 'Asia & Middle East'
                        )
                      }
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      {CONTINENTS.map((cont) => (
                        <option key={cont} value={cont}>
                          {cont}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <fieldset>
                  <legend className="text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-2">
                    Preferred News Desks ({followDesks.length} selected)
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {ARTICLE_CATALOGS.slice(0, 8).map((desk) => (
                      <label
                        key={desk}
                        className="flex items-center gap-2 text-xs text-[#292524] dark:text-[#D6D3CD] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={followDesks.includes(desk)}
                          onChange={() => toggleFollowDesk(desk)}
                          className="accent-[#991B1B]"
                        />
                        <span className="truncate">{desk}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {followMessage && (
                  <p
                    role="status"
                    className={`text-xs font-medium ${
                      followMessage.type === 'success'
                        ? 'text-[#14532D] dark:text-[#4ADE80]'
                        : 'text-[#991B1B] dark:text-[#FCA5A5]'
                    }`}
                  >
                    {followMessage.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={followSubmitting}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#141413] hover:bg-[#292524] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors disabled:opacity-60"
                >
                  {followSubmitting ? 'Saving Follower Profile…' : 'Follow News Hub 24+ Community'}
                </button>
              </form>

              {/* Continental Breakdown */}
              <div className="p-5 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <h4 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE] mb-3">
                  Verified Global Follower Footprint
                </h4>
                <div className="space-y-2.5">
                  {CONTINENTS.map((cont) => {
                    const count = community?.stats.continentCounts[cont] ?? 0;
                    const total = Math.max(1, community?.stats.totalFollowers ?? 1);
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={cont} className="text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[#292524] dark:text-[#D6D3CD]">{cont}</span>
                          <span className="font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <progress
                          value={count}
                          max={total}
                          aria-label={`${cont} followers`}
                          className="w-full h-1.5 rounded overflow-hidden accent-[#14532D] dark:accent-[#4ADE80] [&::-webkit-progress-bar]:bg-[#E5E2DC] dark:[&::-webkit-progress-bar]:bg-[#2C2A26] [&::-webkit-progress-value]:bg-[#14532D] dark:[&::-webkit-progress-value]:bg-[#4ADE80]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Followers Directory + Healthy Discussion Thread */}
            <div className="lg:col-span-7 space-y-6">
              {/* Followers Directory */}
              <div className="p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#14532D] dark:text-[#4ADE80]" />
                    <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                      Active Community Followers ({community?.followers.length ?? 0})
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]">
                    Non-PII Public Roster
                  </span>
                </div>

                {!community || community.followers.length === 0 ? (
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] py-4">
                    No reader followers recorded yet. Submit the form on the left to become the first verified follower.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-72 overflow-y-auto pr-1">
                    {community.followers.map((flw) => (
                      <div
                        key={flw.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                              {flw.displayName}
                            </span>
                            <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                              {flw.handle}
                            </span>
                            {flw.verifiedMember && (
                              <span className="text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
                                · Verified Reader
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                            {flw.country} ({flw.continent}) · Desks: {flw.preferredDesks.join(', ')}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleToggleFollowerStatus(flw.id)}
                          className={`self-start sm:self-center px-3 py-1 text-[11px] font-semibold rounded border transition-colors whitespace-nowrap shrink-0 ${
                            flw.status === 'following'
                              ? 'text-[#14532D] dark:text-[#4ADE80] border-[#BBF7D0] dark:border-[#166534] bg-[#F0FDF4] dark:bg-[#0E2416]'
                              : 'text-[#57534E] dark:text-[#A8A29E] border-[#D6D1C7] dark:border-[#3A3732] bg-white dark:bg-[#121210]'
                          }`}
                        >
                          {flw.status === 'following' ? 'Following (Pause)' : 'Paused (Resume)'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Healthy Moderated Discourse */}
              <div className="p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#14532D] dark:text-[#4ADE80]" />
                    <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                      Healthy Community Dialogue
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#14532D] dark:text-[#4ADE80]">
                    Respectful Discourse Moderation Active
                  </span>
                </div>

                <form onSubmit={handleCommentSubmit} className="space-y-3">
                  <div>
                    <label
                      htmlFor="nh-comment-article"
                      className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                    >
                      Dispatch Under Discussion
                    </label>
                    <select
                      id="nh-comment-article"
                      value={selectedCommentArticleId}
                      onChange={(e) => setCommentArticleId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      {articles.slice(0, 20).map((art) => (
                        <option key={art.id} value={art.id}>
                          [{art.category}] {art.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="nh-comment-author"
                        className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                      >
                        Display Name
                      </label>
                      <input
                        id="nh-comment-author"
                        type="text"
                        required
                        value={commentAuthorName}
                        onChange={(e) => setCommentAuthorName(e.target.value)}
                        placeholder="e.g. Kwame Mensah"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="nh-comment-country"
                        className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                      >
                        Bureau / City
                      </label>
                      <input
                        id="nh-comment-country"
                        type="text"
                        value={commentCountry}
                        onChange={(e) => setCommentCountry(e.target.value)}
                        placeholder="Accra, Ghana"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="nh-comment-body"
                      className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                    >
                      Constructive Reader Insight (6–600 chars, spam/harassment filtered)
                    </label>
                    <textarea
                      id="nh-comment-body"
                      rows={3}
                      required
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Share verified context, policy perspective, or respectful analysis on this dispatch…"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>

                  {commentFeedback && (
                    <p
                      role="status"
                      className={`text-xs font-medium ${
                        commentFeedback.type === 'success'
                          ? 'text-[#14532D] dark:text-[#4ADE80]'
                          : 'text-[#991B1B] dark:text-[#FCA5A5]'
                      }`}
                    >
                      {commentFeedback.text}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={commentSubmitting}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] dark:bg-[#059669] dark:hover:bg-[#047857] rounded-md transition-colors disabled:opacity-60"
                  >
                    <MessageSquareHeart className="w-3.5 h-3.5" />
                    <span>{commentSubmitting ? 'Checking Standards…' : 'Post Healthy Comment'}</span>
                  </button>
                </form>

                <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                  {!community || community.comments.length === 0 ? (
                    <p className="text-xs text-[#57534E] dark:text-[#A8A29E] pt-4">
                      Start the conversation on any front-page dispatch above.
                    </p>
                  ) : (
                    community.comments.slice(0, 8).map((cmt) => (
                      <div key={cmt.id} className="py-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                          <div>
                            <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                              {cmt.authorName}
                            </span>{' '}
                            <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                              {cmt.authorHandle} · {cmt.country}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleHelpfulUpvote(cmt.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-mono tabular-nums border border-[#D6D1C7] dark:border-[#3A3732] rounded hover:border-[#14532D] text-[#44403C] dark:text-[#D6D3CD]"
                          >
                            <ThumbsUp className="w-3 h-3 text-[#14532D] dark:text-[#4ADE80]" />
                            <span>Helpful ({cmt.helpfulCount})</span>
                          </button>
                        </div>
                        <p className="text-xs text-[#292524] dark:text-[#E5E2DC] leading-relaxed mb-1">
                          {cmt.body}
                        </p>
                        <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] truncate">
                          Re: {cmt.articleTitle}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: POST REACTIONS STUDIO */}
        {activeTab === 'reactions' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 space-y-6">
              {/* 1-Click Direct Reaction */}
              <div className="p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
                <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                  React Directly to a Story Post
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="nh-react-article"
                      className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                    >
                      Select Story Post
                    </label>
                    <select
                      id="nh-react-article"
                      value={selectedReactArticleId}
                      onChange={(e) => setReactArticleId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      {articles.slice(0, 24).map((art) => (
                        <option key={art.id} value={art.id}>
                          [{art.category}] {art.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="nh-react-platform"
                      className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                    >
                      Source Platform
                    </label>
                    <select
                      id="nh-react-platform"
                      value={reactPlatform}
                      onChange={(e) => setReactPlatform(e.target.value as SyndicationPlatformId)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    >
                      {PLATFORM_OPTIONS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {REACTION_META.map((item) => {
                    const Icon = item.icon;
                    const count = selectedArticleTally[item.id];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={reactLoading !== null}
                        onClick={() => void handleSingleReact(item.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors whitespace-nowrap shrink-0"
                      >
                        <Icon className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                        <span>{item.label}</span>
                        <span className="font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate Cross-Platform Post Reactions Batch */}
              <form
                onSubmit={handleGatherBatchReactions}
                className="p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4"
              >
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                    Generate &amp; Gather Post Reactions Across Platforms
                  </h3>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
                    Batch-collect engagement reactions for the selected story across Meta Facebook, Instagram, Threads, WhatsApp, YouTube, Android APK, and Base44.
                  </p>
                </div>

                <fieldset>
                  <legend className="text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-2">
                    Reaction Types to Generate
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {REACTION_META.map((item) => (
                      <label
                        key={item.id}
                        className="inline-flex items-center gap-1.5 text-xs text-[#292524] dark:text-[#D6D3CD] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={gatherTypes.includes(item.id)}
                          onChange={() => toggleGatherType(item.id)}
                          className="accent-[#991B1B]"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-2">
                    Connected Source Platforms ({gatherPlatforms.length} selected)
                  </legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PLATFORM_OPTIONS.map((p) => (
                      <label
                        key={p.id}
                        className="inline-flex items-center gap-1.5 text-xs text-[#292524] dark:text-[#D6D3CD] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={gatherPlatforms.includes(p.id)}
                          onChange={() => toggleGatherPlatform(p.id)}
                          className="accent-[#991B1B]"
                        />
                        <span>{p.shortLabel}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-36">
                    <label
                      htmlFor="nh-gather-count"
                      className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                    >
                      Reactions (1–25)
                    </label>
                    <input
                      id="nh-gather-count"
                      type="number"
                      min={1}
                      max={25}
                      value={gatherCount}
                      onChange={(e) => setGatherCount(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
                      className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={gatherSubmitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    {gatherSubmitting ? 'Generating Reactions…' : 'Generate Post Reactions'}
                  </button>
                </div>

                {reactionFeedback && (
                  <p
                    role="status"
                    className={`text-xs font-medium ${
                      reactionFeedback.type === 'success'
                        ? 'text-[#14532D] dark:text-[#4ADE80]'
                        : 'text-[#991B1B] dark:text-[#FCA5A5]'
                    }`}
                  >
                    {reactionFeedback.text}
                  </p>
                )}
              </form>
            </div>

            {/* Right Column: Top Reacted Stories & Live Event Feed */}
            <div className="lg:col-span-6 space-y-6">
              <div className="p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE] pb-3 mb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                  Top Reacted Posts Leaderboard
                </h3>
                {topReactedStories.length === 0 ? (
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] py-3">
                    Use any reaction button on the left or on a story card to record live post reactions.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                    {topReactedStories.map(({ article, tally }) => (
                      <div key={article.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpenArticle(article)}
                            className="text-left text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171] line-clamp-1"
                          >
                            {article.title}
                          </button>
                          <p className="text-[11px] font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E] mt-1">
                            Insightful {tally?.insightful ?? 0} · Support {tally?.support ?? 0} · Celebrate{' '}
                            {tally?.celebrate ?? 0} · Curious {tally?.curious ?? 0} · Shareworthy{' '}
                            {tally?.shareworthy ?? 0}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-bold tabular-nums text-[#991B1B] dark:text-[#F87171] shrink-0">
                          {tally?.total ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE] pb-3 mb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                  Recent Cross-Platform Reaction Log
                </h3>
                {!community || community.recentReactionEvents.length === 0 ? (
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                    No reactions recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-64 overflow-y-auto pr-1">
                    {community.recentReactionEvents.slice(0, 15).map((evt) => (
                      <div key={evt.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="text-[#141413] dark:text-[#F5F3EE] truncate">
                            <span className="font-semibold capitalize">{evt.reactionType}</span> on{' '}
                            <span className="font-medium">{evt.articleTitle}</span>
                          </p>
                          <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                            {evt.reactorLabel} via {evt.sourcePlatformLabel}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] tabular-nums text-[#78716C] dark:text-[#A8A29E] shrink-0">
                          {new Date(evt.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PUBLISH STORIES ACROSS PLATFORMS */}
        {activeTab === 'syndicate' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form
              onSubmit={handleSyndicateStory}
              className="lg:col-span-5 p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4"
            >
              <div className="flex items-center gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <Globe className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Publish Story Across All Connected Platforms
                </h3>
              </div>

              <div>
                <label
                  htmlFor="nh-syndicate-article"
                  className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                >
                  Choose Story to Syndicate
                </label>
                <select
                  id="nh-syndicate-article"
                  value={selectedSyndicateArticleId}
                  onChange={(e) => setSyndicateArticleId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                >
                  {articles.slice(0, 24).map((art) => (
                    <option key={art.id} value={art.id}>
                      [{art.category}] {art.title}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-2">
                  Target Platforms ({syndicatePlatforms.length} selected)
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PLATFORM_OPTIONS.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-xs text-[#292524] dark:text-[#D6D3CD] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={syndicatePlatforms.includes(p.id)}
                        onChange={() => toggleSyndicatePlatform(p.id)}
                        className="accent-[#991B1B]"
                      />
                      <span className="truncate">{p.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label
                  htmlFor="nh-syndicate-note"
                  className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] mb-1"
                >
                  Optional Cross-Platform Dispatch Note
                </label>
                <textarea
                  id="nh-syndicate-note"
                  rows={2}
                  value={syndicateNote}
                  onChange={(e) => setSyndicateNote(e.target.value)}
                  placeholder="Optional custom caption for Meta Facebook, Threads, WhatsApp, and Base44 push…"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              {syndicateFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium ${
                    syndicateFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#4ADE80]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5]'
                  }`}
                >
                  {syndicateFeedback.text}
                </p>
              )}

              <button
                type="submit"
                disabled={syndicating}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors disabled:opacity-60"
              >
                {syndicating
                  ? 'Publishing Across Platforms…'
                  : `Publish Across ${syndicatePlatforms.length} Connected Platforms`}
              </button>
            </form>

            {/* Syndication Receipt Log */}
            <div className="lg:col-span-7 p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
              <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Cross-Platform Story Syndication Receipts ({community?.syndications.length ?? 0})
                </h3>
                <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]">
                  Live Meta Graph · Webhooks · UTM Feeds
                </span>
              </div>

              {!community || community.syndications.length === 0 ? (
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] py-4">
                  Select a story on the left and publish across connected channels to inspect tracked delivery links.
                </p>
              ) : (
                <div className="space-y-4 max-h-[30rem] overflow-y-auto pr-1">
                  {community.syndications.map((syn) => (
                    <div
                      key={syn.id}
                      className="p-4 bg-white dark:bg-[#121210] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[11px] font-mono text-[#991B1B] dark:text-[#F87171]">
                            {syn.id} · {syn.category}
                          </span>
                          <h4 className="text-sm font-serif font-bold text-[#141413] dark:text-[#F5F3EE]">
                            {syn.articleTitle}
                          </h4>
                        </div>
                        <span className="px-2 py-0.5 text-[11px] font-mono font-semibold text-[#14532D] dark:text-[#4ADE80] border border-[#BBF7D0] dark:border-[#166534] bg-[#F0FDF4] dark:bg-[#0E2416] rounded">
                          {syn.status === 'published' ? 'Published' : 'Partial'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {syn.deliveryResults.map((resItem) => (
                          <div
                            key={`${syn.id}-${resItem.platform}`}
                            className="p-2.5 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-2 font-semibold text-[#141413] dark:text-[#F5F3EE]">
                              <span>{resItem.platformLabel}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  void copyValue(`${syn.id}-${resItem.platform}`, resItem.trackedUrl)
                                }
                                className="inline-flex items-center gap-1 text-[10px] font-mono text-[#57534E] hover:text-[#991B1B] dark:text-[#A8A29E]"
                              >
                                {copiedKey === `${syn.id}-${resItem.platform}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#14532D]" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy UTM</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-[#57534E] dark:text-[#A8A29E] mt-1">{resItem.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: LIVE APP DEPLOYMENT & CONNECTED URLS */}
        {activeTab === 'deploy' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-5">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                    Live Deployed URLs &amp; App Endpoints
                  </h3>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                    Firebase Project: <span className="font-mono">{deployStatus?.firebaseProjectId ?? 'com-aistudio-newshub24pl-8459f'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRefreshDeployStatus}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#121210] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Verify Build</span>
                </button>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: 'shared-url',
                    label: 'Public Shared App URL (Accessible Online)',
                    value:
                      deployStatus?.sharedAppUrl ??
                      'https://ais-pre-qu7wretydoetjwztwauaud-827871246101.europe-west2.run.app'
                  },
                  {
                    key: 'dev-url',
                    label: 'Development Server Origin',
                    value: deployStatus?.developmentAppUrl ?? window.location.origin
                  },
                  {
                    key: 'base44-url',
                    label: 'Base44 Mother App Link',
                    value:
                      deployStatus?.base44AppUrl ??
                      'https://aloof-daily-news-pulse.base44.app/story/6b04f190aa908b27ce284a57'
                  },
                  {
                    key: 'domain-url',
                    label: 'Official Agency Domain',
                    value: `https://${deployStatus?.primaryDomain ?? 'newshub24plus.com'}`
                  }
                ].map((endpoint) => (
                  <div
                    key={endpoint.key}
                    className="p-3.5 bg-white dark:bg-[#121210] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E]">
                        {endpoint.label}
                      </p>
                      <p className="font-mono text-xs text-[#141413] dark:text-[#F5F3EE] truncate mt-0.5">
                        {endpoint.value}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void copyValue(endpoint.key, endpoint.value)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border border-[#D6D1C7] dark:border-[#3A3732] rounded hover:border-[#141413] text-[#292524] dark:text-[#D6D3CD]"
                      >
                        {copiedKey === endpoint.key ? (
                          <>
                            <Check className="w-3 h-3 text-[#14532D]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <a
                        href={endpoint.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#141413] dark:bg-[#DC2626] rounded hover:opacity-90"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 p-6 bg-[#FBF9F5] dark:bg-[#191816] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
              <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE] pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                Production &amp; Gateway Readiness Audit
              </h3>

              <div className="space-y-2.5 text-xs">
                {[
                  {
                    label: 'Production Bundle (dist/index.html)',
                    ready: Boolean(deployStatus?.distBuilt),
                    yesText: 'Built & Ready',
                    noText: 'Pending Build'
                  },
                  {
                    label: 'Firestore Security Rules Deployed',
                    ready: Boolean(deployStatus?.firestoreRulesReady),
                    yesText: 'Hardened & Live',
                    noText: 'Not Found'
                  },
                  {
                    label: 'Solana RPC Mainnet Settlement',
                    ready: Boolean(deployStatus?.integrations.solanaRpcLive),
                    yesText: 'Live RPC Verified',
                    noText: 'Offline'
                  },
                  {
                    label: 'Stripe Checkout & Webhooks',
                    ready: Boolean(deployStatus?.integrations.stripeLive),
                    yesText: 'Live Keys Active',
                    noText: 'Standby Ledger'
                  },
                  {
                    label: 'Flutterwave Pan-Africa Gateway',
                    ready: Boolean(deployStatus?.integrations.flutterwaveLive),
                    yesText: 'Live Keys Active',
                    noText: 'Standby Ledger'
                  },
                  {
                    label: 'PayPal Global Express',
                    ready: Boolean(deployStatus?.integrations.paypalLive),
                    yesText: 'Live Keys Active',
                    noText: 'Standby Ledger'
                  },
                  {
                    label: 'Meta Graph Page & Video Insights',
                    ready: Boolean(deployStatus?.integrations.metaGraphLive),
                    yesText: 'Live Graph Token',
                    noText: 'Webhook & UTM Active'
                  },
                  {
                    label: 'Google AdSense (/ads.txt)',
                    ready: Boolean(deployStatus?.integrations.adsensePublisherConfigured),
                    yesText: 'Publisher ID Live',
                    noText: 'Awaiting Env Publisher ID'
                  }
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 py-1.5 border-b border-[#E5E2DC] dark:border-[#2C2A26] last:border-b-0"
                  >
                    <span className="text-[#292524] dark:text-[#D6D3CD]">{row.label}</span>
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold whitespace-nowrap ${
                        row.ready
                          ? 'text-[#14532D] dark:text-[#4ADE80]'
                          : 'text-[#78716C] dark:text-[#A8A29E]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{row.ready ? row.yesText : row.noText}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
