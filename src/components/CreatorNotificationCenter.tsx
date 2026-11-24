import {
  Activity,
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  Copy,
  Globe,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Wallet,
  X
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

export type CreatorNotificationType =
  | 'daily_verified_milestone'
  | 'daily_total_milestone'
  | 'withdrawal_processed'
  | 'verified_settlement';

export interface CreatorNotificationItem {
  id: string;
  type: CreatorNotificationType;
  severity: 'success' | 'info';
  title: string;
  message: string;
  metricDate: string;
  actualAmountUsd: number;
  thresholdUsd?: number;
  verifiedRealFunds: boolean;
  referenceId?: string;
  actionTarget?: '#owner-payouts' | '#analytics' | '#monetization';
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorNotificationSettings {
  dailyVerifiedMilestonesUsd: number[];
  dailyTotalMilestonesUsd: number[];
  notifyOnWithdrawalProcessed: boolean;
  notifyOnVerifiedSettlement: boolean;
  updatedAt: string;
}

export interface CreatorNotificationsMetrics {
  metricDate: string;
  dailyVerifiedUsd: number;
  dailyTotalUsd: number;
  nextVerifiedMilestoneUsd: number | null;
  nextTotalMilestoneUsd: number | null;
  liveSseClients: number;
}

export interface DeploymentReadinessInfo {
  nodeVersion: string;
  environment: string;
  port: number;
  primaryDomain: string;
  publicAppUrl: string;
  devAppUrl: string;
  distBuilt: boolean;
  firestoreRulesDeployed: boolean;
}

export interface NotificationsStateResponse {
  notifications: CreatorNotificationItem[];
  unreadCount: number;
  settings: CreatorNotificationSettings;
  metrics: CreatorNotificationsMetrics;
  deployment: DeploymentReadinessInfo;
}

interface HealthCheckPayload {
  ok: boolean;
  service: string;
  environment: string;
  nodeVersion: string;
  uptimeSeconds: number;
  distBuilt: boolean;
  primaryDomain: string;
  publicAppUrl: string;
  devAppUrl: string;
  sseClients: number;
  timestamp: string;
}

interface CreatorNotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  state: NotificationsStateResponse | null;
  sseConnected: boolean;
  browserNotifyEnabled: boolean;
  onToggleBrowserNotify: () => void;
  onMarkRead: (id: string, read: boolean) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onClearRead: () => Promise<void>;
  onSaveSettings: (next: {
    dailyVerifiedMilestonesUsd: number[];
    dailyTotalMilestonesUsd: number[];
    notifyOnWithdrawalProcessed: boolean;
    notifyOnVerifiedSettlement: boolean;
  }) => Promise<string | null>;
}

type CenterTab = 'feed' | 'settings' | 'deployment';
type FeedFilter = 'all' | 'unread' | 'milestones' | 'withdrawals';

function parseMilestoneInput(raw: string): number[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => Number(s.replace(/[^0-9.]/g, '')))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 10_000_000)
        .map((n) => Number(n.toFixed(2)))
    )
  ).sort((a, b) => a - b);
}

function formatAlertTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function computeProgressPercent(actual: number, target: number | null): number {
  if (!target || target <= 0) return actual > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((actual / target) * 100)));
}

export function CreatorNotificationCenter({
  isOpen,
  onClose,
  state,
  sseConnected,
  browserNotifyEnabled,
  onToggleBrowserNotify,
  onMarkRead,
  onMarkAllRead,
  onClearRead,
  onSaveSettings
}: CreatorNotificationCenterProps) {
  const [activeTab, setActiveTab] = useState<CenterTab>('feed');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [verifiedInput, setVerifiedInput] = useState<string>('25, 100, 250, 500, 1000');
  const [totalInput, setTotalInput] = useState<string>('10, 50, 100, 250, 500');
  const [notifyWithdrawal, setNotifyWithdrawal] = useState<boolean>(true);
  const [notifySettlement, setNotifySettlement] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [healthData, setHealthData] = useState<HealthCheckPayload | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!state?.settings) return;
    setVerifiedInput(state.settings.dailyVerifiedMilestonesUsd.join(', '));
    setTotalInput(state.settings.dailyTotalMilestonesUsd.join(', '));
    setNotifyWithdrawal(state.settings.notifyOnWithdrawalProcessed);
    setNotifySettlement(state.settings.notifyOnVerifiedSettlement);
  }, [state?.settings]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const runHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = (await res.json()) as HealthCheckPayload;
        setHealthData(data);
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'deployment') {
      void runHealthCheck();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const notifications = state?.notifications ?? [];
  const unreadCount = state?.unreadCount ?? 0;
  const metrics = state?.metrics ?? {
    metricDate: new Date().toISOString().slice(0, 10),
    dailyVerifiedUsd: 0,
    dailyTotalUsd: 0,
    nextVerifiedMilestoneUsd: 25,
    nextTotalMilestoneUsd: 10,
    liveSseClients: sseConnected ? 1 : 0
  };
  const deployment = state?.deployment ?? {
    nodeVersion: 'v22.x',
    environment: 'development',
    port: 3000,
    primaryDomain: 'newshub24plus.com',
    publicAppUrl: 'https://ais-pre-qu7wretydoetjwztwauaud-827871246101.europe-west2.run.app',
    devAppUrl: 'https://ais-dev-qu7wretydoetjwztwauaud-827871246101.europe-west2.run.app',
    distBuilt: true,
    firestoreRulesDeployed: true
  };

  const filtered = notifications.filter((item) => {
    if (feedFilter === 'unread') return !item.read;
    if (feedFilter === 'milestones') {
      return item.type === 'daily_verified_milestone' || item.type === 'daily_total_milestone';
    }
    if (feedFilter === 'withdrawals') {
      return item.type === 'withdrawal_processed' || item.type === 'verified_settlement';
    }
    return true;
  });

  const verifiedPct = computeProgressPercent(metrics.dailyVerifiedUsd, metrics.nextVerifiedMilestoneUsd);
  const totalPct = computeProgressPercent(metrics.dailyTotalUsd, metrics.nextTotalMilestoneUsd);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  const handleJump = (target?: '#owner-payouts' | '#analytics' | '#monetization') => {
    onClose();
    if (!target) return;
    const el = document.querySelector(target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSettingsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSettingsFeedback(null);
    const parsedVerified = parseMilestoneInput(verifiedInput);
    const parsedTotal = parseMilestoneInput(totalInput);

    if (parsedVerified.length === 0 || parsedTotal.length === 0) {
      setSettingsFeedback({
        type: 'error',
        text: 'Enter at least one valid USD threshold ($1 or higher) for both milestone lists.'
      });
      return;
    }

    setSavingSettings(true);
    try {
      const msg = await onSaveSettings({
        dailyVerifiedMilestonesUsd: parsedVerified,
        dailyTotalMilestonesUsd: parsedTotal,
        notifyOnWithdrawalProcessed: notifyWithdrawal,
        notifyOnVerifiedSettlement: notifySettlement
      });
      setSettingsFeedback({
        type: 'success',
        text: msg || 'Milestone thresholds saved.'
      });
    } catch (err: unknown) {
      setSettingsFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save alert settings.'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const browserSupported = typeof window !== 'undefined' && 'Notification' in window;
  const browserPermission = browserSupported ? Notification.permission : 'denied';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-[#141413]/65 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Creator Revenue Milestones and Withdrawal Alerts"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl h-full bg-[#FBF9F5] dark:bg-[#141413] border-l border-[#E5E2DC] dark:border-[#2C2A26] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-white dark:bg-[#171715] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#57534E] dark:text-[#A8A29E]">
              <Bell className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
              <span>Creator Alert Stream</span>
              <span>·</span>
              <span className={sseConnected ? 'text-[#065F46] dark:text-[#34D399]' : 'text-[#B45309] dark:text-[#FBBF24]'}>
                {sseConnected ? 'SSE Live Connected' : 'Reconnecting'}
              </span>
            </div>
            <h2 className="font-serif text-lg sm:text-xl font-bold text-[#141413] dark:text-[#F5F3EE] mt-0.5 truncate">
              Revenue Milestones &amp; Payout Alerts
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Creator Alert Center"
            className="inline-flex items-center justify-center w-9 h-9 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Daily Progress Snapshot */}
        <div className="px-5 sm:px-6 py-3.5 bg-[#F5F2EB] dark:bg-[#1A1917] border-b border-[#E5E2DC] dark:border-[#2C2A26] grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          <div className="p-3 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#065F46] dark:text-[#34D399] inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Today Verified Real USD
              </span>
              <span className="font-mono text-[#78716C] dark:text-[#A8A29E]">{metrics.metricDate}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-mono text-lg font-bold tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                ${metrics.dailyVerifiedUsd.toFixed(2)}
              </span>
              <span className="font-mono text-xs tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                {metrics.nextVerifiedMilestoneUsd
                  ? `Next: $${metrics.nextVerifiedMilestoneUsd.toFixed(0)}`
                  : 'All targets reached'}
              </span>
            </div>
            <svg viewBox="0 0 100 4" className="w-full h-1.5 mt-2 rounded overflow-hidden" aria-hidden="true">
              <rect x="0" y="0" width="100" height="4" className="fill-[#E5E2DC] dark:fill-[#2C2A26]" />
              <rect
                x="0"
                y="0"
                width={verifiedPct}
                height="4"
                className="fill-[#065F46] dark:fill-[#34D399]"
              />
            </svg>
          </div>

          <div className="p-3 bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] inline-flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                Today Creator Activity USD
              </span>
              <span className="font-mono text-[#78716C] dark:text-[#A8A29E]">Clicks &amp; Watch</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-mono text-lg font-bold tabular-nums text-[#141413] dark:text-[#F5F3EE]">
                ${metrics.dailyTotalUsd.toFixed(2)}
              </span>
              <span className="font-mono text-xs tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                {metrics.nextTotalMilestoneUsd
                  ? `Next: $${metrics.nextTotalMilestoneUsd.toFixed(0)}`
                  : 'All targets reached'}
              </span>
            </div>
            <svg viewBox="0 0 100 4" className="w-full h-1.5 mt-2 rounded overflow-hidden" aria-hidden="true">
              <rect x="0" y="0" width="100" height="4" className="fill-[#E5E2DC] dark:fill-[#2C2A26]" />
              <rect
                x="0"
                y="0"
                width={totalPct}
                height="4"
                className="fill-[#991B1B] dark:fill-[#DC2626]"
              />
            </svg>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 sm:px-6 py-2.5 bg-white dark:bg-[#171715] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                activeTab === 'feed'
                  ? 'bg-[#141413] dark:bg-[#F5F3EE] text-white dark:text-[#141413] border-[#141413] dark:border-[#F5F3EE]'
                  : 'bg-[#FBF9F5] dark:bg-[#1C1B19] text-[#44403C] dark:text-[#D6D3CD] border-[#E5E2DC] dark:border-[#2C2A26]'
              }`}
            >
              Alerts Feed ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-[#141413] dark:bg-[#F5F3EE] text-white dark:text-[#141413] border-[#141413] dark:border-[#F5F3EE]'
                  : 'bg-[#FBF9F5] dark:bg-[#1C1B19] text-[#44403C] dark:text-[#D6D3CD] border-[#E5E2DC] dark:border-[#2C2A26]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Thresholds
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('deployment')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                activeTab === 'deployment'
                  ? 'bg-[#141413] dark:bg-[#F5F3EE] text-white dark:text-[#141413] border-[#141413] dark:border-[#F5F3EE]'
                  : 'bg-[#FBF9F5] dark:bg-[#1C1B19] text-[#44403C] dark:text-[#D6D3CD] border-[#E5E2DC] dark:border-[#2C2A26]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Live Deployment
            </button>
          </div>

          {activeTab === 'feed' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void onMarkAllRead()}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] disabled:opacity-40 whitespace-nowrap"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark All Read
              </button>
              <button
                type="button"
                onClick={() => void onClearRead()}
                disabled={notifications.every((n) => !n.read)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#57534E] dark:text-[#A8A29E] disabled:opacity-40 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Read
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {activeTab === 'feed' && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'all', label: `All (${notifications.length})` },
                    { key: 'unread', label: `Unread (${unreadCount})` },
                    { key: 'milestones', label: 'Daily Milestones' },
                    { key: 'withdrawals', label: 'Withdrawals & Settlements' }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFeedFilter(tab.key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                      feedFilter === tab.key
                        ? 'bg-[#991B1B] dark:bg-[#DC2626] text-white border-[#991B1B] dark:border-[#DC2626]'
                        : 'bg-white dark:bg-[#171715] text-[#44403C] dark:text-[#D6D3CD] border-[#E5E2DC] dark:border-[#2C2A26]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="p-8 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md text-center">
                  <Bell className="w-6 h-6 mx-auto text-[#78716C] dark:text-[#A8A29E] mb-2" />
                  <p className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                    No Alerts in This View Yet
                  </p>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1 max-w-md mx-auto">
                    Real-time SSE alerts fire automatically whenever daily verified real USD or daily creator activity exceeds a milestone threshold, or when a creator withdrawal settles.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {filtered.map((item) => {
                    const isWithdrawal = item.type === 'withdrawal_processed';
                    const isVerified = item.verifiedRealFunds;
                    return (
                      <li
                        key={item.id}
                        className={`p-4 rounded-md border transition-colors ${
                          item.read
                            ? 'bg-white/70 dark:bg-[#171715]/70 border-[#E5E2DC] dark:border-[#2C2A26]'
                            : 'bg-white dark:bg-[#1C1B19] border-[#141413]/30 dark:border-[#D6D3CD]/30 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                              <span
                                className={`px-1.5 py-0.5 rounded border font-semibold ${
                                  isVerified
                                    ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#065F46] dark:text-[#34D399] border-[#A7F3D0] dark:border-[#065F46]'
                                    : isWithdrawal
                                      ? 'bg-[#F5F2EB] dark:bg-[#262420] text-[#141413] dark:text-[#F5F3EE] border-[#D6D1C7] dark:border-[#3A3732]'
                                      : 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 text-[#991B1B] dark:text-[#FCA5A5] border-[#FECACA] dark:border-[#991B1B]'
                                }`}
                              >
                                {item.type === 'daily_verified_milestone'
                                  ? 'VERIFIED MILESTONE'
                                  : item.type === 'daily_total_milestone'
                                    ? 'ACTIVITY MILESTONE'
                                    : item.type === 'withdrawal_processed'
                                      ? isVerified
                                        ? 'WITHDRAWAL · LIVE'
                                        : 'WITHDRAWAL · LEDGER'
                                      : 'VERIFIED SETTLEMENT'}
                              </span>

                              {!item.read && (
                                <span className="px-1.5 py-0.5 rounded bg-[#991B1B] dark:bg-[#DC2626] text-white font-semibold">
                                  NEW
                                </span>
                              )}

                              <span className="text-[#78716C] dark:text-[#A8A29E]">
                                {formatAlertTime(item.createdAt)}
                              </span>
                            </div>

                            <h3 className="text-sm font-bold text-[#141413] dark:text-[#F5F3EE] mt-1.5">
                              {item.title}
                            </h3>
                            <p className="text-xs text-[#44403C] dark:text-[#D6D3CD] mt-1 leading-relaxed">
                              {item.message}
                            </p>

                            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]">
                              <span className="tabular-nums">
                                Amount: <strong className="text-[#141413] dark:text-[#F5F3EE]">${item.actualAmountUsd.toFixed(2)} USD</strong>
                              </span>
                              {typeof item.thresholdUsd === 'number' && (
                                <span className="tabular-nums">
                                  Threshold: ${item.thresholdUsd.toFixed(2)}
                                </span>
                              )}
                              {item.referenceId && (
                                <span>Ref: {item.referenceId}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => void onMarkRead(item.id, !item.read)}
                              className="px-2 py-1 text-[11px] font-medium bg-[#F5F2EB] dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE] hover:border-[#991B1B]"
                            >
                              {item.read ? 'Mark Unread' : 'Mark Read'}
                            </button>
                            {item.actionTarget && (
                              <button
                                type="button"
                                onClick={() => handleJump(item.actionTarget)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#991B1B] dark:text-[#FCA5A5] hover:underline"
                              >
                                <Wallet className="w-3 h-3" />
                                Inspect
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {activeTab === 'settings' && (
            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              <div className="p-4 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-4">
                <div>
                  <label
                    htmlFor="verified-milestones-input"
                    className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
                  >
                    Daily Verified Real USD Milestones (comma-separated USD)
                  </label>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                    Alerts trigger once per UTC day as real verified Stripe, PayPal, Solana, Flutterwave, or live GhanaPay settlements cross each threshold.
                  </p>
                  <input
                    id="verified-milestones-input"
                    type="text"
                    value={verifiedInput}
                    onChange={(e) => setVerifiedInput(e.target.value)}
                    placeholder="25, 100, 250, 500, 1000"
                    className="mt-2 w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { label: 'Starter ($10, $25, $50, $100)', val: '10, 25, 50, 100' },
                      { label: 'Standard ($25, $100, $250, $500, $1000)', val: '25, 100, 250, 500, 1000' },
                      { label: 'Scale ($100, $500, $1000, $5000)', val: '100, 500, 1000, 5000' }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setVerifiedInput(preset.val)}
                        className="px-2 py-1 text-[11px] bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#44403C] dark:text-[#D6D3CD] hover:border-[#991B1B]"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="total-milestones-input"
                    className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]"
                  >
                    Daily Creator Activity USD Milestones (Clicks, Watch Hours &amp; Conversions)
                  </label>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                    Alerts when daily combined click, video watch-time, and creator ledger earnings cross each threshold.
                  </p>
                  <input
                    id="total-milestones-input"
                    type="text"
                    value={totalInput}
                    onChange={(e) => setTotalInput(e.target.value)}
                    placeholder="10, 50, 100, 250, 500"
                    className="mt-2 w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>

                <div className="pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26] space-y-2.5">
                  <label className="flex items-start gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyWithdrawal}
                      onChange={(e) => setNotifyWithdrawal(e.target.checked)}
                      className="mt-0.5 accent-[#991B1B]"
                    />
                    <span>
                      <strong className="block text-[#141413] dark:text-[#F5F3EE]">
                        Alert on Withdrawal Processed
                      </strong>
                      <span className="text-[#57534E] dark:text-[#A8A29E]">
                        Emit instant live alerts whenever a creator withdrawal settles to MTN MoMo, GhanaPay, Solana, PayPal, or bank transfer.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifySettlement}
                      onChange={(e) => setNotifySettlement(e.target.checked)}
                      className="mt-0.5 accent-[#991B1B]"
                    />
                    <span>
                      <strong className="block text-[#141413] dark:text-[#F5F3EE]">
                        Alert on Verified Real Settlement
                      </strong>
                      <span className="text-[#57534E] dark:text-[#A8A29E]">
                        Emit an alert immediately when verified gateway payments (Stripe, PayPal, Solana, Flutterwave, GhanaPay) clear.
                      </span>
                    </span>
                  </label>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                        Desktop / Browser Alerts:
                      </span>{' '}
                      <span className="text-[#57534E] dark:text-[#A8A29E]">
                        {!browserSupported
                          ? 'Unavailable in this browser'
                          : browserPermission === 'granted'
                            ? browserNotifyEnabled
                              ? 'Enabled'
                              : 'Paused'
                            : browserPermission === 'denied'
                              ? 'Blocked in browser permissions'
                              : 'Not requested'}
                      </span>
                    </div>
                    {browserSupported && browserPermission !== 'denied' && (
                      <button
                        type="button"
                        onClick={onToggleBrowserNotify}
                        className="px-3 py-1.5 text-xs font-medium bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] hover:border-[#991B1B]"
                      >
                        {browserNotifyEnabled && browserPermission === 'granted'
                          ? 'Mute Desktop Alerts'
                          : 'Enable Desktop Alerts'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {settingsFeedback && (
                <div
                  className={`p-3 rounded-md border text-xs ${
                    settingsFeedback.type === 'success'
                      ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/30 border-[#A7F3D0] dark:border-[#065F46] text-[#065F46] dark:text-[#34D399]'
                      : 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border-[#FECACA] dark:border-[#991B1B] text-[#991B1B] dark:text-[#FCA5A5]'
                  }`}
                >
                  {settingsFeedback.text}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors disabled:opacity-50"
                >
                  {savingSettings ? 'Saving Thresholds…' : 'Save Notification Thresholds'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'deployment' && (
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#141413] dark:text-[#F5F3EE]">
                      Production Runtime &amp; Public Accessibility
                    </h3>
                    <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                      Verified build status, live Cloud Run public URLs, Firestore rules, and health check telemetry.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runHealthCheck()}
                    disabled={checkingHealth}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`} />
                    Check Health
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-[#FBF9F5] dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded">
                    <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">API Health</div>
                    <div className="font-mono font-bold text-[#065F46] dark:text-[#34D399] mt-0.5">
                      {healthData ? (healthData.ok ? '200 OK' : 'DEGRADED') : 'LIVE'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#FBF9F5] dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded">
                    <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">Production Bundle</div>
                    <div className="font-mono font-bold text-[#141413] dark:text-[#F5F3EE] mt-0.5">
                      {(healthData?.distBuilt ?? deployment.distBuilt) ? 'dist/ Ready' : 'Pending Build'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#FBF9F5] dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded">
                    <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">Firestore Rules</div>
                    <div className="font-mono font-bold text-[#065F46] dark:text-[#34D399] mt-0.5">
                      {deployment.firestoreRulesDeployed ? 'Deployed Live' : 'Pending'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#FBF9F5] dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded">
                    <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">Node Runtime</div>
                    <div className="font-mono font-bold text-[#141413] dark:text-[#F5F3EE] mt-0.5">
                      {healthData?.nodeVersion ?? deployment.nodeVersion}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                  {[
                    { key: 'public', label: 'Public Shared App URL', url: deployment.publicAppUrl },
                    { key: 'dev', label: 'Live Development URL', url: deployment.devAppUrl }
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="p-2.5 bg-[#FBF9F5] dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-[#57534E] dark:text-[#A8A29E]">
                          {item.label}
                        </div>
                        <div className="font-mono text-xs text-[#141413] dark:text-[#F5F3EE] truncate">
                          {item.url}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleCopy(item.key, item.url)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded text-[#141413] dark:text-[#F5F3EE]"
                        >
                          {copiedKey === item.key ? (
                            <>
                              <Check className="w-3 h-3 text-[#065F46]" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-[#991B1B] dark:bg-[#DC2626] text-white rounded"
                        >
                          Open
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded text-xs text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
                  <strong>Publish Latest Workspace Changes:</strong> Click the platform <strong>Deploy / Share App</strong> action in the workspace bar to roll the verified production bundle (<span className="font-mono">npm run build</span> + <span className="font-mono">node server.ts</span>) onto the Public Shared App URL. Live Firestore security rules for <span className="font-mono">creator_notifications</span> are already deployed.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
