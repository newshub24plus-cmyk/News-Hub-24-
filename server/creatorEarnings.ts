import fs from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic } from './realMonetization.ts';

export type CreatorPlatformModel = 'youtube' | 'tiktok';

export type CreatorSupportProductType =
  | 'youtube_super_thanks'
  | 'youtube_membership'
  | 'tiktok_live_gift'
  | 'tiktok_series_unlock';

export interface CreatorEarningsTransaction {
  id: string;
  platform: CreatorPlatformModel;
  productType: CreatorSupportProductType;
  label: string;
  targetTitle: string;
  supporterName: string;
  supporterEmail: string;
  grossUsd: number;
  processorFeeUsd: number;
  creatorNetUsd: number;
  coinsOrStarsCount: number;
  diamondsCredited: number;
  paymentRail: string;
  settlementMode: 'live_gateway' | 'live_treasury_rail';
  verifiedRealFunds: boolean;
  settlementReference: string;
  note?: string;
  createdAt: string;
}

export interface CreatorEarningsClaimRecord {
  id: string;
  youtubeUsd: number;
  tiktokUsd: number;
  totalClaimedUsd: number;
  equivalentSol: number;
  claimedAt: string;
  note: string;
}

export interface CreatorEarningsState {
  youtube: {
    subscribers: number;
    publicWatchHours: number;
    longFormViews: number;
    monetizedPlaybacks: number;
    shortsEngagedViews: number;
    premiumWatchMinutes: number;
    activeChannelMembers: number;
    watchPageAdNetUsd: number;
    shortsPoolNetUsd: number;
    membershipsMrrUsd: number;
    superThanksNetUsd: number;
    premiumShareNetUsd: number;
    claimedUsd: number;
  };
  tiktok: {
    followers: number;
    qualifiedViews60sPlus: number;
    totalWatchSeconds60sPlus: number;
    completedViews60sPlus: number;
    liveGiftCoinsReceived: number;
    diamondsBalance: number;
    seriesSalesCount: number;
    creatorRewardsNetUsd: number;
    liveGiftsDiamondsUsd: number;
    seriesPaywallNetUsd: number;
    sparkAdBoostNetUsd: number;
    claimedUsd: number;
  };
  transactions: CreatorEarningsTransaction[];
  claims: CreatorEarningsClaimRecord[];
}

const creatorEarningsPath = path.join(process.cwd(), 'server', 'creator-earnings.json');

function toCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(c: number): number {
  return Number((Math.round(c) / 100).toFixed(2));
}

export function loadCreatorEarningsState(): CreatorEarningsState {
  const defaults: CreatorEarningsState = {
    youtube: {
      subscribers: 0,
      publicWatchHours: 0,
      longFormViews: 0,
      monetizedPlaybacks: 0,
      shortsEngagedViews: 0,
      premiumWatchMinutes: 0,
      activeChannelMembers: 0,
      watchPageAdNetUsd: 0,
      shortsPoolNetUsd: 0,
      membershipsMrrUsd: 0,
      superThanksNetUsd: 0,
      premiumShareNetUsd: 0,
      claimedUsd: 0
    },
    tiktok: {
      followers: 0,
      qualifiedViews60sPlus: 0,
      totalWatchSeconds60sPlus: 0,
      completedViews60sPlus: 0,
      liveGiftCoinsReceived: 0,
      diamondsBalance: 0,
      seriesSalesCount: 0,
      creatorRewardsNetUsd: 0,
      liveGiftsDiamondsUsd: 0,
      seriesPaywallNetUsd: 0,
      sparkAdBoostNetUsd: 0,
      claimedUsd: 0
    },
    transactions: [],
    claims: []
  };

  try {
    if (fs.existsSync(creatorEarningsPath)) {
      const parsed = JSON.parse(fs.readFileSync(creatorEarningsPath, 'utf8')) as Partial<CreatorEarningsState>;
      if (parsed && parsed.youtube && parsed.tiktok) {
        return {
          youtube: { ...defaults.youtube, ...parsed.youtube },
          tiktok: { ...defaults.tiktok, ...parsed.tiktok },
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
          claims: Array.isArray(parsed.claims) ? parsed.claims : []
        };
      }
    }
  } catch {
    // Fallback cleanly
  }
  return defaults;
}

export function saveCreatorEarningsState(state: CreatorEarningsState): void {
  writeJsonAtomic(creatorEarningsPath, state);
}

export function computeTikTokDynamicRpmUsd(state: CreatorEarningsState): {
  qualifiedRpmUsd: number;
  completionRatePercent: number;
  avgWatchSeconds: number;
} {
  const qv = Math.max(0, state.tiktok.qualifiedViews60sPlus);
  const completionRatePercent =
    qv > 0 ? Number(Math.min(100, (state.tiktok.completedViews60sPlus / qv) * 100).toFixed(1)) : 0;
  const avgWatchSeconds =
    qv > 0 ? Number((state.tiktok.totalWatchSeconds60sPlus / qv).toFixed(1)) : 0;

  // Base $0.58 qualified RPM + up to $0.45 completion rate factor + up to $0.32 deep-watch multiplier
  const completionBonus = (completionRatePercent / 100) * 0.45;
  const watchDepthBonus = Math.min(0.32, (avgWatchSeconds / 75) * 0.32);
  const qualifiedRpmUsd = Number((0.58 + completionBonus + watchDepthBonus).toFixed(2));

  return {
    qualifiedRpmUsd,
    completionRatePercent,
    avgWatchSeconds
  };
}

export function computeYouTubeRpmMetrics(state: CreatorEarningsState): {
  watchPageRpmUsd: number;
  shortsRpmUsd: number;
  tier1FanFundingReady: boolean;
  tier2FullPartnerReady: boolean;
} {
  const views = Math.max(0, state.youtube.longFormViews);
  const totalWatchPageEarned = state.youtube.watchPageAdNetUsd + state.youtube.premiumShareNetUsd;
  const watchPageRpmUsd =
    views > 0 ? Number(((totalWatchPageEarned / views) * 1000).toFixed(2)) : 3.85;
  const shortsViews = Math.max(0, state.youtube.shortsEngagedViews);
  const shortsRpmUsd =
    shortsViews > 0 ? Number(((state.youtube.shortsPoolNetUsd / shortsViews) * 1000).toFixed(2)) : 0.11;

  const tier1FanFundingReady =
    state.youtube.subscribers >= 500 &&
    (state.youtube.publicWatchHours >= 3000 || state.youtube.shortsEngagedViews >= 3_000_000);
  const tier2FullPartnerReady =
    state.youtube.subscribers >= 1000 &&
    (state.youtube.publicWatchHours >= 4000 || state.youtube.shortsEngagedViews >= 10_000_000);

  return {
    watchPageRpmUsd,
    shortsRpmUsd,
    tier1FanFundingReady,
    tier2FullPartnerReady
  };
}

export function recordCreatorVideoEngagement(
  state: CreatorEarningsState,
  params: {
    format: 'youtube_long' | 'youtube_shorts' | 'tiktok_60s_plus';
    viewsDelta: number;
    watchSecondsDelta: number;
    completed?: boolean;
    premiumViewer?: boolean;
  }
): {
  youtubeEarnedUsd: number;
  tiktokEarnedUsd: number;
} {
  const safeViews = Math.max(0, Math.min(10000, Math.round(params.viewsDelta)));
  const safeSeconds = Math.max(0, Math.min(36000, Math.round(params.watchSecondsDelta)));
  let youtubeEarnedUsd = 0;
  let tiktokEarnedUsd = 0;

  if (params.format === 'youtube_long') {
    state.youtube.longFormViews += safeViews;
    state.youtube.monetizedPlaybacks += Math.max(safeViews, Math.round(safeSeconds / 15));
    state.youtube.publicWatchHours = Number(
      (state.youtube.publicWatchHours + safeSeconds / 3600).toFixed(4)
    );
    // Watch Page Ad RPM ($3.85 per 1,000 views + $1.26/hr creator share)
    const adUsd = (safeViews / 1000) * 3.85 + (safeSeconds / 3600) * 1.26;
    const premiumUsd = params.premiumViewer ? (safeSeconds / 60) * 0.008 : 0;
    if (params.premiumViewer) {
      state.youtube.premiumWatchMinutes = Number(
        (state.youtube.premiumWatchMinutes + safeSeconds / 60).toFixed(2)
      );
    }
    state.youtube.watchPageAdNetUsd = Number((state.youtube.watchPageAdNetUsd + adUsd).toFixed(4));
    state.youtube.premiumShareNetUsd = Number((state.youtube.premiumShareNetUsd + premiumUsd).toFixed(4));
    youtubeEarnedUsd = Number((adUsd + premiumUsd).toFixed(4));
  } else if (params.format === 'youtube_shorts') {
    state.youtube.shortsEngagedViews += safeViews;
    state.youtube.publicWatchHours = Number(
      (state.youtube.publicWatchHours + safeSeconds / 3600).toFixed(4)
    );
    // Shorts Feed Ad Pool: 45% creator net allocation (~$0.11 per 1k engaged views + watch bonus)
    const shortsUsd = (safeViews / 1000) * 0.11 + (safeSeconds / 3600) * 0.35;
    state.youtube.shortsPoolNetUsd = Number((state.youtube.shortsPoolNetUsd + shortsUsd).toFixed(4));
    youtubeEarnedUsd = Number(shortsUsd.toFixed(4));
  } else {
    state.tiktok.qualifiedViews60sPlus += safeViews;
    state.tiktok.totalWatchSeconds60sPlus += safeSeconds;
    if (params.completed) {
      state.tiktok.completedViews60sPlus += Math.max(1, safeViews);
    }
    const { qualifiedRpmUsd } = computeTikTokDynamicRpmUsd(state);
    // Creator Rewards payout based on qualified 1+ min views * dynamic RPM + watch depth
    const rewardUsd = (safeViews / 1000) * qualifiedRpmUsd + (safeSeconds / 3600) * 0.95;
    state.tiktok.creatorRewardsNetUsd = Number((state.tiktok.creatorRewardsNetUsd + rewardUsd).toFixed(4));
    tiktokEarnedUsd = Number(rewardUsd.toFixed(4));
  }

  return { youtubeEarnedUsd, tiktokEarnedUsd };
}

export function recordCreatorSupportInEarnings(
  state: CreatorEarningsState,
  params: {
    id: string;
    productType: CreatorSupportProductType;
    label: string;
    targetTitle: string;
    supporterName: string;
    supporterEmail: string;
    grossUsd: number;
    processorFeeUsd: number;
    paymentRail: string;
    settlementMode: 'live_gateway' | 'live_treasury_rail';
    verifiedRealFunds: boolean;
    settlementReference: string;
    note?: string;
  }
): CreatorEarningsTransaction {
  const grossCents = Math.max(1, toCents(params.grossUsd));
  const feeCents = Math.min(grossCents - 1, Math.max(0, toCents(params.processorFeeUsd)));
  const netBasisCents = grossCents - feeCents;
  // Creator share: 70% for YouTube Super Thanks / Memberships / TikTok Series & Diamonds
  const creatorNetCents = Math.round(netBasisCents * 0.7);
  const creatorNetUsd = fromCents(creatorNetCents);

  const isTikTok =
    params.productType === 'tiktok_live_gift' || params.productType === 'tiktok_series_unlock';
  const platform: CreatorPlatformModel = isTikTok ? 'tiktok' : 'youtube';

  // TikTok Coin / Diamond valuation: 100 Coins ≈ $1.29 gross -> creator receives Diamonds ($0.005 each)
  const coinsOrStarsCount = isTikTok
    ? Math.max(10, Math.round((fromCents(grossCents) / 1.29) * 100))
    : Math.round(fromCents(grossCents) * 100);
  const diamondsCredited =
    params.productType === 'tiktok_live_gift' ? Math.round(creatorNetUsd / 0.005) : 0;

  if (params.productType === 'youtube_super_thanks') {
    state.youtube.superThanksNetUsd = Number((state.youtube.superThanksNetUsd + creatorNetUsd).toFixed(2));
  } else if (params.productType === 'youtube_membership') {
    state.youtube.activeChannelMembers += 1;
    state.youtube.subscribers += 1;
    state.youtube.membershipsMrrUsd = Number((state.youtube.membershipsMrrUsd + creatorNetUsd).toFixed(2));
  } else if (params.productType === 'tiktok_live_gift') {
    state.tiktok.liveGiftCoinsReceived += coinsOrStarsCount;
    state.tiktok.diamondsBalance += diamondsCredited;
    state.tiktok.liveGiftsDiamondsUsd = Number((state.tiktok.liveGiftsDiamondsUsd + creatorNetUsd).toFixed(2));
  } else if (params.productType === 'tiktok_series_unlock') {
    state.tiktok.seriesSalesCount += 1;
    state.tiktok.seriesPaywallNetUsd = Number((state.tiktok.seriesPaywallNetUsd + creatorNetUsd).toFixed(2));
  }

  const record: CreatorEarningsTransaction = {
    id: params.id,
    platform,
    productType: params.productType,
    label: params.label,
    targetTitle: params.targetTitle,
    supporterName: params.supporterName,
    supporterEmail: params.supporterEmail,
    grossUsd: fromCents(grossCents),
    processorFeeUsd: fromCents(feeCents),
    creatorNetUsd,
    coinsOrStarsCount,
    diamondsCredited,
    paymentRail: params.paymentRail,
    settlementMode: params.settlementMode,
    verifiedRealFunds: params.verifiedRealFunds,
    settlementReference: params.settlementReference,
    note: params.note,
    createdAt: new Date().toISOString()
  };

  state.transactions.unshift(record);
  if (state.transactions.length > 60) {
    state.transactions.length = 60;
  }
  return record;
}

export function getUnclaimedCreatorEarnings(state: CreatorEarningsState): {
  youtubeTotalEarnedUsd: number;
  tiktokTotalEarnedUsd: number;
  youtubeClaimableUsd: number;
  tiktokClaimableUsd: number;
  totalClaimableUsd: number;
} {
  const youtubeTotalEarnedUsd = Number(
    (
      state.youtube.watchPageAdNetUsd +
      state.youtube.shortsPoolNetUsd +
      state.youtube.membershipsMrrUsd +
      state.youtube.superThanksNetUsd +
      state.youtube.premiumShareNetUsd
    ).toFixed(2)
  );
  const tiktokTotalEarnedUsd = Number(
    (
      state.tiktok.creatorRewardsNetUsd +
      state.tiktok.liveGiftsDiamondsUsd +
      state.tiktok.seriesPaywallNetUsd +
      state.tiktok.sparkAdBoostNetUsd
    ).toFixed(2)
  );

  const youtubeClaimableUsd = Number(Math.max(0, youtubeTotalEarnedUsd - state.youtube.claimedUsd).toFixed(2));
  const tiktokClaimableUsd = Number(Math.max(0, tiktokTotalEarnedUsd - state.tiktok.claimedUsd).toFixed(2));
  const totalClaimableUsd = Number((youtubeClaimableUsd + tiktokClaimableUsd).toFixed(2));

  return {
    youtubeTotalEarnedUsd,
    tiktokTotalEarnedUsd,
    youtubeClaimableUsd,
    tiktokClaimableUsd,
    totalClaimableUsd
  };
}

export function claimCreatorEarningsToTreasury(
  state: CreatorEarningsState,
  solUsdRate: number
): CreatorEarningsClaimRecord {
  const unclaimed = getUnclaimedCreatorEarnings(state);
  if (unclaimed.totalClaimableUsd < 0.01) {
    throw new Error('No unclaimed YouTube or TikTok earnings available yet. Record watch time, views, or fan support first.');
  }

  state.youtube.claimedUsd = Number((state.youtube.claimedUsd + unclaimed.youtubeClaimableUsd).toFixed(2));
  state.tiktok.claimedUsd = Number((state.tiktok.claimedUsd + unclaimed.tiktokClaimableUsd).toFixed(2));

  const claimRecord: CreatorEarningsClaimRecord = {
    id: `CE-CLM-${Date.now().toString(36).toUpperCase().slice(-5)}`,
    youtubeUsd: unclaimed.youtubeClaimableUsd,
    tiktokUsd: unclaimed.tiktokClaimableUsd,
    totalClaimedUsd: unclaimed.totalClaimableUsd,
    equivalentSol: Number((unclaimed.totalClaimableUsd / Math.max(1, solUsdRate)).toFixed(4)),
    claimedAt: new Date().toISOString(),
    note: `Swept YouTube Partner ($${unclaimed.youtubeClaimableUsd.toFixed(2)}) & TikTok Creator Rewards/Diamonds ($${unclaimed.tiktokClaimableUsd.toFixed(2)}) into Live Treasury.`
  };

  state.claims.unshift(claimRecord);
  if (state.claims.length > 40) {
    state.claims.length = 40;
  }

  return claimRecord;
}

export function buildCreatorEarningsOverviewPayload(
  state: CreatorEarningsState,
  extras: {
    revenueEngineWatchHours: number;
    monetizationSubscribers: number;
    monetizationMrrUsd: number;
    verifiedRealUsd: number;
    solUsdRate: number;
  }
) {
  const syncedWatchHours = Math.max(state.youtube.publicWatchHours, extras.revenueEngineWatchHours);
  const syncedSubscribers = Math.max(state.youtube.subscribers, extras.monetizationSubscribers);
  const ytRpm = computeYouTubeRpmMetrics({
    ...state,
    youtube: {
      ...state.youtube,
      publicWatchHours: syncedWatchHours,
      subscribers: syncedSubscribers
    }
  });
  const ttRpm = computeTikTokDynamicRpmUsd(state);
  const unclaimed = getUnclaimedCreatorEarnings(state);

  return {
    generatedAt: new Date().toISOString(),
    youtube: {
      ...state.youtube,
      publicWatchHours: Number(syncedWatchHours.toFixed(2)),
      subscribers: syncedSubscribers,
      watchPageRpmUsd: ytRpm.watchPageRpmUsd,
      shortsRpmUsd: ytRpm.shortsRpmUsd,
      tier1FanFundingReady: ytRpm.tier1FanFundingReady,
      tier2FullPartnerReady: ytRpm.tier2FullPartnerReady,
      goals: {
        tier1Subs: 500,
        tier1WatchHours: 3000,
        tier2Subs: 1000,
        tier2WatchHours: 4000,
        shortsViewsGoal: 10_000_000
      },
      totalEarnedUsd: unclaimed.youtubeTotalEarnedUsd,
      claimableUsd: unclaimed.youtubeClaimableUsd
    },
    tiktok: {
      ...state.tiktok,
      qualifiedRpmUsd: ttRpm.qualifiedRpmUsd,
      completionRatePercent: ttRpm.completionRatePercent,
      avgWatchSeconds: ttRpm.avgWatchSeconds,
      goals: {
        followersGoal: 10_000,
        monthlyViewsGoal: 100_000,
        minVideoSeconds: 60
      },
      totalEarnedUsd: unclaimed.tiktokTotalEarnedUsd,
      claimableUsd: unclaimed.tiktokClaimableUsd
    },
    combined: {
      totalLifetimeCreatorUsd: Number((unclaimed.youtubeTotalEarnedUsd + unclaimed.tiktokTotalEarnedUsd).toFixed(2)),
      totalClaimableUsd: unclaimed.totalClaimableUsd,
      totalClaimableSol: Number((unclaimed.totalClaimableUsd / Math.max(1, extras.solUsdRate)).toFixed(4)),
      verifiedRealExternalUsd: extras.verifiedRealUsd,
      creatorSharePercent: 70
    },
    recentTransactions: state.transactions.slice(0, 16),
    recentClaims: state.claims.slice(0, 10)
  };
}
