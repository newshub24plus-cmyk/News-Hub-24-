import { AlertTriangle, CheckCircle2, ExternalLink, Globe, RefreshCw, SearchCheck, Send, ShieldAlert } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

export interface SearchVisibilityCheck {
  id: string;
  title: string;
  status: 'ready' | 'action_required' | 'blocked';
  summary: string;
  actionRequired: string;
}

export interface DistributionChannelItem {
  id: string;
  group: 'Google' | 'Phoenix & Search Engines';
  name: string;
  endpoint: string;
  url: string;
  status: 'verified' | 'ready';
  detail: string;
}

export interface SearchVisibilityAuditResponse {
  checkedAt: string;
  currentHost: string;
  officialComDomain: string;
  isEphemeralOrSandboxHost: boolean;
  dnsResolves: boolean;
  verification: {
    googleSiteVerification: string;
    bingSiteVerification: string;
    googlePlayUrl: string;
    updatedAt: string;
  };
  checks: SearchVisibilityCheck[];
  distributionChannels?: DistributionChannelItem[];
}

interface SearchVisibilityDiagnosticsProps {
  audit: SearchVisibilityAuditResponse | null;
  onRefreshAudit: () => Promise<void>;
  onAuditUpdated: (nextAudit: SearchVisibilityAuditResponse) => void;
}

export function SearchVisibilityDiagnostics({
  audit,
  onRefreshAudit,
  onAuditUpdated
}: SearchVisibilityDiagnosticsProps) {
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [googleToken, setGoogleToken] = useState<string>('');
  const [bingToken, setBingToken] = useState<string>('');
  const [playUrl, setPlayUrl] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [pingingChannels, setPingingChannels] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<{
    pingedAt: string;
    results: Array<{ channel: string; status: number | null; ok: boolean; detail: string }>;
  } | null>(null);

  useEffect(() => {
    if (!audit?.verification) return;
    setGoogleToken(audit.verification.googleSiteVerification);
    setBingToken(audit.verification.bingSiteVerification);
    setPlayUrl(audit.verification.googlePlayUrl);
  }, [audit?.verification]);

  const handleRerunAudit = async () => {
    setRefreshing(true);
    try {
      await onRefreshAudit();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePingDistribution = async () => {
    setPingingChannels(true);
    try {
      const res = await fetch('/api/distribution/ping', { method: 'POST' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.results)) {
        setPingResult({
          pingedAt: data.pingedAt,
          results: data.results
        });
      }
    } catch {
      // Ignore transient failure cleanly
    } finally {
      setPingingChannels(false);
    }
  };

  const handleSaveVerification = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      const res = await fetch('/api/search-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleSiteVerification: googleToken.trim(),
          bingSiteVerification: bingToken.trim(),
          googlePlayUrl: playUrl.trim()
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not save search console tokens.');
      }
      onAuditUpdated(payload.audit as SearchVisibilityAuditResponse);
      setFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save search console verification.'
      });
    } finally {
      setSaving(false);
    }
  };

  const checks = audit?.checks ?? [];
  const channels = audit?.distributionChannels ?? [];
  const googleChannels = channels.filter((c) => c.group === 'Google');
  const otherChannels = channels.filter((c) => c.group === 'Phoenix & Search Engines');

  return (
    <div className="mb-6 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md overflow-hidden">
      <div className="px-4 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SearchCheck className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
          <span className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
            Verified Google Channels, Phoenix Browser &amp; Global Indexing Diagnostic
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handlePingDistribution()}
            disabled={pingingChannels}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Send className="w-3 h-3" />
            <span>{pingingChannels ? 'Pinging Hubs…' : 'Ping Google WebSub & IndexNow'}</span>
          </button>
          <button
            type="button"
            onClick={handleRerunAudit}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Auditing…' : 'Re-Run Audit'}</span>
          </button>
        </div>
      </div>

      {pingResult && (
        <div className="px-4 py-3 bg-[#FBF9F5] dark:bg-[#10100F] border-b border-[#E5E2DC] dark:border-[#2C2A26] space-y-1.5 text-xs">
          <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
            Live Upstream Distribution Ping Results:
          </p>
          {pingResult.results.map((r) => (
            <div key={r.channel} className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
              <span className="text-[#44403C] dark:text-[#D6D3CD]">{r.channel}</span>
              <span className={r.ok ? 'text-[#14532D] dark:text-[#4ADE80] font-semibold' : 'text-[#92400E] dark:text-[#FBBF24]'}>
                {r.detail}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
        {checks.map((check) => (
          <div key={check.id} className="px-4 py-3.5 space-y-1 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">{check.title}</span>
              <span
                className={`inline-flex items-center gap-1 font-mono font-semibold ${
                  check.status === 'ready'
                    ? 'text-[#14532D] dark:text-[#4ADE80]'
                    : check.status === 'blocked'
                      ? 'text-[#991B1B] dark:text-[#F87171]'
                      : 'text-[#92400E] dark:text-[#FBBF24]'
                }`}
              >
                {check.status === 'ready' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : check.status === 'blocked' ? (
                  <ShieldAlert className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                <span>
                  {check.status === 'ready'
                    ? 'Ready'
                    : check.status === 'blocked'
                      ? 'Blocked in Preview'
                      : 'Action Required'}
                </span>
              </span>
            </div>
            <p className="text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">{check.summary}</p>
            {check.status !== 'ready' && (
              <p className="text-[11px] font-medium text-[#141413] dark:text-[#F5F3EE]">
                Next step: {check.actionRequired}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Verified Google & Phoenix Distribution Channel Directory */}
      {channels.length > 0 && (
        <div className="px-4 py-4 border-t border-[#E5E2DC] dark:border-[#2C2A26] space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
            <Globe className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
            <span>Verified Google Channels &amp; Phoenix / Search Engine Distribution</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <p className="font-mono text-[11px] font-semibold text-[#57534E] dark:text-[#A8A29E]">
                GOOGLE CHANNELS
              </p>
              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md bg-[#FBF9F5] dark:bg-[#10100F]">
                {googleChannels.map((ch) => (
                  <div key={ch.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                        {ch.name}
                      </p>
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                        {ch.detail}
                      </p>
                    </div>
                    <a
                      href={ch.endpoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80] hover:underline shrink-0"
                    >
                      <span>{ch.endpoint}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[11px] font-semibold text-[#57534E] dark:text-[#A8A29E]">
                PHOENIX BROWSER &amp; OTHER SEARCH ENGINES
              </p>
              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md bg-[#FBF9F5] dark:bg-[#10100F]">
                {otherChannels.map((ch) => (
                  <div key={ch.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                        {ch.name}
                      </p>
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                        {ch.detail}
                      </p>
                    </div>
                    <a
                      href={ch.endpoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-[#14532D] dark:text-[#4ADE80] hover:underline shrink-0"
                    >
                      <span>{ch.endpoint}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Search Console, Bing Webmaster & Play Store Verification Form */}
      <form
        onSubmit={handleSaveVerification}
        className="px-4 py-4 bg-[#FBF9F5] dark:bg-[#10100F] border-t border-[#E5E2DC] dark:border-[#2C2A26] space-y-3"
      >
        <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
          Connect Search Console Verification &amp; Google Play Store Listing
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="gsc-token" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
              Google Site Verification Token
            </label>
            <input
              id="gsc-token"
              type="text"
              value={googleToken}
              onChange={(e) => setGoogleToken(e.target.value)}
              placeholder="google-site-verification content value"
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-[#171715] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
            />
          </div>
          <div>
            <label htmlFor="bing-token" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
              Bing Webmaster Verification Code
            </label>
            <input
              id="bing-token"
              type="text"
              value={bingToken}
              onChange={(e) => setBingToken(e.target.value)}
              placeholder="msvalidate.01 / BingSiteAuth.xml ID"
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-[#171715] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
            />
          </div>
          <div>
            <label htmlFor="play-store-url" className="block text-[11px] font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
              Google Play Store App URL
            </label>
            <input
              id="play-store-url"
              type="url"
              value={playUrl}
              onChange={(e) => setPlayUrl(e.target.value)}
              placeholder="https://play.google.com/store/apps/details?id=..."
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-[#171715] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
            />
          </div>
        </div>

        {feedback && (
          <p
            role="status"
            className={`text-xs font-medium ${
              feedback.type === 'success'
                ? 'text-[#14532D] dark:text-[#4ADE80]'
                : 'text-[#991B1B] dark:text-[#FCA5A5]'
            }`}
          >
            {feedback.text}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
            Served live via <span className="font-mono">/BingSiteAuth.xml</span> &amp; <span className="font-mono">&lt;meta&gt;</span> tags in standalone HTML.
          </span>
          <button
            type="submit"
            disabled={saving}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {saving ? 'Saving Tokens…' : 'Save Search Verification'}
          </button>
        </div>
      </form>
    </div>
  );
}
