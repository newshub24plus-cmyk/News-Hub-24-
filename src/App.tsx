import {
  ArrowRight,
  Bell,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  Link2,
  Lock,
  Menu,
  Moon,
  PenSquare,
  Search,
  Settings,
  Share2,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Sun,
  ThumbsUp,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AiNewsroomModal } from './components/AiNewsroomModal';
import { ApkInspectionModal } from './components/ApkInspectionModal';
import { ArticleModal } from './components/ArticleModal';
import { AuthorProfileDrawer, type SelectedAuthorTarget } from './components/AuthorProfileDrawer';
import { BreakingNewsBanner } from './components/BreakingNewsBanner';
import {
  CommunityEngagementSection,
  type CommunitySnapshotResponse,
  type DeployStatusResponse,
  type PostReactionKind
} from './components/CommunityEngagementSection';
import { ConfidentialTipBotModal } from './components/ConfidentialTipBotModal';
import {
  CreatorNotificationCenter,
  type CreatorNotificationItem,
  type NotificationsStateResponse
} from './components/CreatorNotificationCenter';
import { EditorialImage } from './components/EditorialImage';
import { GlobalFinancialPlatformSection } from './components/GlobalFinancialPlatformSection';
import { MonetizationSection, type MonetizationStateResponse, type PayoutConfig } from './components/MonetizationSection';
import {
  PaymentModal,
  type MonetizationPlan,
  type MonetizationSummary,
  type MonetizationTransaction,
  type SponsoredCampaign,
  type TrendingAdBoost
} from './components/PaymentModal';
import {
  OfficialDomainSection,
  type DomainConfigResponse,
  type DomainConfigState
} from './components/OfficialDomainSection';
import {
  OwnerWithdrawalSection,
  type OwnerPayoutsResponse,
  type RewardsSummaryResponse
} from './components/OwnerWithdrawalSection';
import { PerformanceDashboardSection, type AnalyticsResponse } from './components/PerformanceDashboardSection';
import {
  PlatformThresholdSection,
  type ConnectedVideoPlatform,
  type PlatformThresholdsResponse
} from './components/PlatformThresholdSection';
import { PublishStoryModal } from './components/PublishStoryModal';
import {
  SearchVisibilityDiagnostics,
  type SearchVisibilityAuditResponse
} from './components/SearchVisibilityDiagnostics';
import { SecurityShieldSection } from './components/SecurityShieldSection';
import { SeoInspectorModal } from './components/SeoInspectorModal';
import { DEFAULT_GLOBAL_SEO_SETTINGS, SeoSettingsModal } from './components/SeoSettingsModal';
import { UploadVideoModal } from './components/UploadVideoModal';
import {
  VideoReelsHubSection,
  type RevenueChannel,
  type RevenueEngineResponse,
  type RevenueEventItem
} from './components/VideoReelsHubSection';
import {
  auth,
  isAgencyAdminUser,
  loadFrontPageUpdatesFromFirestore,
  loadSeoSettingsFromFirestore,
  syncCreatorNotificationToFirestore,
  syncCrossPlatformSyndicationToFirestore,
  syncFrontPageUpdateToFirestore,
  syncPostReactionToFirestore,
  type GlobalSeoSettings
} from './lib/firebase';
import {
  AGENCY_CAPABILITIES,
  AGENCY_METRICS,
  APK_RELEASE_HISTORY,
  ARTICLE_CATALOGS,
  NEWS_ARTICLES,
  type NewsArticle,
  type NewsCategory,
  type VideoReelItem
} from './data/newsData';

interface ApkInfoResponse {
  filename: string;
  version: string;
  versionCode: number;
  packageId: string;
  minAndroid: string;
  sizeBytes: number;
  sizeFormatted: string;
  sha256: string;
  downloadUrl: string;
  releasedAt: string;
  downloadsCount: number;
}

interface SearchIndexStatusResponse {
  canonicalOrigin: string;
  base44AppUrl?: string;
  indexNowKey?: string;
  indexNowKeyUrl?: string;
  sitemapIndexUrl?: string;
  indexedEngines: Array<{
    engine: string;
    bot: string;
    policy: string;
    sitemap: string;
  }>;
  endpoints: Array<{
    label: string;
    path: string;
    url: string;
  }>;
  structuredDataSchemas: string[];
}

interface SearchSubmitResponse {
  submittedAt: string;
  canonicalOrigin: string;
  urlsSubmitted: number;
  indexNow: {
    attempted: boolean;
    status: number | null;
    accepted: boolean;
    detail: string;
  };
  webmasterConsoles: Array<{
    name: string;
    url: string;
    sitemapToSubmit: string;
  }>;
}

interface Base44LinkResponse {
  officialWebsiteUrl: string;
  base44AppUrl: string;
  isCustomAppUrl: boolean;
  integrationEndpoints: {
    articlesFeed: string;
    rssFeed: string;
    apkDownload: string;
    pressDeskApi: string;
  };
}

type CatalogTab = NewsCategory | 'Saved';

const CATEGORIES: CatalogTab[] = ['All', 'Saved', ...ARTICLE_CATALOGS];
const SAVED_ARTICLES_STORAGE_KEY = 'nh24-saved-articles';

const APK_MANIFEST_FILES = [
  { name: 'AndroidManifest.xml', role: 'Package declaration (com.newshub24plus.android, SDK 26–35)' },
  { name: 'classes.dex', role: 'Compiled Dalvik newsreader application bytecode' },
  { name: 'assets/agency_config.json', role: 'Live RSS 2.0, sitemap, and breaking wire endpoints' },
  { name: 'res/values/strings.xml', role: 'Localized News Hub 24+ editorial strings' },
  { name: 'META-INF/MANIFEST.MF', role: 'SHA-256 package entry verification digests' }
];

const FALLBACK_APK_INFO: ApkInfoResponse = {
  filename: 'NewsHub24Plus-v2.4.0.apk',
  version: '2.4.0',
  versionCode: 240,
  packageId: 'com.newshub24plus.android',
  minAndroid: 'Android 8.0+ (API 26)',
  sizeBytes: 51680,
  sizeFormatted: '50.5 KB',
  sha256: 'Verified on download from /api/apk-info',
  downloadUrl: '/downloads/NewsHub24Plus-v2.4.0.apk',
  releasedAt: '2026-11-13',
  downloadsCount: 1482
};

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('nh24-theme');
        if (stored === 'dark' || stored === 'light') return stored;
      } catch {
        // Ignore storage read errors
      }
      if (document.documentElement.classList.contains('dark')) return 'dark';
    }
    return 'light';
  });

  const [articles, setArticles] = useState<NewsArticle[]>(NEWS_ARTICLES);
  const [selectedCategory, setSelectedCategory] = useState<CatalogTab>('All');
  const [savedArticleIds, setSavedArticleIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(SAVED_ARTICLES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<SelectedAuthorTarget | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [publishModalOpen, setPublishModalOpen] = useState<boolean>(false);
  const [aiNewsroomOpen, setAiNewsroomOpen] = useState<boolean>(false);
  const [tipBotOpen, setTipBotOpen] = useState<boolean>(false);
  const [uploadVideoModalOpen, setUploadVideoModalOpen] = useState<boolean>(false);
  const [featuredReelId, setFeaturedReelId] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);

  const [apkInfo, setApkInfo] = useState<ApkInfoResponse>(FALLBACK_APK_INFO);
  const [apkInfoLoading, setApkInfoLoading] = useState<boolean>(true);
  const [apkInspectionModalOpen, setApkInspectionModalOpen] = useState<boolean>(false);
  const [hashCopied, setHashCopied] = useState<boolean>(false);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  const [searchStatus, setSearchStatus] = useState<SearchIndexStatusResponse | null>(null);
  const [inspectorTarget, setInspectorTarget] = useState<{ path: string; label: string } | null>(null);
  const [submittingSearchEngines, setSubmittingSearchEngines] = useState<boolean>(false);
  const [searchSubmitResult, setSearchSubmitResult] = useState<SearchSubmitResponse | null>(null);
  const [searchSubmitError, setSearchSubmitError] = useState<string | null>(null);

  // Base44 Official App Link state
  const [base44Link, setBase44Link] = useState<Base44LinkResponse>({
    officialWebsiteUrl: typeof window !== 'undefined' ? window.location.origin : '',
    base44AppUrl: 'https://base44.com',
    isCustomAppUrl: false,
    integrationEndpoints: {
      articlesFeed: '/api/articles',
      rssFeed: '/rss.xml',
      apkDownload: '/downloads/NewsHub24Plus-v2.4.0.apk',
      pressDeskApi: '/api/press-inquiry'
    }
  });
  const [base44InputUrl, setBase44InputUrl] = useState<string>('');
  const [base44Saving, setBase44Saving] = useState<boolean>(false);
  const [base44Feedback, setBase44Feedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  // Press inquiry form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formType, setFormType] = useState('Syndication & Licensing');
  const [formMessage, setFormMessage] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formReceipt, setFormReceipt] = useState<{ referenceId: string; message: string } | null>(null);

  // Content Performance Dashboard, Monetization & Revenue Engine State
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(true);
  const [monetization, setMonetization] = useState<MonetizationStateResponse | null>(null);
  const [revenueEngine, setRevenueEngine] = useState<RevenueEngineResponse | null>(null);
  const [domainConfig, setDomainConfig] = useState<DomainConfigResponse | null>(null);
  const [ownerPayouts, setOwnerPayouts] = useState<OwnerPayoutsResponse | null>(null);
  const [rewardsData, setRewardsData] = useState<RewardsSummaryResponse | null>(null);
  const [alertEmail, setAlertEmail] = useState<string>('');
  const [alertCatalog, setAlertCatalog] = useState<string>('All Dispatches');
  const [alertSubmitting, setAlertSubmitting] = useState<boolean>(false);
  const [alertFeedback, setAlertFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchVisibilityAudit, setSearchVisibilityAudit] = useState<SearchVisibilityAuditResponse | null>(null);
  const [seoSettingsModalOpen, setSeoSettingsModalOpen] = useState<boolean>(false);
  const [seoSettings, setSeoSettings] = useState<GlobalSeoSettings>(DEFAULT_GLOBAL_SEO_SETTINGS);
  const [sharedArticleId, setSharedArticleId] = useState<string | null>(null);
  const [frontPageDbInfo, setFrontPageDbInfo] = useState<{
    count: number;
    firestoreCount: number;
  }>({ count: NEWS_ARTICLES.length, firestoreCount: 0 });
  const [checkoutTarget, setCheckoutTarget] = useState<{
    plan: MonetizationPlan;
    cycle: 'monthly' | 'annual';
  } | null>(null);
  const [trendsRefreshKey, setTrendsRefreshKey] = useState<number>(0);

  // Live Creator Milestone & Withdrawal Notification Center State
  const [notificationCenterOpen, setNotificationCenterOpen] = useState<boolean>(false);
  const [notificationsState, setNotificationsState] = useState<NotificationsStateResponse | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [liveToastNotification, setLiveToastNotification] = useState<CreatorNotificationItem | null>(null);
  const [browserNotifyEnabled, setBrowserNotifyEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('nh24-browser-notify') === 'true';
    } catch {
      return false;
    }
  });
  const [platformThresholds, setPlatformThresholds] = useState<PlatformThresholdsResponse | null>(null);
  const [communityState, setCommunityState] = useState<CommunitySnapshotResponse | null>(null);
  const [deployStatus, setDeployStatus] = useState<DeployStatusResponse | null>(null);
  const [attributedPlatform, setAttributedPlatform] = useState<ConnectedVideoPlatform | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = sessionStorage.getItem('nh24-video-attribution');
      if (saved) return saved as ConnectedVideoPlatform;
    } catch {
      // Ignore storage read errors
    }
    return null;
  });

  const refreshAnalytics = () => {
    setTrendsRefreshKey((k) => k + 1);
    fetch('/api/analytics')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load analytics'))))
      .then((data: AnalyticsResponse) => {
        setAnalytics(data);
        setAnalyticsLoading(false);
      })
      .catch(() => {
        setAnalyticsLoading(false);
      });
  };

  const refreshOwnerPayouts = useCallback(() => {
    fetch('/api/owner/payouts')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: OwnerPayoutsResponse | null) => {
        if (data) setOwnerPayouts(data);
      })
      .catch(() => {
        // Ignore non-fatal fetch error
      });
  }, []);

  const refreshRewardsSummary = useCallback(() => {
    fetch('/api/rewards/summary')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RewardsSummaryResponse | null) => {
        if (data) setRewardsData(data);
      })
      .catch(() => {
        // Ignore non-fatal fetch error
      });
  }, []);

  const refreshSearchVisibilityAudit = useCallback(async () => {
    try {
      const res = await fetch('/api/search-visibility-audit');
      if (!res.ok) return;
      const data = (await res.json()) as SearchVisibilityAuditResponse;
      setSearchVisibilityAudit(data);
    } catch {
      // Ignore non-fatal fetch error
    }
  }, []);

  const refreshCommunityState = useCallback(async () => {
    try {
      const res = await fetch('/api/community/state');
      if (!res.ok) return;
      const data = (await res.json()) as CommunitySnapshotResponse;
      setCommunityState(data);
    } catch {
      // Ignore non-fatal fetch error
    }
  }, []);

  const refreshDeployStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/deploy/status');
      if (!res.ok) return;
      const data = (await res.json()) as DeployStatusResponse;
      setDeployStatus(data);
    } catch {
      // Ignore non-fatal fetch error
    }
  }, []);

  useEffect(() => {
    if (!liveToastNotification) return;
    const timer = window.setTimeout(() => {
      setLiveToastNotification((curr) => (curr?.id === liveToastNotification.id ? null : curr));
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [liveToastNotification]);

  useEffect(() => {
    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: NotificationsStateResponse | null) => {
        if (data) setNotificationsState(data);
      })
      .catch(() => {
        // Ignore non-fatal initial load error
      });

    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/notifications/stream');

    es.onopen = () => {
      setSseConnected(true);
    };

    es.addEventListener('init', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent<string>).data) as NotificationsStateResponse;
        setNotificationsState(data);
        setSseConnected(true);
      } catch {
        // Ignore malformed init frame
      }
    });

    es.addEventListener('sync', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent<string>).data) as NotificationsStateResponse;
        setNotificationsState(data);
      } catch {
        // Ignore malformed sync frame
      }
    });

    es.addEventListener('notification', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          notification: CreatorNotificationItem;
          unreadCount: number;
          metrics: NotificationsStateResponse['metrics'];
        };
        const incoming = payload.notification;
        setNotificationsState((prev) => {
          if (!prev) return prev;
          const exists = prev.notifications.some((n) => n.id === incoming.id);
          const nextList = exists
            ? prev.notifications.map((n) => (n.id === incoming.id ? incoming : n))
            : [incoming, ...prev.notifications].slice(0, 80);
          return {
            ...prev,
            notifications: nextList,
            unreadCount: payload.unreadCount,
            metrics: payload.metrics
          };
        });
        setLiveToastNotification(incoming);

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted' &&
          localStorage.getItem('nh24-browser-notify') === 'true'
        ) {
          try {
            new Notification(incoming.title, {
              body: incoming.message,
              tag: incoming.id
            });
          } catch {
            // Ignore browser notification failure
          }
        }

        if (auth.currentUser?.emailVerified) {
          void syncCreatorNotificationToFirestore(auth.currentUser, {
            id: incoming.id,
            type: incoming.type,
            title: incoming.title,
            message: incoming.message,
            metricDate: incoming.metricDate,
            actualAmountUsd: incoming.actualAmountUsd,
            thresholdUsd: incoming.thresholdUsd,
            verifiedRealFunds: incoming.verifiedRealFunds,
            referenceId: incoming.referenceId,
            read: incoming.read
          }).catch(() => {});
        }
      } catch {
        // Ignore malformed notification frame
      }
    });

    es.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, []);

  const handleMarkNotificationRead = useCallback(async (id: string, read: boolean) => {
    const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read })
    });
    if (res.ok) {
      const payload = (await res.json()) as NotificationsStateResponse & {
        notification?: CreatorNotificationItem;
      };
      setNotificationsState(payload);
      if (payload.notification && auth.currentUser?.emailVerified) {
        void syncCreatorNotificationToFirestore(auth.currentUser, {
          id: payload.notification.id,
          type: payload.notification.type,
          title: payload.notification.title,
          message: payload.notification.message,
          metricDate: payload.notification.metricDate,
          actualAmountUsd: payload.notification.actualAmountUsd,
          thresholdUsd: payload.notification.thresholdUsd,
          verifiedRealFunds: payload.notification.verifiedRealFunds,
          referenceId: payload.notification.referenceId,
          read: payload.notification.read
        }).catch(() => {});
      }
    }
  }, []);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
    if (res.ok) {
      const payload = (await res.json()) as NotificationsStateResponse;
      setNotificationsState(payload);
    }
  }, []);

  const handleClearReadNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications/clear', { method: 'DELETE' });
    if (res.ok) {
      const payload = (await res.json()) as NotificationsStateResponse;
      setNotificationsState(payload);
    }
  }, []);

  const handleSaveNotificationSettings = useCallback(
    async (next: {
      dailyVerifiedMilestonesUsd: number[];
      dailyTotalMilestonesUsd: number[];
      notifyOnWithdrawalProcessed: boolean;
      notifyOnVerifiedSettlement: boolean;
    }) => {
      const res = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });
      const payload = (await res.json()) as NotificationsStateResponse & { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to save notification settings.');
      }
      setNotificationsState(payload);
      return payload.message ?? 'Milestone thresholds saved.';
    },
    []
  );

  const handleToggleBrowserNotify = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setBrowserNotifyEnabled(true);
        try {
          localStorage.setItem('nh24-browser-notify', 'true');
        } catch {
          // Ignore storage error
        }
      }
      return;
    }
    if (Notification.permission === 'granted') {
      setBrowserNotifyEnabled((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('nh24-browser-notify', String(next));
        } catch {
          // Ignore storage error
        }
        return next;
      });
    }
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('nh24-theme', theme);
    } catch {
      // Ignore storage write errors
    }
    const themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (themeMeta) {
      themeMeta.content = isDark ? '#0D0D0C' : '#FBF9F5';
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_ARTICLES_STORAGE_KEY, JSON.stringify(savedArticleIds));
    } catch {
      // Ignore storage write errors
    }
  }, [savedArticleIds]);

  const toggleSaveArticle = (articleId: string) => {
    setSavedArticleIds((prev) =>
      prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [articleId, ...prev]
    );
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const storySlug = params.get('story');
    const queryParam = params.get('q');
    const platformParam = (params.get('platform') || params.get('utm_source') || '').toLowerCase();

    const mappedAttribution: ConnectedVideoPlatform | null =
      platformParam === 'meta_facebook' || platformParam === 'facebook' || platformParam === 'fb' || platformParam === 'meta'
        ? 'meta_facebook'
        : platformParam === 'meta_instagram' || platformParam === 'instagram' || platformParam === 'ig'
          ? 'meta_instagram'
          : platformParam === 'meta_threads' || platformParam === 'threads'
            ? 'meta_threads'
            : platformParam === 'meta_whatsapp' || platformParam === 'whatsapp' || platformParam === 'wa'
              ? 'meta_whatsapp'
              : platformParam === 'youtube' || platformParam === 'yt'
                ? 'youtube'
                : platformParam === 'android_apk' || platformParam === 'base44_app'
                  ? (platformParam as ConnectedVideoPlatform)
                  : null;

    if (mappedAttribution) {
      setAttributedPlatform(mappedAttribution);
      try {
        sessionStorage.setItem('nh24-video-attribution', mappedAttribution);
      } catch {
        // Ignore session storage errors
      }
    }

    if (queryParam) {
      setSearchQuery(queryParam);
    }

    if (storySlug) {
      const matched = NEWS_ARTICLES.find((a) => a.slug === storySlug);
      if (matched) {
        setActiveArticle(matched);
      }
    }

    const syncCanonicalMeta = (canonicalHref: string) => {
      let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.rel = 'canonical';
        canonicalEl.id = 'canonical-link';
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.href = canonicalHref;

      let ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
      if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
      }
      ogUrl.content = canonicalHref;
    };

    syncCanonicalMeta(
      storySlug
        ? `${window.location.origin}${window.location.pathname}?story=${encodeURIComponent(storySlug)}`
        : `${window.location.origin}${window.location.pathname}`
    );

    fetch('/api/articles')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load articles'))))
      .then((data: { articles?: NewsArticle[] }) => {
        if (Array.isArray(data.articles) && data.articles.length > 0) {
          setArticles(data.articles);
          if (storySlug) {
            const matchedFromApi = data.articles.find((a) => a.slug === storySlug);
            if (matchedFromApi) {
              setActiveArticle(matchedFromApi);
            }
          }
        }
      })
      .catch(() => {
        // Keep static initial articles fallback
      });

    fetch('/api/apk-info')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load APK info'))))
      .then((data: ApkInfoResponse) => {
        setApkInfo(data);
        setApkInfoLoading(false);
      })
      .catch(() => {
        setApkInfoLoading(false);
      });

    fetch('/api/search-index-status')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load index status'))))
      .then((data: SearchIndexStatusResponse) => {
        setSearchStatus(data);
      })
      .catch(() => {
        // Keep static fallback rendering cleanly
      });

    fetch('/api/base44-link')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load Base44 link'))))
      .then((data: Base44LinkResponse) => {
        setBase44Link(data);
        setBase44InputUrl(data.isCustomAppUrl ? data.base44AppUrl : '');
      })
      .catch(() => {
        // Keep fallback
      });

    refreshAnalytics();

    fetch('/api/monetization')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load monetization state'))))
      .then((data: MonetizationStateResponse) => {
        setMonetization(data);
      })
      .catch(() => {
        // Ignore non-fatal fetch error
      });

    fetch('/api/revenue-engine')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load revenue engine'))))
      .then((data: RevenueEngineResponse) => {
        setRevenueEngine(data);
      })
      .catch(() => {
        // Ignore non-fatal fetch error
      });

    fetch('/api/platform-thresholds')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load platform thresholds'))))
      .then((data: PlatformThresholdsResponse) => {
        setPlatformThresholds(data);
      })
      .catch(() => {
        // Ignore non-fatal fetch error
      });

    fetch('/api/domain-config')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load domain config'))))
      .then((data: DomainConfigResponse) => {
        setDomainConfig(data);
      })
      .catch(() => {
        // Ignore non-fatal fetch error
      });

    refreshOwnerPayouts();
    refreshRewardsSummary();
    void refreshSearchVisibilityAudit();
    void refreshCommunityState();
    void refreshDeployStatus();

    // Load Dynamic Global SEO Settings (Server + Firestore override if present)
    fetch('/api/seo-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { settings?: GlobalSeoSettings } | null) => {
        if (data?.settings) {
          setSeoSettings(data.settings);
        }
      })
      .catch(() => {
        // Keep defaults
      });

    void loadSeoSettingsFromFirestore()
      .then((fsSeo) => {
        if (fsSeo && fsSeo.title) {
          setSeoSettings(fsSeo);
        }
      })
      .catch(() => {
        // Firestore read fallback silently ignored
      });

    // Load Front-Page Updates Database summary (Express + Firestore)
    fetch('/api/frontpage-updates')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number } | null) => {
        if (typeof data?.count === 'number') {
          setFrontPageDbInfo((prev) => ({ ...prev, count: data.count! }));
        }
      })
      .catch(() => {
        // Keep article array count
      });

    void loadFrontPageUpdatesFromFirestore()
      .then((fsUpdates) => {
        if (Array.isArray(fsUpdates) && fsUpdates.length > 0) {
          setFrontPageDbInfo((prev) => ({ ...prev, firestoreCount: fsUpdates.length }));
        }
      })
      .catch(() => {
        // Firestore collection not yet seeded
      });

    const urlParams = new URLSearchParams(window.location.search);
    const stripeSessionId = urlParams.get('stripe_session_id');
    const flwGateway = urlParams.get('gateway');
    const flwStatus = urlParams.get('status');
    const flwTxId = urlParams.get('transaction_id');

    if (stripeSessionId) {
      fetch('/api/monetization/stripe/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stripeSessionId })
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Stripe verification failed'))))
        .then((payload: { summary: MonetizationSummary; recentTransactions: MonetizationTransaction[]; message: string }) => {
          setMonetization((prev) =>
            prev
              ? {
                  ...prev,
                  summary: payload.summary,
                  recentTransactions: payload.recentTransactions
                }
              : prev
          );
          refreshOwnerPayouts();
          setPublishNotice(payload.message);
          window.setTimeout(() => setPublishNotice(null), 6000);
        })
        .catch(() => {
          // Ignore non-fatal session check
        })
        .finally(() => {
          const cleanUrl = `${window.location.pathname}${window.location.hash}`;
          window.history.replaceState({}, '', cleanUrl);
        });
    } else if (flwGateway === 'flutterwave' && flwTxId && flwStatus === 'successful') {
      fetch('/api/monetization/flutterwave/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: flwTxId })
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Flutterwave verification failed'))))
        .then((payload: { summary: MonetizationSummary; recentTransactions: MonetizationTransaction[]; message: string }) => {
          setMonetization((prev) =>
            prev
              ? {
                  ...prev,
                  summary: payload.summary,
                  recentTransactions: payload.recentTransactions
                }
              : prev
          );
          refreshOwnerPayouts();
          setPublishNotice(payload.message);
          window.setTimeout(() => setPublishNotice(null), 7000);
        })
        .catch(() => {
          // Ignore non-fatal Flutterwave check
        })
        .finally(() => {
          const cleanUrl = `${window.location.pathname}${window.location.hash}`;
          window.history.replaceState({}, '', cleanUrl);
        });
    }
  }, [
    refreshCommunityState,
    refreshDeployStatus,
    refreshOwnerPayouts,
    refreshRewardsSummary,
    refreshSearchVisibilityAudit
  ]);

  useEffect(() => {
    const syncMetaName = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (content) {
        if (!el) {
          el = document.createElement('meta');
          el.name = name;
          document.head.appendChild(el);
        }
        el.content = content;
      } else if (el) {
        el.remove();
      }
    };
    const syncMetaProperty = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (content) {
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute('property', property);
          document.head.appendChild(el);
        }
        el.content = content;
      }
    };

    if (searchVisibilityAudit?.verification) {
      syncMetaName('google-site-verification', searchVisibilityAudit.verification.googleSiteVerification);
      syncMetaName('msvalidate.01', searchVisibilityAudit.verification.bingSiteVerification);
    }

    if (!activeArticle && seoSettings.title) {
      document.title = seoSettings.title;
    }
    syncMetaName('description', seoSettings.description);
    syncMetaName('news_keywords', seoSettings.news_keywords);
    syncMetaName('author', seoSettings.author);
    syncMetaProperty('og:title', seoSettings.ogTitle || seoSettings.title);
    syncMetaProperty('og:description', seoSettings.ogDescription || seoSettings.description);
    syncMetaName('twitter:title', seoSettings.ogTitle || seoSettings.title);
    syncMetaName('twitter:description', seoSettings.ogDescription || seoSettings.description);
  }, [searchVisibilityAudit?.verification, seoSettings, activeArticle]);

  const updateCanonicalUrl = (fullUrl: string) => {
    const canonicalEl = document.getElementById('canonical-link') as HTMLLinkElement | null;
    if (canonicalEl) {
      canonicalEl.href = fullUrl;
    }
    const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
    if (ogUrl) {
      ogUrl.content = fullUrl;
    }
  };

  const recordRevenueClick = useCallback(
    async (
      sourceType: 'article' | 'ad_link' | 'app_apk',
      platform: RevenueChannel,
      targetId?: string,
      targetLabel?: string
    ): Promise<RevenueEventItem | null> => {
      try {
        const res = await fetch('/api/revenue-engine/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceType,
            platform,
            attributionPlatform: attributedPlatform ?? platform,
            targetId,
            targetLabel
          })
        });
        if (!res.ok) return null;
        const payload = (await res.json()) as {
          event: RevenueEventItem;
          monetizationSummary: MonetizationSummary;
          revenueEngine: RevenueEngineResponse;
          platformThresholds?: PlatformThresholdsResponse;
        };
        setRevenueEngine(payload.revenueEngine);
        setMonetization((prev) => (prev ? { ...prev, summary: payload.monetizationSummary } : prev));
        if (payload.platformThresholds) {
          setPlatformThresholds(payload.platformThresholds);
        }
        refreshOwnerPayouts();
        return payload.event;
      } catch {
        return null;
      }
    },
    [refreshOwnerPayouts, attributedPlatform]
  );

  const recordVideoWatch = useCallback(
    async (
      reelId: string,
      platform: RevenueChannel,
      secondsDelta: number,
      milestone: 'qualified_view' | 'watch_slice' | 'instream_ad_complete'
    ): Promise<RevenueEventItem | null> => {
      try {
        const res = await fetch('/api/revenue-engine/video-watch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reelId,
            platform,
            attributionPlatform: attributedPlatform ?? platform,
            secondsDelta,
            milestone
          })
        });
        if (!res.ok) return null;
        const payload = (await res.json()) as {
          event: RevenueEventItem;
          monetizationSummary: MonetizationSummary;
          revenueEngine: RevenueEngineResponse;
          platformThresholds?: PlatformThresholdsResponse;
        };
        setRevenueEngine(payload.revenueEngine);
        setMonetization((prev) => (prev ? { ...prev, summary: payload.monetizationSummary } : prev));
        if (payload.platformThresholds) {
          setPlatformThresholds(payload.platformThresholds);
        }
        refreshOwnerPayouts();
        setTrendsRefreshKey((k) => k + 1);
        return payload.event;
      } catch {
        return null;
      }
    },
    [refreshOwnerPayouts, attributedPlatform]
  );

  const handleReadingEngage = useCallback((articleId: string, seconds: number) => {
    fetch('/api/rewards/accrue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'article_read', articleId, seconds })
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { rewards?: RewardsSummaryResponse } | null) => {
        if (payload?.rewards) {
          setRewardsData(payload.rewards);
        }
      })
      .catch(() => {
        // Non-fatal background accrual
      });
  }, []);

  const openArticle = (article: NewsArticle) => {
    const optimisticArticle = { ...article, views: article.views + 1 };
    setActiveArticle(optimisticArticle);
    setArticles((prev) =>
      prev.map((item) => (item.id === article.id ? { ...item, views: item.views + 1 } : item))
    );

    const url = new URL(window.location.href);
    url.searchParams.set('story', article.slug);
    window.history.replaceState({}, '', url.toString());
    updateCanonicalUrl(url.toString());
    document.title = `${article.title} – News Hub 24+.com`;

    fetch(`/api/articles/${encodeURIComponent(article.id)}/view`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { id?: string; views?: number } | null) => {
        if (data && typeof data.views === 'number') {
          setArticles((prev) =>
            prev.map((item) => (item.id === article.id ? { ...item, views: data.views! } : item))
          );
          setActiveArticle((curr) =>
            curr && curr.id === article.id ? { ...curr, views: data.views! } : curr
          );
          refreshAnalytics();
        }
      })
      .catch(() => {
        // Keep optimistic view count
      });

    const activeBoost = activeBoostByArticleId.get(article.id);
    if (activeBoost) {
      fetch(`/api/trending-boosts/${encodeURIComponent(activeBoost.id)}/click`, { method: 'POST' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { trendingBoosts?: TrendingAdBoost[] } | null) => {
          if (data?.trendingBoosts) {
            setMonetization((prev) => (prev ? { ...prev, trendingBoosts: data.trendingBoosts } : prev));
          }
        })
        .catch(() => {
          // Ignore non-fatal boost click telemetry
        });
    }

    void recordRevenueClick('article', 'website', article.id, article.title);
  };

  const closeArticle = () => {
    setActiveArticle(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('story');
    window.history.replaceState({}, '', url.toString());
    updateCanonicalUrl(`${window.location.origin}${window.location.pathname}`);
    document.title = seoSettings.title || 'News Hub 24+.com – Official News Agency, Wire & Android APK';
  };

  const handleShareArticle = async (article: NewsArticle) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?story=${encodeURIComponent(article.slug)}`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: article.title,
          text: article.deck,
          url: shareUrl
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setSharedArticleId(article.id);
      window.setTimeout(() => setSharedArticleId((curr) => (curr === article.id ? null : curr)), 2500);
    } catch {
      // User dismissed native share sheet or clipboard permission denied; try clipboard fallback silently
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(shareUrl);
          setSharedArticleId(article.id);
          window.setTimeout(() => setSharedArticleId((curr) => (curr === article.id ? null : curr)), 2500);
        }
      } catch {
        // Ignore silently
      }
    }
  };

  const handleStoryPublished = (newArticle: NewsArticle, message: string) => {
    setArticles((prev) => [newArticle, ...prev]);
    setSelectedCategory(newArticle.category);
    setPublishModalOpen(false);
    setPublishNotice(message);
    setFrontPageDbInfo((prev) => ({ ...prev, count: prev.count + 1 }));
    if (auth.currentUser && isAgencyAdminUser(auth.currentUser)) {
      void syncFrontPageUpdateToFirestore(auth.currentUser, {
        id: newArticle.id,
        title: newArticle.title,
        deck: newArticle.deck,
        body: newArticle.paragraphs?.join('\n\n'),
        category: newArticle.category,
        author: newArticle.author,
        breaking: newArticle.breaking,
        publishedAt: newArticle.publishedAt,
        url: `${window.location.origin}/?story=${encodeURIComponent(newArticle.slug)}`
      })
        .then((synced) => {
          if (synced) {
            setFrontPageDbInfo((prev) => ({ ...prev, firestoreCount: prev.firestoreCount + 1 }));
          }
        })
        .catch(() => {});
    }
    refreshAnalytics();
    void refreshCommunityState();
    window.setTimeout(() => setPublishNotice(null), 5000);
  };

  const handleReactToArticle = async (articleId: string, reactionType: PostReactionKind) => {
    try {
      const currentUser = auth.currentUser;
      const res = await fetch(`/api/articles/${encodeURIComponent(articleId)}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reactionType,
          sourcePlatform: 'website',
          reactorLabel: currentUser?.displayName || 'News Hub Reader',
          ownerUid: currentUser?.uid ?? 'reader'
        })
      });
      if (!res.ok) return;
      const payload = (await res.json()) as CommunitySnapshotResponse & {
        reaction?: {
          id: string;
          articleId: string;
          reactionType: PostReactionKind;
          sourcePlatform: string;
          reactorLabel: string;
        };
      };
      setCommunityState(payload);
      if (currentUser?.emailVerified && payload.reaction) {
        void syncPostReactionToFirestore(currentUser, payload.reaction).catch(() => {});
      }
    } catch {
      // Ignore non-fatal reaction error
    }
  };

  const handleSyndicateArticleAcrossPlatforms = async (article: NewsArticle) => {
    try {
      const currentUser = auth.currentUser;
      const res = await fetch(`/api/articles/${encodeURIComponent(article.id)}/publish-across-platforms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUid: currentUser?.uid ?? 'creator'
        })
      });
      if (!res.ok) return;
      const payload = (await res.json()) as CommunitySnapshotResponse & {
        message?: string;
        syndication?: {
          id: string;
          articleId: string;
          articleTitle: string;
          category: string;
          platforms: string[];
          canonicalUrl: string;
          summaryNote: string;
          status: 'published' | 'partial';
        };
      };
      setCommunityState(payload);
      if (currentUser && isAgencyAdminUser(currentUser) && payload.syndication) {
        void syncCrossPlatformSyndicationToFirestore(currentUser, payload.syndication).catch(() => {});
      }
      if (payload.message) {
        setPublishNotice(payload.message);
        window.setTimeout(() => setPublishNotice(null), 5000);
      }
    } catch {
      // Ignore non-fatal syndication error
    }
  };

  const handleAiArticlesPublished = (newArticles: NewsArticle[], message: string) => {
    if (newArticles.length === 0) return;
    setArticles((prev) => {
      const existingIds = new Set(prev.map((a) => a.id));
      const fresh = newArticles.filter((a) => !existingIds.has(a.id));
      return [...fresh, ...prev];
    });
    if (newArticles.length === 1) {
      setSelectedCategory(newArticles[0].category);
    } else {
      setSelectedCategory('All');
    }
    setFrontPageDbInfo((prev) => ({ ...prev, count: prev.count + newArticles.length }));
    if (auth.currentUser && isAgencyAdminUser(auth.currentUser)) {
      for (const art of newArticles) {
        void syncFrontPageUpdateToFirestore(auth.currentUser, {
          id: art.id,
          title: art.title,
          deck: art.deck,
          body: art.paragraphs?.join('\n\n'),
          category: art.category,
          author: art.author,
          breaking: art.breaking,
          publishedAt: art.publishedAt,
          url: `${window.location.origin}/?story=${encodeURIComponent(art.slug)}`
        }).catch(() => {});
      }
    }
    setPublishNotice(message);
    refreshAnalytics();
    window.setTimeout(() => setPublishNotice(null), 6000);
  };

  const handleCheckoutSuccess = (payload: {
    transaction: MonetizationTransaction;
    summary: MonetizationSummary;
    sponsoredCampaigns?: SponsoredCampaign[];
    trendingBoosts?: TrendingAdBoost[];
    message: string;
  }) => {
    setMonetization((prev) =>
      prev
        ? {
            ...prev,
            summary: payload.summary,
            recentTransactions: [payload.transaction, ...prev.recentTransactions].slice(0, 10),
            sponsoredCampaigns: payload.sponsoredCampaigns ?? prev.sponsoredCampaigns,
            trendingBoosts: payload.trendingBoosts ?? prev.trendingBoosts
          }
        : prev
    );
    setTrendsRefreshKey((k) => k + 1);
    refreshOwnerPayouts();
  };

  const handlePayoutUpdated = (payoutConfig: PayoutConfig) => {
    setMonetization((prev) => (prev ? { ...prev, payoutConfig } : prev));
    setRevenueEngine((prev) => (prev ? { ...prev, payoutConfig } : prev));
  };

  const handleWithdrawSuccess = (payload: {
    withdrawalId: string;
    amountUsd: number;
    message: string;
    revenueEngine: RevenueEngineResponse;
    ownerPayouts?: unknown;
    rewards?: unknown;
    monetizationSummary?: unknown;
  }) => {
    setRevenueEngine(payload.revenueEngine);
    if (payload.ownerPayouts) {
      setOwnerPayouts(payload.ownerPayouts as OwnerPayoutsResponse);
    } else {
      refreshOwnerPayouts();
    }
    if (payload.rewards) {
      setRewardsData(payload.rewards as RewardsSummaryResponse);
    } else {
      refreshRewardsSummary();
    }
    setMonetization((prev) =>
      prev
        ? {
            ...prev,
            summary:
              (payload.monetizationSummary as MonetizationSummary | undefined) ?? {
                ...prev.summary,
                pendingCreatorPayoutUsd: payload.revenueEngine.totals.pendingPayoutUsd
              }
          }
        : prev
    );
  };

  const handleVideoUploaded = (payload: {
    video: VideoReelItem;
    message: string;
    revenueEngine: RevenueEngineResponse;
  }) => {
    setRevenueEngine(payload.revenueEngine);
    setFeaturedReelId(payload.video.id);
    setUploadVideoModalOpen(false);
    setPublishNotice(payload.message);
    window.setTimeout(() => setPublishNotice(null), 5000);
  };

  const handleDeleteUploadedVideo = async (videoId: string) => {
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) return;
      const payload = (await res.json()) as { revenueEngine: RevenueEngineResponse };
      setRevenueEngine(payload.revenueEngine);
      setFeaturedReelId((prev) => (prev === videoId ? 'reel-001' : prev));
    } catch {
      // Ignore non-fatal delete errors cleanly
    }
  };

  const leadArticle = useMemo(
    () => articles.find((a) => a.tier === 'lead') || articles[0],
    [articles]
  );

  const secondaryFeatures = useMemo(
    () => articles.filter((a) => a.id !== leadArticle.id && a.tier === 'featured').slice(0, 3),
    [articles, leadArticle.id]
  );

  const activeBoostByArticleId = useMemo(() => {
    const map = new Map<string, TrendingAdBoost>();
    const list = monetization?.trendingBoosts ?? [];
    for (const boost of list) {
      if (boost.status !== 'Active') continue;
      const existing = map.get(boost.articleId);
      if (!existing || boost.boostScore > existing.boostScore) {
        map.set(boost.articleId, boost);
      }
    }
    return map;
  }, [monetization?.trendingBoosts]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = articles.filter((article) => {
      const matchesCategory =
        selectedCategory === 'All'
          ? true
          : selectedCategory === 'Saved'
            ? savedArticleIds.includes(article.id)
            : article.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        article.title.toLowerCase().includes(q) ||
        article.deck.toLowerCase().includes(q) ||
        article.bureau.toLowerCase().includes(q) ||
        article.author.toLowerCase().includes(q) ||
        article.category.toLowerCase().includes(q)
      );
    });
    return [...matched].sort((a, b) => {
      const boostA = activeBoostByArticleId.get(a.id)?.boostScore ?? 0;
      const boostB = activeBoostByArticleId.get(b.id)?.boostScore ?? 0;
      return boostB - boostA;
    });
  }, [articles, selectedCategory, savedArticleIds, searchQuery, activeBoostByArticleId]);

  const investigationArticles = useMemo(
    () =>
      articles
        .filter((article) => article.category === 'Investigations' || article.tier === 'wire')
        .slice(0, 8),
    [articles]
  );

  const handleCopyChecksum = async () => {
    try {
      await navigator.clipboard.writeText(apkInfo.sha256);
      setHashCopied(true);
      window.setTimeout(() => setHashCopied(false), 2200);
    } catch {
      setHashCopied(false);
    }
  };

  const handleApkDownloadClick = () => {
    setApkInfo((prev) => ({ ...prev, downloadsCount: prev.downloadsCount + 1 }));
    setDownloadFeedback(`Downloading ${apkInfo.filename} (${apkInfo.sizeFormatted})…`);
    window.setTimeout(() => setDownloadFeedback(null), 4000);
    void recordRevenueClick('app_apk', 'android_apk', 'apk-download', apkInfo.filename);
  };

  const handleSaveBase44Link = async (e: FormEvent) => {
    e.preventDefault();
    setBase44Feedback(null);
    const trimmed = base44InputUrl.trim();
    if (!trimmed) {
      setBase44Feedback({
        type: 'error',
        text: 'Enter your published Base44 app URL (e.g. https://news-hub-24-plus.base44.app).'
      });
      return;
    }

    setBase44Saving(true);
    try {
      const res = await fetch('/api/base44-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base44AppUrl: trimmed })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not update Base44 link.');
      }
      setBase44Link((prev) => ({
        ...prev,
        officialWebsiteUrl: payload.officialWebsiteUrl,
        base44AppUrl: payload.base44AppUrl,
        isCustomAppUrl: payload.isCustomAppUrl
      }));
      setBase44Feedback({
        type: 'success',
        text: payload.message
      });
    } catch (err: unknown) {
      setBase44Feedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save Base44 app URL.'
      });
    } finally {
      setBase44Saving(false);
    }
  };

  const handleCopyEndpoint = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedEndpoint(key);
      window.setTimeout(() => setCopiedEndpoint(null), 2000);
    } catch {
      setCopiedEndpoint(null);
    }
  };

  const handleSubmitToSearchEngines = async () => {
    setSubmittingSearchEngines(true);
    setSearchSubmitError(null);
    try {
      const res = await fetch('/api/submit-search-engines', { method: 'POST' });
      const data = (await res.json()) as SearchSubmitResponse;
      if (!res.ok) {
        throw new Error('Failed to submit search engine broadcast.');
      }
      setSearchSubmitResult(data);
    } catch (err: unknown) {
      setSearchSubmitError(
        err instanceof Error ? err.message : 'Unable to reach IndexNow submission handler.'
      );
    } finally {
      setSubmittingSearchEngines(false);
    }
  };

  const handlePressSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormReceipt(null);

    if (formName.trim().length < 2) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      setFormError('Please enter a valid work or press email address.');
      return;
    }
    if (formMessage.trim().length < 10) {
      setFormError('Please include at least 10 characters in your inquiry or dispatch note.');
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await fetch('/api/press-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          organization: formOrg,
          inquiryType: formType,
          message: formMessage
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Submission failed');
      }
      setFormReceipt({
        referenceId: payload.referenceId,
        message: payload.message
      });
      setFormName('');
      setFormEmail('');
      setFormOrg('');
      setFormMessage('');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Unable to send inquiry.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleAlertSubscribe = async (e: FormEvent) => {
    e.preventDefault();
    setAlertFeedback(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail.trim())) {
      setAlertFeedback({ type: 'error', text: 'Enter a valid email address for breaking alerts.' });
      return;
    }
    setAlertSubmitting(true);
    try {
      const res = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: alertEmail.trim(), catalog: alertCatalog })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not activate breaking alerts.');
      }
      setAlertEmail('');
      setAlertFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setAlertFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to subscribe right now.'
      });
    } finally {
      setAlertSubmitting(false);
    }
  };

  return (
    <div id="top" className="min-h-screen bg-[#FBF9F5] dark:bg-[#0D0D0C] text-[#141413] dark:text-[#F5F3EE] transition-colors duration-150">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#FBF9F5]/95 dark:bg-[#0D0D0C]/95 backdrop-blur-sm border-b border-[#E5E2DC] dark:border-[#2C2A26]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#141413] dark:text-[#F5F3EE] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#991B1B]"
          >
            News Hub 24+
          </a>

          {/* Zone 2: Single-line navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-4 text-sm font-medium text-[#44403C] dark:text-[#D6D3CD]"
          >
            <a
              href="#top-stories"
              className="hover:text-[#141413] dark:hover:text-[#F5F3EE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Top Stories
            </a>
            <a
              href="#world-wire"
              className="hover:text-[#141413] dark:hover:text-[#F5F3EE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              World Wire
            </a>
            <a
              href="#video-hub"
              className="hover:text-[#141413] dark:hover:text-[#F5F3EE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Video Hub
            </a>
            <a
              href="#analytics"
              className="hover:text-[#141413] dark:hover:text-[#F5F3EE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Analytics
            </a>
            <a
              href="#monetization"
              className="hover:text-[#141413] dark:hover:text-[#F5F3EE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Monetization
            </a>
            <a
              href="#global-transfers"
              className="hover:text-[#141413] dark:hover:text-[#F5F3EE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Remit &amp; *789#
            </a>
            <a
              href="#community"
              className="hover:text-[#141413] dark:hover:text-[#F5F3EE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Community
            </a>
          </nav>

          {/* Zone 3: Theme toggle + Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-2.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#262420] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#991B1B]"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#FBBF24]" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#44403C]" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setNotificationCenterOpen(true)}
              aria-label={`Creator Alerts (${notificationsState?.unreadCount ?? 0} unread)`}
              title="Revenue Milestones & Withdrawal Alerts"
              className="inline-flex items-center gap-1.5 h-9 px-2.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors whitespace-nowrap shrink-0"
            >
              <Bell className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
              <span className="hidden sm:inline">Alerts</span>
              {(notificationsState?.unreadCount ?? 0) > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold tabular-nums bg-[#991B1B] dark:bg-[#DC2626] text-white rounded">
                  {notificationsState?.unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSeoSettingsModalOpen(true)}
              title="Configure global SEO meta tags"
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors whitespace-nowrap shrink-0"
            >
              <Settings className="w-3.5 h-3.5 text-[#57534E] dark:text-[#A8A29E]" />
              <span>SEO Meta</span>
            </button>

            <button
              type="button"
              onClick={() => setTipBotOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors whitespace-nowrap shrink-0"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
              <span>Confidential Tips</span>
            </button>

            <a
              href="#android-apk"
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#991B1B]"
            >
              Download APK
            </a>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 border border-[#D6D1C7] dark:border-[#3A3732] rounded-md bg-white dark:bg-[#1C1B19] text-[#141413] dark:text-[#F5F3EE]"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Navigation"
            className="lg:hidden border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-[#FBF9F5] dark:bg-[#141413] px-4 py-4 flex flex-col gap-3 text-sm font-medium text-[#292524] dark:text-[#E5E2DC]"
          >
            <a href="#top-stories" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
              Top Stories
            </a>
            <a href="#world-wire" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
              World Wire
            </a>
            <a href="#video-hub" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
              Video Hub
            </a>
            <a href="#analytics" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
              Analytics
            </a>
            <a href="#monetization" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
              Monetization
            </a>
            <a href="#global-transfers" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
              Global Remit, Airtime &amp; *789#
            </a>
            <a href="#community" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
              Community, Reactions &amp; Deploy
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setNotificationCenterOpen(true);
              }}
              className="py-1.5 text-left inline-flex items-center gap-2 font-semibold text-[#141413] dark:text-[#F5F3EE]"
            >
              <Bell className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
              <span>
                Creator Alerts &amp; Milestones
                {(notificationsState?.unreadCount ?? 0) > 0 ? ` (${notificationsState?.unreadCount})` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setTipBotOpen(true);
              }}
              className="py-1.5 text-left inline-flex items-center gap-2 font-semibold text-[#991B1B] dark:text-[#F87171]"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Anonymous Confidential Tip Bot</span>
            </button>
            <a href="#android-apk" onClick={() => setMobileMenuOpen(false)} className="py-1.5 text-[#991B1B] dark:text-[#F87171] font-semibold">
              Android APK ({apkInfo.filename})
            </a>
          </nav>
        )}
      </header>

      {/* Operational Masthead & Direct Visible APK Access Ribbon */}
      <div className="border-b border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#141413]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#57534E] dark:text-[#A8A29E]">
            <a
              href="#official-domain"
              className="font-semibold text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171] hover:underline underline-offset-4"
            >
              {domainConfig?.config.primaryDomain ?? 'newshub24plus.com'} Official Website
            </a>
            <span aria-hidden="true">·</span>
            <span>Friday, November 13, 2026</span>
            <span aria-hidden="true">·</span>
            <a
              href={base44Link.base44AppUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void recordRevenueClick('app_apk', 'base44_app', 'base44-masthead', 'Base44 App Portal Launch')}
              className="inline-flex items-center gap-1 font-medium text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171] hover:underline underline-offset-4"
            >
              <span>Base44 App Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span aria-hidden="true">·</span>
            <a
              href={apkInfo.downloadUrl}
              download={apkInfo.filename}
              onClick={handleApkDownloadClick}
              className="inline-flex items-center gap-1.5 font-mono font-medium text-[#991B1B] dark:text-[#F87171] hover:underline underline-offset-4"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{apkInfo.filename}</span>
            </a>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-[#78716C] dark:text-[#A8A29E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search headlines, catalogs, bureaus..."
              aria-label="Search headlines, catalogs, bureaus"
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] dark:placeholder:text-[#A8A29E] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
            />
          </div>
        </div>
      </div>

      {/* Breaking News Banner pulling top-most article marked as breaking */}
      <BreakingNewsBanner articles={articles} onSelectArticle={openArticle} />

      {/* Download confirmation toast */}
      {downloadFeedback && (
        <div
          role="status"
          className="fixed top-20 right-5 z-50 px-4 py-3 bg-[#141413] dark:bg-[#F5F3EE] text-[#FBF9F5] dark:text-[#141413] text-xs font-medium rounded-md shadow-lg border border-[#292524] dark:border-[#D6D1C7]"
        >
          {downloadFeedback}
        </div>
      )}

      {/* Story published confirmation toast */}
      {publishNotice && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 px-4 py-3 bg-[#14532D] text-white text-xs font-medium rounded-md shadow-lg border border-[#166534]"
        >
          {publishNotice}
        </div>
      )}

      <main>
        {/* SECTION 1: BROADSHEET FRONT PAGE (3-TIER SALIENCE) */}
        <section id="top-stories" className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-12 sm:pt-12 sm:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Tier 1 Lead Story */}
            <div className="lg:col-span-8 flex flex-col justify-between pb-8 lg:pb-0 border-b lg:border-b-0 lg:border-r border-[#E5E2DC] dark:border-[#2C2A26] lg:pr-10">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E] dark:text-[#A8A29E] mb-3">
                  <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">{leadArticle.kicker}</span>
                  <span aria-hidden="true">·</span>
                  <span>{leadArticle.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{leadArticle.readTime}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{leadArticle.views.toLocaleString()} views</span>
                </div>

                <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#141413] dark:text-[#F5F3EE] leading-[1.08] tracking-tight mb-4 max-w-3xl">
                  {leadArticle.title}
                </h1>

                <p className="text-base sm:text-lg text-[#44403C] dark:text-[#D6D3CD] leading-relaxed mb-6 max-w-2xl">
                  {leadArticle.deck}
                </p>

                <div className="overflow-hidden rounded-md border border-[#E5E2DC] dark:border-[#2C2A26] bg-[#EFECE6] dark:bg-[#1F1E1B] mb-3">
                  <EditorialImage
                    imageKey={leadArticle.imageKey || 'hero_lead_summit'}
                    alt={leadArticle.figureCaption || leadArticle.title}
                    className="aspect-video"
                  />
                </div>
                {leadArticle.figureCaption && (
                  <p className="text-xs font-serif italic text-[#57534E] dark:text-[#A8A29E] mb-6">
                    {leadArticle.figureCaption}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                <div className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAuthor({
                        name: leadArticle.author,
                        role: leadArticle.authorRole,
                        bureau: leadArticle.bureau
                      })
                    }
                    className="font-semibold text-[#141413] dark:text-[#F5F3EE] underline decoration-[#D6D1C7] dark:decoration-[#57534E] underline-offset-4 hover:text-[#991B1B] dark:hover:text-[#F87171] hover:decoration-[#991B1B] transition-colors"
                  >
                    {leadArticle.author}
                  </button>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{leadArticle.bureau}</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <time dateTime={leadArticle.publishedAt} className="font-mono tabular-nums">
                    {leadArticle.displayDate}
                  </time>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSaveArticle(leadArticle.id)}
                    aria-pressed={savedArticleIds.includes(leadArticle.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                      savedArticleIds.includes(leadArticle.id)
                        ? 'text-[#991B1B] dark:text-[#F87171] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                        : 'text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#1C1B19] border-[#D6D1C7] dark:border-[#3A3732] hover:bg-[#F5F2EB] dark:hover:bg-[#242320]'
                    }`}
                  >
                    {savedArticleIds.includes(leadArticle.id) ? (
                      <BookmarkCheck className="w-3.5 h-3.5" />
                    ) : (
                      <Bookmark className="w-3.5 h-3.5" />
                    )}
                    <span>{savedArticleIds.includes(leadArticle.id) ? 'Saved' : 'Save for Later'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openArticle(leadArticle)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Read Full Dispatch</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tier 2 Secondary Features */}
            <div className="lg:col-span-4 flex flex-col justify-between gap-6">
              <div>
                <h2 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F5F3EE] pb-3 border-b border-[#141413] dark:border-[#3A3732]">
                  Latest Global Dispatches
                </h2>
                <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                  {secondaryFeatures.map((story) => (
                    <article key={story.id} className="py-5 first:pt-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                        <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">{story.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{story.bureau}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{story.readTime}</span>
                      </div>
                      <h3 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F5F3EE] leading-snug mb-2">
                        <button
                          type="button"
                          onClick={() => openArticle(story)}
                          className="text-left hover:text-[#991B1B] dark:hover:text-[#F87171] transition-colors"
                        >
                          {story.title}
                        </button>
                      </h3>
                      <p className="text-sm text-[#44403C] dark:text-[#D6D3CD] leading-relaxed mb-2.5">
                        {story.deck}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#78716C] dark:text-[#A8A29E] font-mono tabular-nums">
                        <span>{story.displayDate} · {story.views.toLocaleString()} views</span>
                        <button
                          type="button"
                          onClick={() => toggleSaveArticle(story.id)}
                          aria-pressed={savedArticleIds.includes(story.id)}
                          className={`inline-flex items-center gap-1 font-sans text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            savedArticleIds.includes(story.id)
                              ? 'text-[#991B1B] dark:text-[#F87171]'
                              : 'text-[#44403C] dark:text-[#D6D3CD] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                          }`}
                        >
                          {savedArticleIds.includes(story.id) ? (
                            <BookmarkCheck className="w-3.5 h-3.5" />
                          ) : (
                            <Bookmark className="w-3.5 h-3.5" />
                          )}
                          <span>{savedArticleIds.includes(story.id) ? 'Saved' : 'Save for Later'}</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {/* Direct Visible APK Quick Access Card */}
              <div className="p-5 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-md">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171]">Official Android Release</span>
                  <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">v{apkInfo.version}</span>
                </div>
                <p className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1.5">
                  News Hub 24+ Mobile App
                </p>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed mb-4">
                  Direct package download with offline edition caching and verified SHA-256 integrity.
                </p>
                <a
                  href={apkInfo.downloadUrl}
                  download={apkInfo.filename}
                  onClick={handleApkDownloadClick}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {apkInfo.filename}</span>
                </a>
              </div>
            </div>
          </div>

          {/* 4-Column Agency Proof Strip */}
          <div className="mt-12 pt-8 border-t border-[#E5E2DC] dark:border-[#2C2A26] grid grid-cols-2 lg:grid-cols-4 gap-6">
            {AGENCY_METRICS.map((metric) => (
              <div key={metric.label}>
                <p className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                  {metric.value}
                </p>
                <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: WORLD WIRE & EXPANDED READER CATALOGS */}
        <section id="world-wire" className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-white dark:bg-[#141413]">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-16">
            <div className="flex flex-col gap-5 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1.5">
                    Continuous Wire &amp; Reader Editions
                  </p>
                  <h2 className="font-serif text-2xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                    World Wire &amp; Story Catalogs
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setInspectorTarget({
                        path: '/api/frontpage-updates',
                        label: 'Front-Page Updates Database (Firestore + /api/frontpage-updates)'
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono text-[#14532D] dark:text-[#4ADE80] bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-md hover:opacity-90 whitespace-nowrap"
                  >
                    <Database className="w-3 h-3" />
                    <span>
                      Updates DB: {frontPageDbInfo.count} stories
                      {frontPageDbInfo.firestoreCount > 0 ? ` (${frontPageDbInfo.firestoreCount} Firestore)` : ''}
                    </span>
                  </button>
                  <span className="text-xs font-mono text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                    {filteredArticles.length} {filteredArticles.length === 1 ? 'story' : 'stories'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTipBotOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                    <span>Anonymous Tip Bot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiNewsroomOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                    <span>AI Trending Desk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <PenSquare className="w-3.5 h-3.5" />
                    <span>Publish Story</span>
                  </button>
                </div>
              </div>

              {/* Interactive Catalog Filter Tabs */}
              <div
                role="tablist"
                aria-label="Filter stories by catalog"
                className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F2EB] dark:bg-[#0D0D0C] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md"
              >
                {CATEGORIES.map((category) => {
                  const active = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                        active
                          ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                          : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
                      }`}
                    >
                      <span>{category}</span>
                      {category === 'Saved' && savedArticleIds.length > 0 && (
                        <span className="font-mono text-[11px] tabular-nums opacity-80">
                          ({savedArticleIds.length})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredArticles.length === 0 ? (
              <div className="py-16 text-center border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <p className="font-serif text-xl text-[#141413] dark:text-[#F5F3EE] mb-2">
                  {selectedCategory === 'Saved' && !searchQuery
                    ? 'No saved stories yet'
                    : `No dispatches match ${searchQuery ? `“${searchQuery}”` : selectedCategory}`}
                </p>
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mb-5">
                  {selectedCategory === 'Saved' && !searchQuery
                    ? 'Click “Save for Later” on any story card to bookmark it for offline or later reading.'
                    : `Publish a new story into ${selectedCategory === 'All' || selectedCategory === 'Saved' ? 'any catalog' : selectedCategory}, or reset your filters.`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {selectedCategory !== 'Saved' && (
                    <button
                      type="button"
                      onClick={() => setPublishModalOpen(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors"
                    >
                      Publish Story
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#242320] rounded-md hover:bg-[#292524] transition-colors"
                  >
                    {selectedCategory === 'Saved' ? 'Browse All Stories' : 'Reset Filters'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10 pt-8">
                {filteredArticles.map((article) => (
                  <article
                    key={article.id}
                    className="flex flex-col justify-between pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]"
                  >
                    <div>
                      {article.imageKey && (
                        <button
                          type="button"
                          onClick={() => openArticle(article)}
                          className="block w-full overflow-hidden rounded-md border border-[#E5E2DC] dark:border-[#2C2A26] bg-[#EFECE6] dark:bg-[#1F1E1B] mb-4 text-left"
                        >
                          <EditorialImage
                            imageKey={article.imageKey}
                            alt={article.figureCaption || article.title}
                            className="aspect-[4/3] hover:scale-[1.02] transition-transform duration-200"
                          />
                        </button>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E] dark:text-[#A8A29E] mb-2">
                        {activeBoostByArticleId.get(article.id) && (
                          <>
                            <span className="font-mono font-semibold text-[#14532D] dark:text-[#4ADE80]">
                              Promoted Trending
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">{article.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{article.bureau}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{article.readTime}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{article.views.toLocaleString()} views</span>
                      </div>

                      <h3 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F5F3EE] leading-snug mb-2">
                        <button
                          type="button"
                          onClick={() => openArticle(article)}
                          className="text-left hover:text-[#991B1B] dark:hover:text-[#F87171] transition-colors"
                        >
                          {article.title}
                        </button>
                      </h3>

                      <p className="text-sm text-[#44403C] dark:text-[#D6D3CD] leading-relaxed mb-4">
                        {article.deck}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
                      <span className="truncate">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAuthor({
                              name: article.author,
                              role: article.authorRole,
                              bureau: article.bureau
                            })
                          }
                          className="font-medium text-[#292524] dark:text-[#D6D3CD] hover:text-[#991B1B] dark:hover:text-[#F87171] hover:underline underline-offset-4 transition-colors"
                        >
                          {article.author}
                        </button>
                        {article.isUserPublished ? ' · Reader Edition' : ''}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleReactToArticle(article.id, 'support')}
                          title="React to this post"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border text-[#44403C] dark:text-[#D6D3CD] bg-[#FBF9F5] dark:bg-[#1C1B19] border-[#D6D1C7] dark:border-[#3A3732] hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors whitespace-nowrap shrink-0 font-mono tabular-nums"
                        >
                          <ThumbsUp className="w-3 h-3 text-[#991B1B] dark:text-[#F87171]" />
                          <span>{communityState?.reactionsByArticle[article.id]?.total ?? 0}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSaveArticle(article.id)}
                          aria-pressed={savedArticleIds.includes(article.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                            savedArticleIds.includes(article.id)
                              ? 'text-[#991B1B] dark:text-[#F87171] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                              : 'text-[#44403C] dark:text-[#D6D3CD] bg-[#FBF9F5] dark:bg-[#1C1B19] border-[#D6D1C7] dark:border-[#3A3732] hover:border-[#141413] dark:hover:border-[#F5F3EE]'
                          }`}
                        >
                          {savedArticleIds.includes(article.id) ? (
                            <BookmarkCheck className="w-3.5 h-3.5" />
                          ) : (
                            <Bookmark className="w-3.5 h-3.5" />
                          )}
                          <span>{savedArticleIds.includes(article.id) ? 'Saved' : 'Save for Later'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleShareArticle(article)}
                          aria-label={`Share ${article.title}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                            sharedArticleId === article.id
                              ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                              : 'text-[#44403C] dark:text-[#D6D3CD] bg-[#FBF9F5] dark:bg-[#1C1B19] border-[#D6D1C7] dark:border-[#3A3732] hover:border-[#141413] dark:hover:border-[#F5F3EE]'
                          }`}
                        >
                          {sharedArticleId === article.id ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                          <span>{sharedArticleId === article.id ? 'Shared' : 'Share'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openArticle(article)}
                          className="font-semibold text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171] transition-colors whitespace-nowrap shrink-0 ml-0.5"
                        >
                          Read →
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2B: VIDEO REELS & PER-CLICK REVENUE HUB */}
        <VideoReelsHubSection
          data={revenueEngine}
          articles={articles}
          onRecordClick={recordRevenueClick}
          onRecordVideoWatch={recordVideoWatch}
          onWithdrawSuccess={handleWithdrawSuccess}
          onOpenArticle={openArticle}
          onOpenUploadModal={() => setUploadVideoModalOpen(true)}
          onDeleteUploadedVideo={handleDeleteUploadedVideo}
          featuredReelId={featuredReelId}
        />

        {/* SECTION 2C: CONNECTED PLATFORMS & META VIDEO THRESHOLD SYSTEM */}
        <PlatformThresholdSection
          data={platformThresholds}
          reels={revenueEngine?.reels ?? []}
          onDataUpdated={(payload) => {
            setPlatformThresholds(payload.platformThresholds);
            if (payload.revenueEngine) {
              setRevenueEngine(payload.revenueEngine as RevenueEngineResponse);
            }
            if (payload.monetizationSummary) {
              setMonetization((prev) =>
                prev
                  ? { ...prev, summary: payload.monetizationSummary as MonetizationSummary }
                  : prev
              );
            }
            if (payload.ownerPayouts) {
              setOwnerPayouts(payload.ownerPayouts as OwnerPayoutsResponse);
            } else {
              refreshOwnerPayouts();
            }
            refreshRewardsSummary();
            fetch('/api/notifications')
              .then((res) => (res.ok ? res.json() : null))
              .then((freshNotifs: NotificationsStateResponse | null) => {
                if (freshNotifs) setNotificationsState(freshNotifs);
              })
              .catch(() => {});
            setTrendsRefreshKey((k) => k + 1);
          }}
        />

        {/* SECTION 3: INVESTIGATIONS & SPECIAL DOSSIERS */}
        <section id="investigations" className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-[#FBF9F5] dark:bg-[#0D0D0C]">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4">
                <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-2">Editorial Desk</p>
                <h2 className="font-serif text-2xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-4">
                  Investigative Dossiers &amp; Wire Briefs
                </h2>
                <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed mb-6">
                  Long-horizon reporting audited against primary maritime logs, municipal filings, and signed field telemetry before syndication.
                </p>
                <a
                  href="/rss.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171] underline underline-offset-4"
                >
                  <span>Subscribe via RSS 2.0 Wire Feed</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="lg:col-span-8 divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] border-t border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                {investigationArticles.map((item, idx) => (
                  <article
                    key={item.id}
                    className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                        <span className="font-mono tabular-nums text-[#78716C] dark:text-[#A8A29E]">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <span className="font-semibold text-[#991B1B] dark:text-[#F87171]">{item.kicker}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.bureau}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{item.readTime}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{item.views.toLocaleString()} views</span>
                      </div>
                      <h3 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F5F3EE] mb-1.5">
                        <button
                          type="button"
                          onClick={() => openArticle(item)}
                          className="text-left hover:text-[#991B1B] dark:hover:text-[#F87171] transition-colors"
                        >
                          {item.title}
                        </button>
                      </h3>
                      <p className="text-sm text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">{item.deck}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openArticle(item)}
                      className="self-start sm:self-center px-4 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] transition-colors whitespace-nowrap shrink-0"
                    >
                      Open Dossier
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3B: CONTENT PERFORMANCE DASHBOARD (DAY, WEEK, MONTH, ANNUAL) */}
        <PerformanceDashboardSection
          analytics={analytics}
          loading={analyticsLoading}
          articles={articles}
          onSelectArticle={openArticle}
          trendsRefreshKey={trendsRefreshKey}
        />

        {/* SECTION 3C: MONETIZATION & PAYMENT METHODS */}
        <MonetizationSection
          data={monetization}
          articles={articles}
          trendsRefreshKey={trendsRefreshKey}
          onSelectPlan={(plan, cycle) => setCheckoutTarget({ plan, cycle })}
          onPayoutUpdated={handlePayoutUpdated}
          onOpenArticle={openArticle}
          onBoostsUpdated={({ trendingBoosts, summary }) => {
            setMonetization((prev) =>
              prev
                ? {
                    ...prev,
                    trendingBoosts,
                    summary: summary ?? prev.summary
                  }
                : prev
            );
            refreshOwnerPayouts();
            setTrendsRefreshKey((k) => k + 1);
          }}
          onTransactionReversed={({ summary, recentTransactions }) => {
            setMonetization((prev) =>
              prev
                ? {
                    ...prev,
                    summary,
                    recentTransactions
                  }
                : prev
            );
            refreshOwnerPayouts();
            refreshRewardsSummary();
            setTrendsRefreshKey((k) => k + 1);
            fetch('/api/revenue-engine')
              .then((res) => (res.ok ? res.json() : null))
              .then((rev: RevenueEngineResponse | null) => {
                if (rev) setRevenueEngine(rev);
              })
              .catch(() => {
                // Ignore non-fatal sync error
              });
          }}
          onGhanaPayCheckout={handleCheckoutSuccess}
          onCreatorSupportSuccess={({ summary, recentTransactions, revenueEngine: nextRev }) => {
            setMonetization((prev) =>
              prev
                ? {
                    ...prev,
                    summary,
                    recentTransactions
                  }
                : prev
            );
            if (nextRev) {
              setRevenueEngine(nextRev as RevenueEngineResponse);
            }
            refreshOwnerPayouts();
            setTrendsRefreshKey((k) => k + 1);
          }}
          withdrawals={ownerPayouts?.withdrawals}
          onRefreshWithdrawals={refreshOwnerPayouts}
          onRealSessionUpdated={({ summary, recentTransactions, revenueEngine: nextRev, rewards: nextRewards, ownerPayouts: nextOwnerPayouts }) => {
            setMonetization((prev) =>
              prev
                ? {
                    ...prev,
                    summary: summary ?? prev.summary,
                    recentTransactions: recentTransactions ?? prev.recentTransactions
                  }
                : prev
            );
            if (nextRev) {
              setRevenueEngine(nextRev as RevenueEngineResponse);
            }
            if (nextRewards) {
              setRewardsData(nextRewards as RewardsSummaryResponse);
            }
            if (nextOwnerPayouts) {
              setOwnerPayouts(nextOwnerPayouts as OwnerPayoutsResponse);
            } else {
              refreshOwnerPayouts();
            }
            setTrendsRefreshKey((k) => k + 1);
          }}
        />

        {/* SECTION 3C-II: GLOBAL REMITTANCE (AFRICA <-> CONTINENTS), UNIVERSAL AIRTIME, *789# & CUSTOMER KYC */}
        <GlobalFinancialPlatformSection
          fxRates={monetization?.fxRates}
          onFinancialActivitySettled={() => {
            fetch('/api/monetization')
              .then((res) => (res.ok ? res.json() : null))
              .then((freshMon: MonetizationStateResponse | null) => {
                if (freshMon) setMonetization(freshMon);
              })
              .catch(() => {
                // Ignore non-fatal refresh error
              });
            fetch('/api/notifications')
              .then((res) => (res.ok ? res.json() : null))
              .then((freshNotifs: NotificationsStateResponse | null) => {
                if (freshNotifs) setNotificationsState(freshNotifs);
              })
              .catch(() => {
                // Ignore non-fatal refresh error
              });
            refreshOwnerPayouts();
            refreshRewardsSummary();
            setTrendsRefreshKey((k) => k + 1);
          }}
        />

        {/* SECTION 3C-III: HEALTHY COMMUNITY, POST REACTIONS, CROSS-PLATFORM PUBLISHING & DEPLOY STATUS */}
        <CommunityEngagementSection
          community={communityState}
          deployStatus={deployStatus}
          articles={articles}
          onCommunityUpdated={(next) => setCommunityState(next)}
          onRefreshDeployStatus={() => void refreshDeployStatus()}
          onOpenArticle={openArticle}
          onOpenPublishModal={() => setPublishModalOpen(true)}
        />

        {/* SECTION 3D: REWARDS CONVERTER & OWNER WITHDRAWAL METHODS */}
        <OwnerWithdrawalSection
          data={ownerPayouts}
          rewardsData={rewardsData}
          onUpdated={({
            ownerPayouts: nextOwnerPayouts,
            rewards: nextRewards,
            payoutConfig,
            revenueEngine: nextRev,
            availableUsd
          }) => {
            setOwnerPayouts(nextOwnerPayouts);
            if (nextRewards) {
              setRewardsData(nextRewards);
            } else {
              refreshRewardsSummary();
            }
            if (payoutConfig) {
              handlePayoutUpdated(payoutConfig);
            }
            if (nextRev) {
              setRevenueEngine(nextRev);
            }
            if (typeof availableUsd === 'number') {
              setMonetization((prev) =>
                prev
                  ? {
                      ...prev,
                      summary: {
                        ...prev.summary,
                        pendingCreatorPayoutUsd: availableUsd
                      }
                    }
                  : prev
              );
            }
            fetch('/api/monetization')
              .then((res) => (res.ok ? res.json() : null))
              .then((freshMon: MonetizationStateResponse | null) => {
                if (freshMon) setMonetization(freshMon);
              })
              .catch(() => {
                // Ignore non-fatal sync
              });
          }}
        />

        {/* SECTION 4: VISIBLE ANDROID APK DOWNLOAD & VERIFICATION */}
        <section id="android-apk" className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-white dark:bg-[#141413]">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#991B1B] dark:text-[#F87171] font-semibold mb-2">
                    <Smartphone className="w-4 h-4" />
                    <span>Direct Android Package Distribution</span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-4">
                    Download the Official News Hub 24+ APK
                  </h2>
                  <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed mb-6">
                    Install the standalone Android newsreader directly from News Hub 24+ with zero third-party store tracking, instant breaking wire alerts, and offline morning edition caching.
                  </p>
                </div>

                <figure>
                  <div className="overflow-hidden rounded-md border border-[#E5E2DC] dark:border-[#2C2A26] bg-[#EFECE6] dark:bg-[#1F1E1B]">
                    <EditorialImage
                      imageKey="apk_mobile_showcase"
                      alt="News Hub 24+ Android mobile application alongside print broadsheet"
                      className="aspect-[4/3]"
                    />
                  </div>
                  <figcaption className="mt-2.5 text-xs font-serif italic text-[#57534E] dark:text-[#A8A29E]">
                    Fig. 5 — News Hub 24+ Android Edition ({apkInfo.filename}) engineered for rapid field reading.
                  </figcaption>
                </figure>
              </div>

              <div className="lg:col-span-6 flex flex-col justify-between bg-[#FBF9F5] dark:bg-[#1C1B19] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg p-6 sm:p-8">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                    <div>
                      <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">Visible Package File</p>
                      <p className="font-mono text-base sm:text-lg font-semibold text-[#141413] dark:text-[#F5F3EE] break-all">
                        {apkInfo.filename}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-[#14532D] dark:text-[#4ADE80] font-semibold">
                      {apkInfoLoading ? 'Verifying…' : 'Verified Binary Ready'}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs mb-6">
                    <div className="pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                      <dt className="text-[#57534E] dark:text-[#A8A29E] mb-0.5">Application Package ID</dt>
                      <dd className="font-mono font-medium text-[#141413] dark:text-[#F5F3EE]">{apkInfo.packageId}</dd>
                    </div>
                    <div className="pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                      <dt className="text-[#57534E] dark:text-[#A8A29E] mb-0.5">Release Version</dt>
                      <dd className="font-mono font-medium text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                        v{apkInfo.version} (Build {apkInfo.versionCode})
                      </dd>
                    </div>
                    <div className="pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                      <dt className="text-[#57534E] dark:text-[#A8A29E] mb-0.5">Archive Size</dt>
                      <dd className="font-mono font-medium text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                        {apkInfo.sizeFormatted} ({apkInfo.sizeBytes.toLocaleString()} bytes)
                      </dd>
                    </div>
                    <div className="pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                      <dt className="text-[#57534E] dark:text-[#A8A29E] mb-0.5">Minimum OS &amp; Downloads</dt>
                      <dd className="font-mono font-medium text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                        {apkInfo.minAndroid} · {apkInfo.downloadsCount.toLocaleString()} installs
                      </dd>
                    </div>
                  </dl>

                  <div className="mb-6">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">SHA-256 Package Checksum</span>
                      <button
                        type="button"
                        onClick={handleCopyChecksum}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171]"
                      >
                        {hashCopied ? <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{hashCopied ? 'Copied' : 'Copy Hash'}</span>
                      </button>
                    </div>
                    <div className="p-3 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md font-mono text-[11px] text-[#292524] dark:text-[#D6D3CD] break-all select-all">
                      {apkInfo.sha256}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={apkInfo.downloadUrl}
                      download={apkInfo.filename}
                      onClick={handleApkDownloadClick}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download {apkInfo.filename}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setApkInspectionModalOpen(true)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#2E2C28] transition-colors whitespace-nowrap shrink-0"
                    >
                      <FileCode2 className="w-4 h-4" />
                      <span>Inspect Package &amp; Changelog</span>
                    </button>
                  </div>

                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                    Direct URL: <span className="font-mono text-[#141413] dark:text-[#F5F3EE]">{apkInfo.downloadUrl}</span> · View full{' '}
                    <button
                      type="button"
                      onClick={() => setApkInspectionModalOpen(true)}
                      className="underline text-[#141413] dark:text-[#F5F3EE] hover:text-[#991B1B] dark:hover:text-[#F87171]"
                    >
                      release history &amp; archive entries
                    </button>
                    {' · '}
                    <a
                      href="#security-defense"
                      className="underline text-[#14532D] dark:text-[#4ADE80] hover:text-[#166534]"
                    >
                      Verify Virus &amp; APK Integrity Audit
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4b: CYBERATTACK, WAF & VIRUS PROTECTION CONSOLE */}
        <SecurityShieldSection />

        {/* SECTION 5: MEDIA AGENCY CAPABILITIES, SEARCH ENGINE HOSTING & PRESS DESK */}
        <section id="agency" className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-[#FBF9F5] dark:bg-[#0D0D0C]">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-16">
            {/* Agency Capabilities */}
            <div>
              <div className="max-w-2xl mb-10">
                <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-2">News Hub 24+ Media Agency</p>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-3">
                  Editorial Services &amp; Search-Indexed Distribution
                </h2>
                <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
                  We combine independent field reporting with structured search-engine architecture so every dispatch, bureau dossier, and mobile release is discoverable across global search platforms.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {AGENCY_CAPABILITIES.map((cap) => (
                  <div
                    key={cap.index}
                    className="p-6 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md flex flex-col justify-between"
                  >
                    <div>
                      <p className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F5F3EE] mb-2">
                        <span className="text-[#991B1B] dark:text-[#F87171] mr-2 font-mono text-sm">{cap.index}</span>
                        {cap.title}
                      </p>
                      <p className="text-sm text-[#44403C] dark:text-[#D6D3CD] leading-relaxed mb-4">
                        {cap.description}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E] pt-3 border-t border-[#F0EDE6] dark:border-[#2C2A26]">
                      Deliverable: <span className="text-[#141413] dark:text-[#F5F3EE]">{cap.deliverable}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <OfficialDomainSection
              data={domainConfig}
              onUpdated={(nextConfig: DomainConfigState) => {
                setDomainConfig((prev) =>
                  prev
                    ? {
                        ...prev,
                        config: nextConfig
                      }
                    : null
                );
                fetch('/api/domain-config')
                  .then((res) => (res.ok ? res.json() : null))
                  .then((fresh: DomainConfigResponse | null) => {
                    if (fresh) setDomainConfig(fresh);
                  })
                  .catch(() => {
                    // Ignore refresh error
                  });
              }}
              onInspectEndpoint={setInspectorTarget}
            />

            {/* Official Website & Base44 App Integration Bridge */}
            <div id="base44-portal" className="p-6 sm:p-8 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-6 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#991B1B] dark:text-[#F87171]">
                    <Link2 className="w-4 h-4" />
                    <span>Official Website · Base44 Application Link</span>
                  </div>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                    Connected to the News Hub 24+ Base44 App
                  </h3>
                  <p className="text-sm text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
                    This domain serves as the official public website, press wire hub, and Android APK distribution portal for the News Hub 24+ application on Base44. CORS-enabled REST and RSS feeds allow your Base44 app to sync breaking stories directly.
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={base44Link.base44AppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void recordRevenueClick('app_apk', 'base44_app', 'base44-portal-cta', 'Open Base44 App')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap"
                    >
                      <span>Open News Hub 24+ Base44 App</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setInspectorTarget({ path: '/api/articles', label: 'Base44 Live JSON Wire Feed (/api/articles)' })}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#EAE5DC] dark:hover:bg-[#2E2C28] transition-colors whitespace-nowrap"
                    >
                      <span>Inspect Base44 JSON Feed</span>
                    </button>
                  </div>

                  <form onSubmit={handleSaveBase44Link} className="pt-4 border-t border-[#E5E2DC] dark:border-[#2C2A26] space-y-2.5">
                    <label htmlFor="base44-url-input" className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      Linked Base44 App URL ({base44Link.isCustomAppUrl ? 'Custom App Connected' : 'Default base44.com'})
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="base44-url-input"
                        type="url"
                        value={base44InputUrl}
                        onChange={(e) => setBase44InputUrl(e.target.value)}
                        placeholder="https://your-news-hub-24.base44.app"
                        className="flex-1 px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                      />
                      <button
                        type="submit"
                        disabled={base44Saving}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                      >
                        {base44Saving ? 'Linking…' : 'Link Base44 URL'}
                      </button>
                    </div>
                    {base44Feedback && (
                      <p
                        role="status"
                        className={`text-xs font-medium ${
                          base44Feedback.type === 'success'
                            ? 'text-[#14532D] dark:text-[#4ADE80]'
                            : 'text-[#991B1B] dark:text-[#FCA5A5]'
                        }`}
                      >
                        {base44Feedback.text}
                      </p>
                    )}
                  </form>
                </div>

                <div className="lg:col-span-6 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
                  <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Official Website Links for Your Base44 App
                  </div>
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                    {[
                      {
                        key: 'official-site',
                        label: 'Official Website URL',
                        value: base44Link.officialWebsiteUrl || window.location.origin
                      },
                      {
                        key: 'articles-api',
                        label: 'JSON Articles Sync API (CORS Enabled)',
                        value: base44Link.integrationEndpoints.articlesFeed
                      },
                      {
                        key: 'rss-feed',
                        label: 'RSS 2.0 Breaking Wire Feed',
                        value: base44Link.integrationEndpoints.rssFeed
                      },
                      {
                        key: 'apk-url',
                        label: 'Direct Android APK Download URL',
                        value: base44Link.integrationEndpoints.apkDownload
                      }
                    ].map((item) => (
                      <div key={item.key} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block">{item.label}</span>
                          <span className="font-mono text-[#57534E] dark:text-[#A8A29E] block truncate">{item.value}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyEndpoint(item.key, item.value)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] transition-colors whitespace-nowrap shrink-0"
                        >
                          {copiedEndpoint === item.key ? (
                            <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedEndpoint === item.key ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Search Engine Hosting & Crawler Endpoints + Press Contact Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
              {/* Left: Search Engine Indexing Status */}
              <div className="lg:col-span-7">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
                      Global Search Engine Hosting &amp; Crawler Index
                    </h3>
                    <p className="text-sm text-[#44403C] dark:text-[#D6D3CD] leading-relaxed max-w-xl">
                      News Hub 24+.com exposes standards-compliant crawl directives, XML Sitemap Indexes, Google News sitemaps, OpenSearch XML, Schema.org <span className="font-mono text-xs">NewsMediaOrganization</span> JSON-LD, and IndexNow verification across all major search engines.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSeoSettingsModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors whitespace-nowrap shrink-0"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Configure Global SEO Meta Tags</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitToSearchEngines}
                      disabled={submittingSearchEngines}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>
                        {submittingSearchEngines ? 'Submitting to IndexNow…' : 'Broadcast to Search Engines (IndexNow)'}
                      </span>
                    </button>
                  </div>
                </div>

                {searchSubmitError && (
                  <p role="alert" className="mb-6 text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] px-4 py-3 rounded-md">
                    {searchSubmitError}
                  </p>
                )}

                {searchSubmitResult && (
                  <div className="mb-6 p-4 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                        IndexNow Broadcast ({searchSubmitResult.urlsSubmitted} canonical URLs)
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          searchSubmitResult.indexNow.accepted
                            ? 'text-[#14532D] dark:text-[#4ADE80]'
                            : 'text-[#92400E] dark:text-[#FBBF24]'
                        }`}
                      >
                        {searchSubmitResult.indexNow.status
                          ? `HTTP ${searchSubmitResult.indexNow.status}`
                          : 'Verification Ready'}
                      </span>
                    </div>
                    <p className="text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">{searchSubmitResult.indexNow.detail}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {searchSubmitResult.webmasterConsoles.map((consoleItem) => (
                        <a
                          key={consoleItem.name}
                          href={consoleItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 px-3 py-2 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-sm hover:border-[#141413] dark:hover:border-[#F5F3EE] transition-colors"
                        >
                          <span className="font-medium text-[#141413] dark:text-[#F5F3EE] truncate">{consoleItem.name}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#57534E] dark:text-[#A8A29E]" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <SearchVisibilityDiagnostics
                  audit={searchVisibilityAudit}
                  onRefreshAudit={refreshSearchVisibilityAudit}
                  onAuditUpdated={setSearchVisibilityAudit}
                />

                <div className="bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden mb-6">
                  <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Search Engine Crawler Compatibility
                  </div>
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                    {(searchStatus?.indexedEngines || [
                      { engine: 'Google & Google News', bot: 'Googlebot / Googlebot-News', policy: 'Allow: /', sitemap: '/news-sitemap.xml' },
                      { engine: 'Microsoft Bing', bot: 'Bingbot + IndexNow', policy: 'Allow: /', sitemap: '/sitemap_index.xml' },
                      { engine: 'DuckDuckGo', bot: 'DuckDuckBot', policy: 'Allow: /', sitemap: '/sitemap_index.xml' },
                      { engine: 'Yahoo Search', bot: 'Slurp', policy: 'Allow: /', sitemap: '/sitemap_index.xml' },
                      { engine: 'Apple Spotlight / Siri', bot: 'Applebot', policy: 'Allow: /', sitemap: '/sitemap_index.xml' },
                      { engine: 'Yandex & Baidu', bot: 'Yandex / Baiduspider', policy: 'Allow: /', sitemap: '/sitemap_index.xml' },
                      { engine: 'Naver, Seznam & Qwant', bot: 'Yeti / SeznamBot / Qwantify', policy: 'Allow: /', sitemap: '/sitemap_index.xml' }
                    ]).map((row) => (
                      <div
                        key={row.engine}
                        className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs items-center"
                      >
                        <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">{row.engine}</span>
                        <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">{row.bot}</span>
                        <span className="font-mono text-[#14532D] dark:text-[#4ADE80] sm:text-right">{row.policy} · Ready</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
                  <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Live Search Engine &amp; Syndication Endpoints
                  </div>
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                    {[
                      { label: 'Crawler Rules (robots.txt)', path: '/robots.txt' },
                      { label: 'Master Sitemap Index', path: '/sitemap_index.xml' },
                      { label: 'Core XML Sitemap', path: '/sitemap.xml' },
                      { label: 'Google News XML Sitemap', path: '/news-sitemap.xml' },
                      { label: 'Google Video Search Sitemap', path: '/video-sitemap.xml' },
                      { label: 'Phoenix Browser & PHX News MRSS', path: '/phoenix-feed.xml' },
                      { label: 'Atom 1.0 + Google WebSub Feed', path: '/atom.xml' },
                      { label: 'JSON Feed 1.1 Syndication', path: '/feed.json' },
                      { label: 'IndexNow Verification Key', path: '/newshub24plusindexnowkey2026.txt' },
                      { label: 'OpenSearch Descriptor', path: '/opensearch.xml' },
                      { label: 'RSS 2.0 Breaking Wire Feed', path: '/rss.xml' },
                      { label: 'Web App Manifest', path: '/manifest.webmanifest' },
                      { label: 'Standalone .com CNAME', path: '/CNAME' },
                      { label: 'Publisher IAB ads.txt', path: '/ads.txt' },
                      { label: 'Bing Webmaster Auth XML', path: '/BingSiteAuth.xml' },
                      { label: 'Android App Links (.well-known)', path: '/.well-known/assetlinks.json' }
                    ].map((endpoint) => (
                      <div
                        key={endpoint.path}
                        className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block">{endpoint.label}</span>
                          <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">{endpoint.path}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setInspectorTarget(endpoint)}
                            className="px-3 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#EAE5DC] dark:hover:bg-[#2E2C28] transition-colors whitespace-nowrap"
                          >
                            Inspect Live
                          </button>
                          <a
                            href={endpoint.path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#171715] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] transition-colors whitespace-nowrap"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Confidential Whistleblower Bot + Press & Syndication Inquiry Form */}
              <div className="lg:col-span-5 space-y-6">
                <div className="p-6 bg-[#141413] text-[#FBF9F5] border border-[#2C2A26] rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#FCA5A5]">
                    <Lock className="w-3.5 h-3.5" />
                    <span>CONFIDENTIAL HIGH-PROFILE CASE DESK</span>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-white">
                    Report Sensitive Cases Anonymously
                  </h3>
                  <p className="text-xs text-[#D6D3CD] leading-relaxed">
                    Sharing high-profile corruption, corporate fraud, or whistleblower evidence? Use our zero-identity chatbot instead of public email. Reports are scrubbed of PII and sealed with AES-256-GCM encryption + a one-time passkey.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTipBotOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Launch Anonymous Tip Chatbot</span>
                  </button>
                </div>

                <div className="p-6 sm:p-8 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg">
                  <h3 className="font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
                    Contact the Editorial &amp; Wire Desk
                  </h3>
                  <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed mb-6">
                    Request wire syndication licensing, submit verified press tips, or reach our bureau coordinators at{' '}
                    <span className="font-medium text-[#141413] dark:text-[#F5F3EE]">newshub24plus@gmail.com</span>.
                  </p>

                  <form onSubmit={handlePressSubmit} noValidate className="space-y-4">
                    <div>
                      <label htmlFor="press-name" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                        Full Name
                      </label>
                      <input
                        id="press-name"
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Jordan Alvarez"
                        className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                      />
                    </div>

                    <div>
                      <label htmlFor="press-email" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                        Email Address
                      </label>
                      <input
                        id="press-email"
                        type="email"
                        required
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="editor@publication.org"
                        className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="press-org" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                          Organization
                        </label>
                        <input
                          id="press-org"
                          type="text"
                          value={formOrg}
                          onChange={(e) => setFormOrg(e.target.value)}
                          placeholder="Media Outlet / Bureau"
                          className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                        />
                      </div>

                      <div>
                        <label htmlFor="press-type" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                          Desk Routing
                        </label>
                        <select
                          id="press-type"
                          value={formType}
                          onChange={(e) => setFormType(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                        >
                          <option value="Syndication & Licensing">Syndication &amp; Licensing</option>
                          <option value="Investigative News Tip">Investigative News Tip</option>
                          <option value="Press Accreditation">Press Accreditation</option>
                          <option value="Android APK Enterprise Build">Android APK Enterprise Build</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="press-message" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                        Inquiry or Dispatch Note
                      </label>
                      <textarea
                        id="press-message"
                        rows={4}
                        required
                        value={formMessage}
                        onChange={(e) => setFormMessage(e.target.value)}
                        placeholder="Share details of your syndication request, press inquiry, or newsroom tip..."
                        className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                      />
                    </div>

                    {formError && (
                      <p role="alert" className="text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border border-[#FECACA] dark:border-[#7F1D1D] px-3 py-2 rounded-md">
                        {formError}
                      </p>
                    )}

                    {formReceipt && (
                      <div
                        role="status"
                        className="text-xs text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] px-3 py-2.5 rounded-md space-y-1"
                      >
                        <p className="font-semibold">{formReceipt.message}</p>
                        <p className="font-mono">Reference ID: {formReceipt.referenceId}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] disabled:opacity-60 transition-colors"
                    >
                      {formSubmitting ? 'Transmitting to Desk…' : 'Submit to Editorial Desk'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-[#F5F2EB] dark:bg-[#141413]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-[#DFDBD2] dark:border-[#2C2A26]">
            <div className="md:col-span-5">
              <p className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
                News Hub 24+ ({domainConfig?.config.primaryDomain ?? 'newshub24plus.com'}) — Official Website
              </p>
              <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed max-w-md mb-3">
                Official standalone .com website of News Hub 24+ and its Base44 application, delivering verified breaking dispatches, unlimited-size video streaming, investigative journalism, and search-indexed wire syndication.
              </p>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-4">
                Editorial Desk:{' '}
                <a href="mailto:newshub24plus@gmail.com" className="text-[#141413] dark:text-[#F5F3EE] font-medium hover:underline">
                  newshub24plus@gmail.com
                </a>
              </p>

              {/* Breaking Wire Email Alerts Subscription */}
              <form onSubmit={handleAlertSubscribe} noValidate className="space-y-2 max-w-md">
                <label htmlFor="breaking-alert-email" className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Breaking Dispatch Wire Alerts
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="breaking-alert-email"
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="reader@domain.com"
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                  />
                  <select
                    aria-label="Alert catalog"
                    value={alertCatalog}
                    onChange={(e) => setAlertCatalog(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    <option value="All Dispatches">All Dispatches</option>
                    {ARTICLE_CATALOGS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={alertSubmitting}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                  >
                    {alertSubmitting ? 'Saving…' : 'Subscribe'}
                  </button>
                </div>
                {alertFeedback && (
                  <p
                    role="status"
                    className={`text-xs font-medium ${
                      alertFeedback.type === 'success'
                        ? 'text-[#14532D] dark:text-[#4ADE80]'
                        : 'text-[#991B1B] dark:text-[#FCA5A5]'
                    }`}
                  >
                    {alertFeedback.text}
                  </p>
                )}
              </form>
            </div>

            <div className="md:col-span-3">
              <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-3">Sections &amp; App</p>
              <ul className="space-y-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
                <li><a href="#top-stories" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Top Stories</a></li>
                <li><a href="#world-wire" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">World Wire &amp; Catalogs</a></li>
                <li><a href="#video-hub" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Video Hub &amp; Revenue</a></li>
                <li><a href="#analytics" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Performance Dashboard</a></li>
                <li><a href="#monetization" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Monetization &amp; Payments</a></li>
                <li><a href="#global-transfers" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Global Remittance, Airtime &amp; *789#</a></li>
                <li><a href="#community" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Community, Reactions &amp; Cross-Publish</a></li>
                <li><a href="#owner-withdrawals" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Owner Withdrawal Methods</a></li>
                <li><a href="#security-defense" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Security &amp; App Virus Protection</a></li>
                <li><a href="#official-domain" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Official .com Domain ({domainConfig?.config.primaryDomain ?? 'newshub24plus.com'})</a></li>
                <li><a href="#investigations" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Investigations</a></li>
                <li><a href="#base44-portal" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Base44 Official App Link</a></li>
                <li>
                  <a href={base44Link.base44AppUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[#141413] dark:text-[#F5F3EE] hover:underline">
                    Launch on Base44.com →
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4">
              <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] mb-3">Distribution &amp; Search Indexing</p>
              <ul className="space-y-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
                <li>
                  <a
                    href={apkInfo.downloadUrl}
                    download={apkInfo.filename}
                    onClick={handleApkDownloadClick}
                    className="font-mono font-medium text-[#991B1B] dark:text-[#F87171] hover:underline"
                  >
                    Download {apkInfo.filename}
                  </a>
                </li>
                <li><a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">robots.txt (All Search Engines)</a></li>
                <li><a href="/sitemap_index.xml" target="_blank" rel="noopener noreferrer" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Master Sitemap Index (/sitemap_index.xml)</a></li>
                <li><a href="/news-sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Google News Sitemap (/news-sitemap.xml)</a></li>
                <li><a href="/video-sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Google Video Sitemap (/video-sitemap.xml)</a></li>
                <li><a href="/phoenix-feed.xml" target="_blank" rel="noopener noreferrer" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Phoenix Browser Feed (/phoenix-feed.xml)</a></li>
                <li><a href="/atom.xml" target="_blank" rel="noopener noreferrer" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">Google Discover Atom (/atom.xml)</a></li>
                <li><a href="/rss.xml" target="_blank" rel="noopener noreferrer" className="hover:text-[#141413] dark:hover:text-[#F5F3EE]">RSS 2.0 Feed (/rss.xml)</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#78716C] dark:text-[#A8A29E]">
            <span>© 2026 News Hub 24+ ({domainConfig?.config.primaryDomain ?? 'newshub24plus.com'}) Official Standalone Website &amp; Media Agency. All rights reserved.</span>
            <span className="font-mono">Package {apkInfo.packageId} · v{apkInfo.version}</span>
          </div>
        </div>
      </footer>

      {/* Reader Modal */}
      <ArticleModal
        article={activeArticle}
        onClose={closeArticle}
        isSaved={activeArticle ? savedArticleIds.includes(activeArticle.id) : false}
        onToggleSave={toggleSaveArticle}
        onSelectAuthor={(name, role, bureau) => setSelectedAuthor({ name, role, bureau })}
        onReadingEngage={handleReadingEngage}
        reactionTally={activeArticle ? communityState?.reactionsByArticle[activeArticle.id] : undefined}
        onReact={handleReactToArticle}
        onSyndicateAcrossPlatforms={handleSyndicateArticleAcrossPlatforms}
      />

      {/* Editorial Author Profile Side-View Drawer */}
      <AuthorProfileDrawer
        target={selectedAuthor}
        articles={articles}
        onClose={() => setSelectedAuthor(null)}
        onSelectArticle={openArticle}
      />

      {/* Publish New Story Modal */}
      <PublishStoryModal
        isOpen={publishModalOpen}
        defaultCategory={selectedCategory === 'Saved' ? 'All' : selectedCategory}
        onClose={() => setPublishModalOpen(false)}
        onPublished={handleStoryPublished}
      />

      {/* AI Trending Newsroom Desk Modal (World, Europe & Asia) */}
      <AiNewsroomModal
        isOpen={aiNewsroomOpen}
        defaultCatalog={selectedCategory === 'Saved' ? 'All' : selectedCategory}
        onClose={() => setAiNewsroomOpen(false)}
        onArticlesPublished={handleAiArticlesPublished}
        onOpenArticleById={(articleId) => {
          const found = articles.find((a) => a.id === articleId);
          if (found) {
            setAiNewsroomOpen(false);
            openArticle(found);
          }
        }}
      />

      {/* APK Inspection & Changelog Modal */}
      <ApkInspectionModal
        isOpen={apkInspectionModalOpen}
        onClose={() => setApkInspectionModalOpen(false)}
        apkInfo={apkInfo}
        manifestFiles={APK_MANIFEST_FILES}
        releaseHistory={APK_RELEASE_HISTORY}
        onDownloadClick={handleApkDownloadClick}
      />

      {/* Live SEO / Crawler Payload Inspector */}
      <SeoInspectorModal
        endpointPath={inspectorTarget?.path || null}
        label={inspectorTarget?.label || ''}
        onClose={() => setInspectorTarget(null)}
      />

      {/* Dynamic Global SEO Meta Tags Settings Modal */}
      <SeoSettingsModal
        isOpen={seoSettingsModalOpen}
        initialSettings={seoSettings}
        onClose={() => setSeoSettingsModalOpen(false)}
        onSaved={(nextSettings) => {
          setSeoSettings(nextSettings);
        }}
      />

      {/* Monetization Checkout & Payment Methods Modal */}
      <PaymentModal
        plan={checkoutTarget?.plan || null}
        billingCycle={checkoutTarget?.cycle || 'monthly'}
        paymentMethods={monetization?.paymentMethods || []}
        realCapabilities={monetization?.realCapabilities || null}
        africaFxRates={monetization?.fxRates || null}
        onClose={() => setCheckoutTarget(null)}
        onSuccess={handleCheckoutSuccess}
      />

      {/* Unlimited-Size Video Upload Modal */}
      <UploadVideoModal
        isOpen={uploadVideoModalOpen}
        onClose={() => setUploadVideoModalOpen(false)}
        onUploaded={handleVideoUploaded}
      />

      {/* Anonymous Confidential Tip & High-Profile Case Chatbot Modal */}
      <ConfidentialTipBotModal
        isOpen={tipBotOpen}
        onClose={() => setTipBotOpen(false)}
      />

      {/* Creator Revenue Milestones & Withdrawal Alert Center */}
      <CreatorNotificationCenter
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        state={notificationsState}
        sseConnected={sseConnected}
        browserNotifyEnabled={browserNotifyEnabled}
        onToggleBrowserNotify={handleToggleBrowserNotify}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onClearRead={handleClearReadNotifications}
        onSaveSettings={handleSaveNotificationSettings}
      />

      {/* Live Incoming Revenue Milestone / Withdrawal Toast Alert */}
      {liveToastNotification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] bg-white dark:bg-[#1C1B19] border border-[#141413] dark:border-[#D6D3CD] rounded-md shadow-2xl p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#065F46] dark:text-[#34D399] font-semibold">
              <Bell className="w-3.5 h-3.5" />
              <span>
                {liveToastNotification.type === 'withdrawal_processed'
                  ? 'Withdrawal Settled'
                  : liveToastNotification.verifiedRealFunds
                    ? 'Verified Revenue Alert'
                    : 'Daily Milestone Alert'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLiveToastNotification(null)}
              aria-label="Dismiss notification toast"
              className="text-[#78716C] hover:text-[#141413] dark:hover:text-[#F5F3EE]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs font-bold text-[#141413] dark:text-[#F5F3EE] mt-1">
            {liveToastNotification.title}
          </p>
          <p className="text-xs text-[#44403C] dark:text-[#D6D3CD] mt-1 line-clamp-2">
            {liveToastNotification.message}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLiveToastNotification(null);
                setNotificationCenterOpen(true);
              }}
              className="px-2.5 py-1 text-[11px] font-semibold bg-[#991B1B] dark:bg-[#DC2626] text-white rounded"
            >
              View Alert Center
            </button>
            <button
              type="button"
              onClick={() => {
                const targetId = liveToastNotification.id;
                setLiveToastNotification(null);
                void handleMarkNotificationRead(targetId, true);
              }}
              className="px-2.5 py-1 text-[11px] font-medium bg-[#F5F2EB] dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE]"
            >
              Mark Read
            </button>
          </div>
        </div>
      )}

      {/* Persistent Bottom-Right Confidential Tip Desk Launcher */}
      <button
        type="button"
        onClick={() => setTipBotOpen(true)}
        aria-label="Open Anonymous Confidential Tip Bot"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#141413] dark:bg-[#991B1B] hover:bg-[#991B1B] dark:hover:bg-[#7F1D1D] border border-[#2C2A26] dark:border-[#DC2626] rounded-md shadow-xl transition-colors whitespace-nowrap"
      >
        <ShieldAlert className="w-4 h-4 text-[#FCA5A5] dark:text-white" />
        <span>Confidential Tip Bot</span>
      </button>
    </div>
  );
}
