import { Check, Copy, Download, ExternalLink, Globe, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

export interface DomainConfigState {
  primaryDomain: string;
  wwwDomain: string;
  canonicalOrigin: string;
  verificationToken: string;
  contactEmail: string;
  updatedAt: string;
}

export interface DomainConfigResponse {
  config: DomainConfigState;
  runtimeOrigin: string;
  runtimeHost: string;
  standaloneDownloadUrl: string;
  standalonePreviewUrl: string;
  dnsRecords: Array<{
    type: string;
    host: string;
    value: string;
    purpose: string;
  }>;
  verificationEndpoints: Array<{
    label: string;
    path: string;
    url: string;
  }>;
}

interface DnsVerificationResult {
  checkedAt: string;
  domain: string;
  wwwHost: string;
  hasLiveDns: boolean;
  aRecords: string[];
  cnameRecords: string[];
  txtRecords: string[];
  detail: string;
}

interface OfficialDomainSectionProps {
  data: DomainConfigResponse | null;
  onUpdated: (nextConfig: DomainConfigState) => void;
  onInspectEndpoint: (target: { path: string; label: string }) => void;
}

export function OfficialDomainSection({
  data,
  onUpdated,
  onInspectEndpoint
}: OfficialDomainSectionProps) {
  const [domainInput, setDomainInput] = useState<string>('newshub24plus.com');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [verifyingDns, setVerifyingDns] = useState<boolean>(false);
  const [dnsResult, setDnsResult] = useState<DnsVerificationResult | null>(null);
  const [copiedRecordIdx, setCopiedRecordIdx] = useState<number | null>(null);

  useEffect(() => {
    if (data?.config.primaryDomain) {
      setDomainInput(data.config.primaryDomain);
    }
  }, [data?.config.primaryDomain]);

  const handleSaveDomain = async (e: FormEvent) => {
    e.preventDefault();
    setSaveFeedback(null);
    setSaving(true);
    try {
      const res = await fetch('/api/domain-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domainInput.trim() })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not update .com domain configuration.');
      }
      onUpdated(payload.config as DomainConfigState);
      setSaveFeedback({ type: 'success', text: payload.message as string });
    } catch (err: unknown) {
      setSaveFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save domain settings.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDns = async () => {
    setVerifyingDns(true);
    try {
      const res = await fetch('/api/domain-config/verify-dns', { method: 'POST' });
      const payload = (await res.json()) as DnsVerificationResult;
      setDnsResult(payload);
    } catch {
      setDnsResult(null);
    } finally {
      setVerifyingDns(false);
    }
  };

  const handleCopyDns = async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRecordIdx(idx);
      window.setTimeout(() => setCopiedRecordIdx(null), 2000);
    } catch {
      setCopiedRecordIdx(null);
    }
  };

  const primaryDomain = data?.config.primaryDomain ?? 'newshub24plus.com';
  const canonicalOrigin = data?.config.canonicalOrigin ?? 'https://www.newshub24plus.com';
  const standaloneDownloadUrl =
    data?.standaloneDownloadUrl ?? '/downloads/newshub24plus-standalone.html';
  const standalonePreviewUrl =
    data?.standalonePreviewUrl ?? '/downloads/newshub24plus-standalone.html?preview=1';
  const dnsRecords = data?.dnsRecords ?? [];
  const verificationEndpoints = data?.verificationEndpoints ?? [];

  return (
    <div
      id="official-domain"
      className="p-6 sm:p-8 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Standalone .com Domain Binding & Actions */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#991B1B] dark:text-[#F87171]">
            <Globe className="w-4 h-4" />
            <span>Official Standalone .com Website Identity</span>
          </div>

          <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE]">
            {primaryDomain} — Standalone Portal &amp; DNS Binding
          </h3>

          <p className="text-sm text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
            News Hub 24+ is configured with valid RFC-compliant <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE]">{canonicalOrigin}</span> structured data, <span className="font-mono text-xs">/CNAME</span>, IAB <span className="font-mono text-xs">/ads.txt</span>, and Android App Links (<span className="font-mono text-xs">/.well-known/assetlinks.json</span>). Point your registrar DNS records to this host or download the ready-to-deploy standalone HTML website.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href={standaloneDownloadUrl}
              download={`${primaryDomain}-official-site.html`}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Standalone .com Website (.html)</span>
            </a>

            <a
              href={standalonePreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-[#F5F2EB] dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] transition-colors whitespace-nowrap"
            >
              <span>Preview Standalone Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={handleVerifyDns}
              disabled={verifyingDns}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifyingDns ? 'animate-spin' : ''}`} />
              <span>{verifyingDns ? 'Checking DNS…' : `Verify Live DNS (${primaryDomain})`}</span>
            </button>
          </div>

          {dnsResult && (
            <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
                  <span>DNS Resolution Check: {dnsResult.domain}</span>
                </span>
                <span
                  className={`font-mono font-semibold ${
                    dnsResult.hasLiveDns
                      ? 'text-[#14532D] dark:text-[#4ADE80]'
                      : 'text-[#92400E] dark:text-[#FBBF24]'
                  }`}
                >
                  {dnsResult.hasLiveDns ? 'Resolving' : 'Awaiting DNS Records'}
                </span>
              </div>
              <p className="text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">{dnsResult.detail}</p>
            </div>
          )}

          {/* Custom .com Domain Updater */}
          <form onSubmit={handleSaveDomain} className="pt-4 border-t border-[#E5E2DC] dark:border-[#2C2A26] space-y-2">
            <label htmlFor="standalone-domain-input" className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
              Official Standalone .com Domain Name
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="standalone-domain-input"
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="newshub24plus.com"
                className="flex-1 px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:bg-[#292524] dark:hover:bg-[#E5E2DC] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                {saving ? 'Updating…' : 'Update .com Domain'}
              </button>
            </div>
            {saveFeedback && (
              <p
                role="status"
                className={`text-xs font-medium ${
                  saveFeedback.type === 'success'
                    ? 'text-[#14532D] dark:text-[#4ADE80]'
                    : 'text-[#991B1B] dark:text-[#FCA5A5]'
                }`}
              >
                {saveFeedback.text}
              </p>
            )}
          </form>
        </div>

        {/* Right: Registrar DNS Binding Table & .well-known Verification Files */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
            <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                DNS Zone Records for {primaryDomain}
              </span>
              <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                SSL / HTTPS Ready
              </span>
            </div>
            <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
              {dnsRecords.map((rec, idx) => (
                <div key={`${rec.type}-${rec.host}-${idx}`} className="px-4 py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 font-mono font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      <span className="text-[#991B1B] dark:text-[#F87171]">{rec.type}</span>
                      <span>Host: {rec.host}</span>
                    </div>
                    <p className="font-mono text-[#292524] dark:text-[#D6D3CD] break-all">{rec.value}</p>
                    <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">{rec.purpose}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyDns(idx, rec.value)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] transition-colors whitespace-nowrap shrink-0"
                  >
                    {copiedRecordIdx === idx ? (
                      <Check className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedRecordIdx === idx ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
              Domain Verification &amp; Standards Endpoints
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:gap-px bg-[#E5E2DC] dark:bg-[#2C2A26]">
              {verificationEndpoints.map((ep) => (
                <div
                  key={ep.path}
                  className="px-4 py-2.5 bg-[#FBF9F5] dark:bg-[#10100F] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] block truncate">
                      {ep.label}
                    </span>
                    <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] block truncate">
                      {ep.path}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectEndpoint({ path: ep.path, label: ep.label })}
                    className="px-2.5 py-1 text-[11px] font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm hover:border-[#141413] dark:hover:border-[#F5F3EE] whitespace-nowrap shrink-0"
                  >
                    Inspect
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Standalone HTML Upload & Host Deployment Checklist */}
      <div className="pt-6 border-t border-[#E5E2DC] dark:border-[#2C2A26] grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-2">
          <h4 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
            How to Upload Standalone HTML to Your .com Host
          </h4>
          <p className="text-xs text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
            Domain names only permit letters, numbers, and hyphens (<span className="font-mono">+</span> is invalid in DNS), so register <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE]">newshub24plus.com</span> or <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE]">news-hub-24.com</span>, then publish the downloaded file as <span className="font-mono font-semibold">index.html</span>.
          </p>
        </div>
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-1">
            <p className="font-semibold text-[#991B1B] dark:text-[#F87171]">1. Rename File</p>
            <p className="text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Download <span className="font-mono">{primaryDomain}-official-site.html</span> above and rename it to <span className="font-mono font-semibold text-[#141413] dark:text-[#F5F3EE]">index.html</span>.
            </p>
          </div>
          <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-1">
            <p className="font-semibold text-[#991B1B] dark:text-[#F87171]">2. Upload to Root</p>
            <p className="text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              In cPanel / Hostinger / Namecheap File Manager, upload to <span className="font-mono">public_html/index.html</span> (or drag the folder into Cloudflare Pages / Netlify Drop).
            </p>
          </div>
          <div className="p-3.5 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-1">
            <p className="font-semibold text-[#991B1B] dark:text-[#F87171]">3. Enable HTTPS &amp; DNS</p>
            <p className="text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Add the <span className="font-mono">CNAME</span> and <span className="font-mono">TXT</span> records above, enable AutoSSL/HTTPS, then click <span className="font-medium">Verify Live DNS</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
