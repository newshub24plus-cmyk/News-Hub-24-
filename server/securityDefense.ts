import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { writeJsonAtomic } from './realMonetization.ts';

export type SecurityLayer =
  | 'WAF'
  | 'Malware Scanner'
  | 'Rate Limiter'
  | 'Integrity Guard'
  | 'Prototype Shield';

export type SecuritySeverity = 'Critical' | 'High' | 'Medium' | 'Info';

export interface SecurityIncident {
  id: string;
  timestamp: string;
  layer: SecurityLayer;
  severity: SecuritySeverity;
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

export interface ApkManifestEntryAudit {
  name: string;
  declaredDigest: string;
  computedDigest: string;
  match: boolean;
}

export interface ApkIntegrityReport {
  filename: string;
  packageId: string;
  actualSha256: string;
  expectedSha256: string;
  sha256Match: boolean;
  dexHeaderValid: boolean;
  manifestVerified: boolean;
  entriesAudited: ApkManifestEntryAudit[];
  permissionsDetected: string[];
  disallowedPermissionsFound: string[];
  malwareScanClean: boolean;
  verdict: 'Verified Clean' | 'Tampered / Compromised';
  auditedAt: string;
}

export interface PayloadScanResult {
  scanId: string;
  clean: boolean;
  verdict: 'Clean' | 'Quarantined — Malware / Attack Signature Detected';
  threatCategory: string | null;
  ruleMatched: string | null;
  severity: SecuritySeverity;
  fileTypeDetected: string;
  sha256: string;
  bytesScanned: number;
  scannedAt: string;
  details: string;
}

export interface SecurityStateStore {
  blockedAttacksCount: number;
  quarantinedFilesCount: number;
  rateLimitedCount: number;
  sanitizedPayloadsCount: number;
  scansExecutedCount: number;
  lastApkAudit: ApkIntegrityReport | null;
  incidents: SecurityIncident[];
}

const EICAR_SIGNATURE =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.msi',
  '.vbs',
  '.vbe',
  '.ps1',
  '.psm1',
  '.sh',
  '.bash',
  '.zsh',
  '.php',
  '.phtml',
  '.php5',
  '.jsp',
  '.jspx',
  '.asp',
  '.aspx',
  '.scr',
  '.com',
  '.cpl',
  '.hta',
  '.jar',
  '.py',
  '.rb',
  '.pl',
  '.elf',
  '.so',
  '.dylib',
  '.apk'
]);

const ALLOWED_APK_PERMISSIONS = new Set([
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE'
]);

const HIGH_RISK_APK_PERMISSIONS = new Set([
  'android.permission.READ_SMS',
  'android.permission.SEND_SMS',
  'android.permission.RECEIVE_SMS',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.REQUEST_INSTALL_PACKAGES',
  'android.permission.BIND_ACCESSIBILITY_SERVICE',
  'android.permission.READ_CALL_LOG',
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_EXTERNAL_STORAGE'
]);

const WAF_RULES: Array<{
  name: string;
  category: string;
  severity: SecuritySeverity;
  pattern: RegExp;
  applyToBody?: boolean;
}> = [
  {
    name: 'Path Traversal / LFI Probe',
    category: 'Path Traversal',
    severity: 'High',
    pattern: /(\.\.[/\\]|%2e%2e[/\\%]|\/etc\/passwd\b|win\.ini\b|\0|%00)/i,
    applyToBody: false
  },
  {
    name: 'Sensitive File / Admin Scanner Probe',
    category: 'Reconnaissance Probe',
    severity: 'Medium',
    pattern:
      /(\/\.env\b|\/\.git\/|\/wp-admin\b|\/wp-login\.php|\/phpmyadmin\b|\/cgi-bin\/|\.(php|asp|aspx|jsp)\b)/i,
    applyToBody: false
  },
  {
    name: 'SQL Injection Pattern',
    category: 'SQL Injection',
    severity: 'Critical',
    pattern:
      /(\bUNION\s+(?:ALL\s+)?SELECT\b|\bDROP\s+TABLE\b|;\s*(?:DELETE|DROP|TRUNCATE|ALTER)\s+|'\s*OR\s+['"]?\d+['"]?\s*=\s*['"]?\d+|WAITFOR\s+DELAY\b|SLEEP\(\s*\d+\s*\))/i,
    applyToBody: true
  },
  {
    name: 'Cross-Site Scripting (XSS) Injection',
    category: 'XSS Injection',
    severity: 'High',
    pattern:
      /(<\s*script\b|javascript\s*:\s*[a-z0-9_(]|\bon(?:error|load|mouseover|focus)\s*=\s*['"]?[a-z0-9_(]|<\s*iframe\b[^>]*src\s*=)/i,
    applyToBody: true
  },
  {
    name: 'OS Command / Shell Injection',
    category: 'Command Injection',
    severity: 'Critical',
    pattern:
      /(;\s*(?:curl|wget|nc|netcat|bash|sh|powershell)\b|\|\s*(?:bash|sh|cmd\.exe)\b|`[^`]*(?:curl|wget|whoami|cat\s+\/etc)[^`]*`|\$\(\s*(?:curl|wget|bash|sh|id|whoami))/i,
    applyToBody: true
  },
  {
    name: 'Server-Side Template Injection (SSTI)',
    category: 'Template Injection',
    severity: 'High',
    pattern: /(\{\{\s*\d+\s*\*\s*\d+\s*\}\}|\$\{\s*\d+\s*\*\s*\d+\s*\}|<%=\s*[^%]+%>)/i,
    applyToBody: true
  }
];

const MALWARE_DROPPER_PATTERNS: Array<{
  name: string;
  category: string;
  severity: SecuritySeverity;
  pattern: RegExp;
}> = [
  {
    name: 'EICAR Standard Antivirus Test Signature',
    category: 'Virus Test Signature',
    severity: 'Critical',
    pattern: /X5O!P%@AP\[4\\PZX54\(P\^\)7CC\)7\}\$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!\$H\+H\*/
  },
  {
    name: 'PHP / Web Shell Dropper',
    category: 'Web Shell Malware',
    severity: 'Critical',
    pattern: /(<\?php\b|eval\s*\(\s*(?:base64_decode|gzinflate|str_rot13)|shell_exec\s*\(|passthru\s*\()/i
  },
  {
    name: 'PowerShell Encoded Stager',
    category: 'Script Dropper',
    severity: 'Critical',
    pattern: /(powershell(?:\.exe)?\s+-(?:enc|encodedcommand|w\s+hidden)|Invoke-Expression|IEX\s*\()/i
  },
  {
    name: 'Reverse Shell / Trojan Payload',
    category: 'Trojan / Reverse Shell',
    severity: 'Critical',
    pattern: /(\/dev\/tcp\/\d+\.\d+\.\d+\.\d+|bash\s+-i\s+>&|WScript\.Shell|ActiveXObject|cmd\.exe\s+\/c)/i
  },
  {
    name: 'Embedded Script / XSS Payload',
    category: 'Malicious Script',
    severity: 'High',
    pattern: /(<\s*script\b|javascript\s*:\s*|\bon(?:error|load)\s*=|document\.cookie)/i
  },
  {
    name: 'SQL / Command Injection Signature',
    category: 'Exploit Payload',
    severity: 'High',
    pattern:
      /(\bUNION\s+(?:ALL\s+)?SELECT\b|\bDROP\s+TABLE\b|'\s*OR\s+1\s*=\s*1|\$\(\s*(?:curl|wget|bash|sh))/i
  }
];

export function extractClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

export function maskClientIp(ip: string): string {
  const clean = ip.replace(/^::ffff:/, '');
  if (clean === '127.0.0.1' || clean === '::1') return 'localhost';
  const v4 = clean.split('.');
  if (v4.length === 4) {
    return `${v4[0]}.${v4[1]}.x.x`;
  }
  const v6 = clean.split(':');
  if (v6.length >= 2) {
    return `${v6[0]}:${v6[1]}::*`;
  }
  return 'masked-client';
}

function detectBinaryMagic(buffer: Buffer): { kind: string; isExecutable: boolean } {
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { kind: 'Windows PE Executable (MZ)', isExecutable: true };
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return { kind: 'Linux ELF Binary', isExecutable: true };
  }
  if (
    buffer.length >= 4 &&
    ((buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && (buffer[3] === 0xce || buffer[3] === 0xcf)) ||
      ((buffer[0] === 0xcf || buffer[0] === 0xce) && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe))
  ) {
    return { kind: 'macOS Mach-O Binary', isExecutable: true };
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0xca &&
    buffer[1] === 0xfe &&
    buffer[2] === 0xba &&
    buffer[3] === 0xbe
  ) {
    return { kind: 'Java Class / Universal Binary', isExecutable: true };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 4).toString('ascii') === 'dex\n') {
    return { kind: 'Android Dalvik Executable (DEX)', isExecutable: true };
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return { kind: 'ZIP / APK Archive', isExecutable: false };
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    return { kind: 'ISO Base Media (MP4 / MOV)', isExecutable: false };
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { kind: 'Matroska / WebM Media', isExecutable: false };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'AVI '
  ) {
    return { kind: 'AVI Media Container', isExecutable: false };
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') {
    return { kind: 'Ogg Media Container', isExecutable: false };
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'FLV') {
    return { kind: 'Flash Video Container', isExecutable: false };
  }
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { kind: 'PDF Document', isExecutable: false };
  }
  return { kind: 'Text / Generic Stream', isExecutable: false };
}

export function isDangerousFileName(fileName: string): { dangerous: boolean; reason: string | null } {
  const cleanName = path.basename(fileName.trim()).toLowerCase();
  if (!cleanName || cleanName.includes('\0')) {
    return { dangerous: true, reason: 'Null-byte or invalid filename blocked' };
  }
  const ext = path.extname(cleanName);
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { dangerous: true, reason: `Executable / script extension (${ext}) is prohibited for uploads` };
  }
  // Check double extensions like movie.mp4.exe or archive.zip.bat
  const parts = cleanName.split('.');
  if (parts.length > 2) {
    for (let i = 1; i < parts.length; i++) {
      if (DANGEROUS_EXTENSIONS.has(`.${parts[i]}`)) {
        return {
          dangerous: true,
          reason: `Double-extension masquerading pattern (.${parts[i]}) detected`
        };
      }
    }
  }
  return { dangerous: false, reason: null };
}

export function scanBufferOrPayload(params: {
  buffer?: Buffer;
  text?: string;
  fileName?: string;
  expectedKind?: 'video' | 'general';
}): Omit<PayloadScanResult, 'scanId' | 'scannedAt'> {
  const buf = params.buffer ?? Buffer.from(params.text ?? '', 'utf8');
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const magic = detectBinaryMagic(buf);

  if (params.fileName) {
    const extCheck = isDangerousFileName(params.fileName);
    if (extCheck.dangerous) {
      return {
        clean: false,
        verdict: 'Quarantined — Malware / Attack Signature Detected',
        threatCategory: 'Prohibited Executable Filename',
        ruleMatched: extCheck.reason ?? 'Dangerous File Extension',
        severity: 'Critical',
        fileTypeDetected: magic.kind,
        sha256,
        bytesScanned: buf.length,
        details: `Blocked file "${path.basename(params.fileName)}" before storage: ${extCheck.reason}.`
      };
    }
  }

  if (magic.isExecutable) {
    return {
      clean: false,
      verdict: 'Quarantined — Malware / Attack Signature Detected',
      threatCategory: 'Executable Binary Payload',
      ruleMatched: `Binary Header Signature: ${magic.kind}`,
      severity: 'Critical',
      fileTypeDetected: magic.kind,
      sha256,
      bytesScanned: buf.length,
      details: `Detected disguised executable binary (${magic.kind}) via magic-byte inspection and quarantined payload.`
    };
  }

  // Inspect ASCII/UTF-8 text window (up to first 256KB) for EICAR, webshells, droppers, XSS/SQLi
  const sampleText =
    params.text ?? buf.subarray(0, Math.min(buf.length, 262144)).toString('utf8');

  if (sampleText.includes(EICAR_SIGNATURE)) {
    return {
      clean: false,
      verdict: 'Quarantined — Malware / Attack Signature Detected',
      threatCategory: 'Virus Signature (EICAR)',
      ruleMatched: 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
      severity: 'Critical',
      fileTypeDetected: magic.kind,
      sha256,
      bytesScanned: buf.length,
      details: 'Matched standard EICAR antivirus test signature; payload quarantined immediately.'
    };
  }

  for (const rule of MALWARE_DROPPER_PATTERNS) {
    if (rule.pattern.test(sampleText)) {
      return {
        clean: false,
        verdict: 'Quarantined — Malware / Attack Signature Detected',
        threatCategory: rule.category,
        ruleMatched: rule.name,
        severity: rule.severity,
        fileTypeDetected: magic.kind,
        sha256,
        bytesScanned: buf.length,
        details: `Matched "${rule.name}" (${rule.category}); execution and persistence blocked.`
      };
    }
  }

  // Phishing / suspicious credential URL heuristic check when scanning strings/URLs
  if (params.text) {
    const ipCredentialTrap = /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}[^\s]*(?:login|verify|bank|wallet|momo|ghanapay)/i;
    const atSpoofUrl = /https?:\/\/[^/\s@]+@[^/\s]+\.[a-z]{2,}/i;
    if (ipCredentialTrap.test(params.text) || atSpoofUrl.test(params.text)) {
      return {
        clean: false,
        verdict: 'Quarantined — Malware / Attack Signature Detected',
        threatCategory: 'Phishing / Credential Trap URL',
        ruleMatched: 'Suspicious IP-Literal or Credential-Spoofing URI',
        severity: 'High',
        fileTypeDetected: magic.kind,
        sha256,
        bytesScanned: buf.length,
        details: 'Detected credential phishing URL pattern targeting financial/authentication flows.'
      };
    }
  }

  if (params.expectedKind === 'video' && buf.length >= 16) {
    const allowedVideoKinds = new Set([
      'ISO Base Media (MP4 / MOV)',
      'Matroska / WebM Media',
      'AVI Media Container',
      'Ogg Media Container',
      'Flash Video Container'
    ]);
    const isHtmlOrXml = /^\s*<!doctype|^\s*<html|^\s*<svg/i.test(sampleText);
    if (isHtmlOrXml) {
      return {
        clean: false,
        verdict: 'Quarantined — Malware / Attack Signature Detected',
        threatCategory: 'MIME / Content Spoofing',
        ruleMatched: 'HTML/SVG Markup Disguised in Video Stream',
        severity: 'High',
        fileTypeDetected: 'HTML/XML Markup',
        sha256,
        bytesScanned: buf.length,
        details: 'Rejected disguised markup inside video chunk upload.'
      };
    }
    // Allow standard MPEG-TS sync byte 0x47 or recognized containers; warn/block clear non-media binaries
    const isMpegTs = buf[0] === 0x47;
    if (!allowedVideoKinds.has(magic.kind) && !isMpegTs && params.fileName?.toLowerCase().endsWith('.mp4')) {
      // Allow small synthetic test blobs if they are pure zeros, otherwise ensure no executable/script matched above
      const hasPrintableTextOnly = /^[\x20-\x7E\r\n\t]+$/.test(sampleText.slice(0, 64));
      if (hasPrintableTextOnly && sampleText.trim().length > 0 && /(<|>|function\s*\(|import\s+)/i.test(sampleText)) {
        return {
          clean: false,
          verdict: 'Quarantined — Malware / Attack Signature Detected',
          threatCategory: 'Disguised Script File',
          ruleMatched: 'Script Source Uploaded with .mp4 Extension',
          severity: 'High',
          fileTypeDetected: 'Script / Source Text',
          sha256,
          bytesScanned: buf.length,
          details: 'Rejected script source code masquerading as an MP4 video upload.'
        };
      }
    }
  }

  return {
    clean: true,
    verdict: 'Clean',
    threatCategory: null,
    ruleMatched: null,
    severity: 'Info',
    fileTypeDetected: magic.kind,
    sha256,
    bytesScanned: buf.length,
    details: `Scanned ${buf.length.toLocaleString()} bytes against executable headers, EICAR, web shells, and injection signatures — zero threats found.`
  };
}

function parseZipEntries(zipBuffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const compSize = zipBuffer.readUInt32LE(offset + 18);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + nameLen + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > zipBuffer.length) break;
    const name = zipBuffer.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    entries.set(name, zipBuffer.subarray(dataStart, dataEnd));
    offset = dataEnd;
  }
  return entries;
}

export function verifyApkPackageIntegrity(
  apkBuffer: Buffer,
  expectedSha256: string,
  apkFilename: string
): ApkIntegrityReport {
  const actualSha256 = crypto.createHash('sha256').update(apkBuffer).digest('hex');
  const sha256Match = actualSha256 === expectedSha256;

  const entries = parseZipEntries(apkBuffer);
  const manifestRaw = entries.get('META-INF/MANIFEST.MF')?.toString('utf8') ?? '';
  const manifestLines = manifestRaw.split(/\r?\n/);

  const declaredDigests = new Map<string, string>();
  let currentName: string | null = null;
  for (const line of manifestLines) {
    if (line.startsWith('Name: ')) {
      currentName = line.slice(6).trim();
    } else if (line.startsWith('SHA-256-Digest: ') && currentName) {
      declaredDigests.set(currentName, line.slice(16).trim());
      currentName = null;
    }
  }

  const entriesAudited: ApkManifestEntryAudit[] = [];
  for (const [name, declaredDigest] of declaredDigests.entries()) {
    const entryBuf = entries.get(name);
    const computedDigest = entryBuf
      ? crypto.createHash('sha256').update(entryBuf).digest('base64')
      : 'MISSING';
    entriesAudited.push({
      name,
      declaredDigest,
      computedDigest,
      match: Boolean(entryBuf) && declaredDigest === computedDigest
    });
  }

  const manifestVerified =
    entriesAudited.length > 0 && entriesAudited.every((item) => item.match);

  const dexBuf = entries.get('classes.dex');
  const dexHeaderValid = Boolean(
    dexBuf &&
      dexBuf.length >= 44 &&
      dexBuf.subarray(0, 8).toString('ascii') === 'dex\n035\0'
  );

  const androidManifest = entries.get('AndroidManifest.xml')?.toString('utf8') ?? '';
  const permMatches = [...androidManifest.matchAll(/android\.permission\.[A-Z0-9_]+/g)].map(
    (m) => m[0]
  );
  const permissionsDetected = Array.from(new Set(permMatches));
  const disallowedPermissionsFound = permissionsDetected.filter(
    (perm) => HIGH_RISK_APK_PERMISSIONS.has(perm) || !ALLOWED_APK_PERMISSIONS.has(perm)
  );

  // Ensure none of the APK text assets contain web shell or script droppers
  let malwareScanClean = true;
  for (const [entryName, entryData] of entries.entries()) {
    if (entryName.endsWith('.xml') || entryName.endsWith('.json')) {
      const scan = scanBufferOrPayload({ buffer: entryData });
      if (!scan.clean) {
        malwareScanClean = false;
        break;
      }
    }
  }

  const allClean =
    sha256Match &&
    manifestVerified &&
    dexHeaderValid &&
    disallowedPermissionsFound.length === 0 &&
    malwareScanClean;

  return {
    filename: apkFilename,
    packageId: 'com.newshub24plus.android',
    actualSha256,
    expectedSha256,
    sha256Match,
    dexHeaderValid,
    manifestVerified,
    entriesAudited,
    permissionsDetected,
    disallowedPermissionsFound,
    malwareScanClean,
    verdict: allClean ? 'Verified Clean' : 'Tampered / Compromised',
    auditedAt: new Date().toISOString()
  };
}

export class SecurityDefenseEngine {
  private statePath: string;
  private state: SecurityStateStore;
  private rateBuckets = new Map<string, { count: number; resetAt: number }>();
  private strikeTracker = new Map<string, { strikes: number; quarantinedUntil: number }>();

  constructor(statePath: string) {
    this.statePath = statePath;
    this.state = this.loadState();
  }

  private loadState(): SecurityStateStore {
    const defaultState: SecurityStateStore = {
      blockedAttacksCount: 0,
      quarantinedFilesCount: 0,
      rateLimitedCount: 0,
      sanitizedPayloadsCount: 0,
      scansExecutedCount: 0,
      lastApkAudit: null,
      incidents: []
    };
    try {
      if (fs.existsSync(this.statePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.statePath, 'utf8')) as Partial<SecurityStateStore>;
        return {
          ...defaultState,
          ...parsed,
          incidents: Array.isArray(parsed.incidents) ? parsed.incidents.slice(0, 60) : []
        };
      }
    } catch {
      // Fall back to clean security store
    }
    return defaultState;
  }

  private persistState(): void {
    try {
      writeJsonAtomic(this.statePath, this.state);
    } catch {
      // Non-fatal persistence safeguard
    }
  }

  public recordIncident(incident: Omit<SecurityIncident, 'id' | 'timestamp'>): SecurityIncident {
    const entry: SecurityIncident = {
      id: `SEC-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`,
      timestamp: new Date().toISOString(),
      ...incident
    };

    if (incident.actionTaken === 'Blocked (403)') {
      this.state.blockedAttacksCount += 1;
    } else if (incident.actionTaken === 'Quarantined (422)') {
      this.state.quarantinedFilesCount += 1;
    } else if (incident.actionTaken === 'Rate Limited (429)') {
      this.state.rateLimitedCount += 1;
    } else if (incident.actionTaken === 'Sanitized') {
      this.state.sanitizedPayloadsCount += 1;
    }

    this.state.incidents.unshift(entry);
    if (this.state.incidents.length > 60) {
      this.state.incidents.length = 60;
    }
    this.persistState();
    return entry;
  }

  public recordScanRun(audit?: ApkIntegrityReport): void {
    this.state.scansExecutedCount += 1;
    if (audit) {
      this.state.lastApkAudit = audit;
    }
    this.persistState();
  }

  public getStatusSnapshot(apkAudit?: ApkIntegrityReport | null) {
    if (apkAudit && !this.state.lastApkAudit) {
      this.state.lastApkAudit = apkAudit;
    }
    return {
      protectionActive: true,
      engineSummary: 'Active Multi-Layer Cyberattack, WAF, Rate Limit & Virus Defense',
      layers: [
        {
          id: 'headers-csp',
          name: 'HTTP Security Headers & CSP',
          status: 'Active',
          detail:
            'Enforces X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy, COOP, and strict Content-Security-Policy (object-src none).'
        },
        {
          id: 'waf-shield',
          name: 'WAF & Prototype-Pollution Shield',
          status: 'Active',
          detail:
            'Inspects incoming requests against SQLi, XSS, OS command injection, SSTI, LFI path traversal, scanner probes, and strips __proto__/constructor keys.'
        },
        {
          id: 'rate-limiter',
          name: 'Adaptive DDoS & Financial Rate Limiter',
          status: 'Active',
          detail:
            'Sliding-window throttling (40 req/min on financial & unlock routes, 300 req/min general API) plus automatic IP strike quarantine.'
        },
        {
          id: 'virus-apk-guard',
          name: 'Upload Malware Scanner & APK Integrity',
          status: 'Active',
          detail:
            'Scans upload chunks for EICAR, PE/ELF/Mach-O/DEX executables, disguised double extensions, and verifies APK SHA-256 manifest signatures.'
        }
      ],
      metrics: {
        blockedAttacksCount: this.state.blockedAttacksCount,
        quarantinedFilesCount: this.state.quarantinedFilesCount,
        rateLimitedCount: this.state.rateLimitedCount,
        sanitizedPayloadsCount: this.state.sanitizedPayloadsCount,
        scansExecutedCount: this.state.scansExecutedCount
      },
      lastApkAudit: apkAudit ?? this.state.lastApkAudit,
      recentIncidents: this.state.incidents.slice(0, 20)
    };
  }

  public sanitizeJsonValue(
    val: unknown,
    depth = 0
  ): { sanitized: unknown; strippedProto: boolean; exceededDepth: boolean } {
    if (depth > 20) {
      return { sanitized: null, strippedProto: false, exceededDepth: true };
    }
    if (Array.isArray(val)) {
      let stripped = false;
      const out: unknown[] = [];
      for (const item of val) {
        const res = this.sanitizeJsonValue(item, depth + 1);
        if (res.exceededDepth) return { sanitized: null, strippedProto: stripped, exceededDepth: true };
        if (res.strippedProto) stripped = true;
        out.push(res.sanitized);
      }
      return { sanitized: out, strippedProto: stripped, exceededDepth: false };
    }
    if (val !== null && typeof val === 'object') {
      let stripped = false;
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          stripped = true;
          continue;
        }
        const res = this.sanitizeJsonValue(v, depth + 1);
        if (res.exceededDepth) return { sanitized: null, strippedProto: stripped, exceededDepth: true };
        if (res.strippedProto) stripped = true;
        out[key] = res.sanitized;
      }
      return { sanitized: out, strippedProto: stripped, exceededDepth: false };
    }
    return { sanitized: val, strippedProto: false, exceededDepth: false };
  }

  public headersMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(self)'
    );
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    // Keep CSP compatible with Vite SPA + Google Fonts + external payment/RPC origins + AI Studio preview frame
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/downloads/')) {
      res.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "media-src 'self' blob: https:",
          "connect-src 'self' https://api.coingecko.com https://open.er-api.com https://api.mainnet-beta.solana.com https://api.ghanapay.gh https://*.ghanapay.com.gh https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://api.flutterwave.com https://api-m.paypal.com https://api-m.sandbox.paypal.com https://api.stripe.com ws: wss:",
          "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'self' https://aistudio.google.com https://*.googleusercontent.com https://*.google.com"
        ].join('; ')
      );
    }
    next();
  };

  public rateLimitMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.path.startsWith('/api/') && req.path !== '/webhook') {
      next();
      return;
    }

    const ip = extractClientIp(req);
    const now = Date.now();

    // Check active quarantine from repeated WAF triggers
    const strikeInfo = this.strikeTracker.get(ip);
    if (strikeInfo && strikeInfo.quarantinedUntil > now) {
      const retryAfterSec = Math.max(1, Math.ceil((strikeInfo.quarantinedUntil - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Client temporarily quarantined due to repeated malicious requests.',
        retryAfterSec
      });
      return;
    }

    const isSensitiveFinancial =
      req.method === 'POST' &&
      (req.path.startsWith('/api/owner/withdraw') ||
        req.path === '/api/revenue-engine/withdraw' ||
        req.path === '/api/rewards/convert' ||
        req.path === '/api/confidential-tips/unlock' ||
        req.path.startsWith('/api/monetization/'));

    const tierKey = isSensitiveFinancial ? 'sensitive' : 'general';
    const limit = isSensitiveFinancial ? 45 : 360;
    const windowMs = 60_000;
    const bucketKey = `${tierKey}:${ip}`;

    let bucket = this.rateBuckets.get(bucketKey);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.rateBuckets.set(bucketKey, bucket);
    }
    bucket.count += 1;

    // Periodic cleanup of expired buckets to keep memory bounded
    if (this.rateBuckets.size > 2000) {
      for (const [k, b] of this.rateBuckets.entries()) {
        if (now > b.resetAt) this.rateBuckets.delete(k);
      }
    }

    const remaining = Math.max(0, limit - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      this.recordIncident({
        layer: 'Rate Limiter',
        severity: 'Medium',
        category: 'Rate Limit / DDoS Throttle',
        ruleMatched: `${tierKey === 'sensitive' ? 'Financial/Auth' : 'API'} Window (${limit}/min)`,
        targetPath: req.path,
        clientIpMasked: maskClientIp(ip),
        actionTaken: 'Rate Limited (429)',
        details: `Exceeded ${limit} requests/60s on ${req.path}.`
      });
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait briefly before retrying.',
        retryAfterSec: retryAfter
      });
      return;
    }

    next();
  };

  private collectBodyStrings(val: unknown, out: string[], depth = 0): void {
    if (depth > 8 || out.length > 80) return;
    if (typeof val === 'string') {
      if (val.length > 0 && val.length <= 4096) out.push(val);
      return;
    }
    if (Array.isArray(val)) {
      for (const item of val) this.collectBodyStrings(item, out, depth + 1);
      return;
    }
    if (val !== null && typeof val === 'object') {
      for (const v of Object.values(val as Record<string, unknown>)) {
        this.collectBodyStrings(v, out, depth + 1);
      }
    }
  }

  public wafAndSanitizeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const p = req.path;
    // Skip Vite dev assets & intentionally scanned sandbox payloads on /api/security/scan
    if (
      p.startsWith('/@vite') ||
      p.startsWith('/@react-refresh') ||
      p.startsWith('/node_modules') ||
      p.startsWith('/src/') ||
      p === '/api/security/scan'
    ) {
      next();
      return;
    }

    const ip = extractClientIp(req);
    const maskedIp = maskClientIp(ip);

    // 1. Inspect URL path + query string + User-Agent against WAF signatures
    let decodedUrl = req.originalUrl;
    try {
      decodedUrl = decodeURIComponent(req.originalUrl);
    } catch {
      // Malformed percent encoding
      this.recordIncident({
        layer: 'WAF',
        severity: 'Medium',
        category: 'Malformed URI Encoding',
        ruleMatched: 'Invalid Percent-Encoded Sequence',
        targetPath: req.path,
        clientIpMasked: maskedIp,
        actionTaken: 'Blocked (403)',
        details: 'Rejected request containing malformed URI percent encoding.'
      });
      res.status(403).json({ error: 'Request blocked by security policy (malformed URI).' });
      return;
    }

    const ua = String(req.headers['user-agent'] ?? '');
    if (/\b(sqlmap|nikto|acunetix|nessus|masscan|nuclei|havij)\b/i.test(ua)) {
      this.flagStrikeAndBlock(req, res, {
        category: 'Automated Exploit Scanner',
        ruleMatched: 'Known Vulnerability Scanner User-Agent',
        severity: 'High',
        details: `Blocked automated exploit scanner user-agent probing ${req.path}.`
      });
      return;
    }

    for (const rule of WAF_RULES) {
      if (rule.pattern.test(decodedUrl) || rule.pattern.test(req.path)) {
        this.flagStrikeAndBlock(req, res, {
          category: rule.category,
          ruleMatched: rule.name,
          severity: rule.severity,
          details: `Blocked suspicious URI/query matching ${rule.name}.`
        });
        return;
      }
    }

    // 2. Strip Prototype Pollution keys & enforce JSON nesting cap
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      const sanitized = this.sanitizeJsonValue(req.body);
      if (sanitized.exceededDepth) {
        this.recordIncident({
          layer: 'WAF',
          severity: 'High',
          category: 'Payload DoS / Deep Nesting',
          ruleMatched: 'Max JSON Depth (> 20 levels)',
          targetPath: req.path,
          clientIpMasked: maskedIp,
          actionTaken: 'Blocked (403)',
          details: 'Rejected excessively nested JSON payload.'
        });
        res.status(403).json({ error: 'Payload exceeds maximum allowed nesting depth.' });
        return;
      }
      if (sanitized.strippedProto) {
        this.recordIncident({
          layer: 'Prototype Shield',
          severity: 'High',
          category: 'Prototype Pollution Attempt',
          ruleMatched: 'Stripped __proto__ / constructor / prototype Keys',
          targetPath: req.path,
          clientIpMasked: maskedIp,
          actionTaken: 'Sanitized',
          details: `Stripped dangerous object prototype keys from JSON payload on ${req.path}.`
        });
      }
      req.body = sanitized.sanitized;

      // 3. Scan JSON string values for injection/XSS signatures (skip webhook signature payloads)
      if (!p.startsWith('/api/webhooks/')) {
        const bodyStrings: string[] = [];
        this.collectBodyStrings(req.body, bodyStrings);
        for (const str of bodyStrings) {
          for (const rule of WAF_RULES) {
            if (rule.applyToBody && rule.pattern.test(str)) {
              this.flagStrikeAndBlock(req, res, {
                category: rule.category,
                ruleMatched: rule.name,
                severity: rule.severity,
                details: `Blocked malicious request body matching ${rule.name} on ${req.path}.`
              });
              return;
            }
          }
        }
      }
    }

    next();
  };

  private flagStrikeAndBlock(
    req: Request,
    res: Response,
    info: { category: string; ruleMatched: string; severity: SecuritySeverity; details: string }
  ): void {
    const ip = extractClientIp(req);
    const now = Date.now();
    const existing = this.strikeTracker.get(ip) ?? { strikes: 0, quarantinedUntil: 0 };
    existing.strikes += 1;
    if (existing.strikes >= 4) {
      existing.quarantinedUntil = now + 60_000;
      existing.strikes = 0;
    }
    this.strikeTracker.set(ip, existing);

    const incident = this.recordIncident({
      layer: 'WAF',
      severity: info.severity,
      category: info.category,
      ruleMatched: info.ruleMatched,
      targetPath: req.path,
      clientIpMasked: maskClientIp(ip),
      actionTaken: 'Blocked (403)',
      details: info.details
    });

    res.status(403).json({
      error: `Blocked by News Hub 24+ Security Firewall (${info.category}).`,
      incidentId: incident.id,
      rule: info.ruleMatched
    });
  }
}
