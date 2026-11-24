import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const CONFIDENTIAL_CASE_CATEGORIES = [
  'Public Corruption & Bribery',
  'Corporate & Financial Fraud',
  'High-Profile Executive / Public Figure Case',
  'Human Rights & Conflict Reporting',
  'Judicial & Law Enforcement Misconduct',
  'Cybersecurity & Data Breach',
  'Environment & Safety Cover-Up',
  'Press Freedom & Whistleblower Threats',
  'Other High-Profile Case'
] as const;

export type ConfidentialCaseCategory = (typeof CONFIDENTIAL_CASE_CATEGORIES)[number];

export const CONFIDENTIAL_SEVERITIES = ['Critical', 'High', 'Elevated', 'Standard'] as const;
export type ConfidentialSeverity = (typeof CONFIDENTIAL_SEVERITIES)[number];

export const CONFIDENTIAL_REGIONS = [
  'Global / Cross-Border',
  'Europe',
  'Asia-Pacific',
  'Americas',
  'Africa & Middle East'
] as const;
export type ConfidentialRegion = (typeof CONFIDENTIAL_REGIONS)[number];

export type ConfidentialCaseStatus =
  | 'Received & Sealed'
  | 'Under Verification'
  | 'Assigned to Investigative Desk';

export interface ConfidentialChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

export interface ConfidentialFollowUp {
  id: string;
  sender: 'tipster' | 'desk';
  message: string;
  createdAt: string;
}

export interface ConfidentialDecryptedPayload {
  narrative: string;
  involvedEntities: string;
  evidenceTypes: string;
  safetyNotes: string;
  transcript: ConfidentialChatMessage[];
  followUps: ConfidentialFollowUp[];
}

interface EncryptedEnvelope {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface StoredConfidentialRecord {
  caseId: string;
  category: ConfidentialCaseCategory;
  severity: ConfidentialSeverity;
  region: ConfidentialRegion;
  status: ConfidentialCaseStatus;
  redactedTopicTag: string;
  evidenceSummary: string;
  createdAt: string;
  updatedAt: string;
  followUpCount: number;
  integritySha256: string;
  salt: string;
  passkeyHash: string;
  envelope: EncryptedEnvelope;
}

export interface ConfidentialPublicRecord {
  caseId: string;
  category: ConfidentialCaseCategory;
  severity: ConfidentialSeverity;
  region: ConfidentialRegion;
  status: ConfidentialCaseStatus;
  redactedTopicTag: string;
  createdAt: string;
  updatedAt: string;
  followUpCount: number;
  encryption: 'AES-256-GCM';
}

export interface ConfidentialChatTurnResult {
  reply: string;
  mode: 'gemini-ai' | 'standard-protocol';
  detectedCategory: ConfidentialCaseCategory;
  detectedSeverity: ConfidentialSeverity;
  detectedRegion: ConfidentialRegion;
  readinessScore: number;
  readyToSeal: boolean;
  suggestedTitle: string;
  suggestedEntities: string;
  suggestedEvidence: string;
  piiScrubbedCount: number;
  warnings: string[];
}

const PASSKEY_WORDS = [
  'amber',
  'atlas',
  'beacon',
  'cedar',
  'cipher',
  'cobalt',
  'crest',
  'delta',
  'echo',
  'falcon',
  'fjord',
  'granite',
  'harbor',
  'horizon',
  'ivory',
  'jasper',
  'kestrel',
  'lantern',
  'marble',
  'meridian',
  'north',
  'obsidian',
  'onyx',
  'orion',
  'prism',
  'quartz',
  'ridge',
  'saffron',
  'sentinel',
  'shield',
  'silver',
  'summit',
  'timber',
  'valiant',
  'verdict',
  'zenith'
];

export function isGeminiTipBotConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

export function scrubSensitiveIdentifiers(input: string): {
  cleaned: string;
  scrubbedCount: number;
  warnings: string[];
} {
  let cleaned = input;
  let scrubbedCount = 0;
  const warnings: string[] = [];

  // Mask email addresses
  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const emailMatches = cleaned.match(emailRegex);
  if (emailMatches && emailMatches.length > 0) {
    scrubbedCount += emailMatches.length;
    cleaned = cleaned.replace(emailRegex, '[REDACTED-EMAIL]');
    warnings.push('Email addresses were automatically masked to protect source anonymity.');
  }

  // Mask phone numbers (international & local formats with 9+ digits)
  const phoneRegex = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,3}\d{3,4}/g;
  cleaned = cleaned.replace(phoneRegex, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    // Avoid masking 4-digit years or short numbers/monetary figures
    if (digitsOnly.length >= 9 && digitsOnly.length <= 15 && !/^\d{4}$/.test(match.trim())) {
      scrubbedCount += 1;
      if (!warnings.some((w) => w.includes('Phone numbers'))) {
        warnings.push('Phone numbers were automatically masked before storage.');
      }
      return '[REDACTED-PHONE]';
    }
    return match;
  });

  // Mask IPv4 addresses
  const ipv4Regex = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
  const ipMatches = cleaned.match(ipv4Regex);
  if (ipMatches && ipMatches.length > 0) {
    scrubbedCount += ipMatches.length;
    cleaned = cleaned.replace(ipv4Regex, '[REDACTED-IP]');
    warnings.push('IP addresses were masked automatically.');
  }

  // Mask SSN-style national IDs
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  const ssnMatches = cleaned.match(ssnRegex);
  if (ssnMatches && ssnMatches.length > 0) {
    scrubbedCount += ssnMatches.length;
    cleaned = cleaned.replace(ssnRegex, '[REDACTED-ID]');
    warnings.push('National ID patterns were masked automatically.');
  }

  return { cleaned, scrubbedCount, warnings };
}

function normalizeCategory(raw: unknown, textHint = ''): ConfidentialCaseCategory {
  if (typeof raw === 'string') {
    const clean = raw.trim().toLowerCase();
    const exact = CONFIDENTIAL_CASE_CATEGORIES.find((c) => c.toLowerCase() === clean);
    if (exact) return exact;
    const partial = CONFIDENTIAL_CASE_CATEGORIES.find(
      (c) => clean.includes(c.toLowerCase()) || c.toLowerCase().includes(clean)
    );
    if (partial) return partial;
  }

  const hay = `${typeof raw === 'string' ? raw : ''} ${textHint}`.toLowerCase();
  if (/bribe|kickback|minister|senator|mayor|official|tender|procurement|corrupt/.test(hay)) {
    return 'Public Corruption & Bribery';
  }
  if (/fraud|embezzl|launder|shell compan|offshore|insider trading|accounting|bank|wire transfer/.test(hay)) {
    return 'Corporate & Financial Fraud';
  }
  if (/celebrity|actor|athlete|ceo|billionaire|royalty|high-profile|executive|scandal/.test(hay)) {
    return 'High-Profile Executive / Public Figure Case';
  }
  if (/abuse|traffick|war crime|detention|protest|conflict|human rights|refugee/.test(hay)) {
    return 'Human Rights & Conflict Reporting';
  }
  if (/judge|court|police|prosecutor|verdict|misconduct|cover-up/.test(hay)) {
    return 'Judicial & Law Enforcement Misconduct';
  }
  if (/hack|breach|ransomware|leak|database|surveillance|spyware|cyber/.test(hay)) {
    return 'Cybersecurity & Data Breach';
  }
  if (/toxic|dumping|pollution|safety|oil spill|defective|factory/.test(hay)) {
    return 'Environment & Safety Cover-Up';
  }
  if (/journalist|threat|censorship|retaliation|whistleblower|intimidation/.test(hay)) {
    return 'Press Freedom & Whistleblower Threats';
  }
  return 'Other High-Profile Case';
}

function normalizeSeverity(raw: unknown, textHint = ''): ConfidentialSeverity {
  if (raw === 'Critical' || raw === 'High' || raw === 'Elevated' || raw === 'Standard') {
    return raw;
  }
  const hay = `${typeof raw === 'string' ? raw : ''} ${textHint}`.toLowerCase();
  if (/imminent|life|threat|arrest|urgent|critical|violence|kill|retaliat|active breach/.test(hay)) {
    return 'Critical';
  }
  if (/million|billion|minister|ceo|public official|classified|offshore|high profile|high-profile/.test(hay)) {
    return 'High';
  }
  if (/document|evidence|witness|internal/.test(hay)) {
    return 'Elevated';
  }
  return 'High';
}

function normalizeRegion(raw: unknown, textHint = ''): ConfidentialRegion {
  if (
    raw === 'Global / Cross-Border' ||
    raw === 'Europe' ||
    raw === 'Asia-Pacific' ||
    raw === 'Americas' ||
    raw === 'Africa & Middle East'
  ) {
    return raw;
  }
  const hay = `${typeof raw === 'string' ? raw : ''} ${textHint}`.toLowerCase();
  if (/eu\b|europe|london|uk\b|brussels|paris|berlin|geneva|madrid|rome|zurich|nordic|ukraine/.test(hay)) {
    return 'Europe';
  }
  if (/asia|tokyo|beijing|shanghai|hong kong|singapore|seoul|delhi|mumbai|manila|bangkok|jakarta|taipei/.test(hay)) {
    return 'Asia-Pacific';
  }
  if (/usa|united states|washington|new york|canada|brazil|mexico|latin america/.test(hay)) {
    return 'Americas';
  }
  if (/africa|nigeria|kenya|south africa|cairo|dubai|middle east|riyadh|israel|gaza|ghana/.test(hay)) {
    return 'Africa & Middle East';
  }
  return 'Global / Cross-Border';
}

function generateCaseId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `NH24-ANON-${suffix}`;
}

function generateOneTimePasskey(): string {
  const b = crypto.randomBytes(6);
  const w1 = PASSKEY_WORDS[b[0] % PASSKEY_WORDS.length];
  const w2 = PASSKEY_WORDS[b[1] % PASSKEY_WORDS.length];
  const digits = ((b[2] << 8) | b[3]) % 9000 + 1000;
  const w3 = PASSKEY_WORDS[b[4] % PASSKEY_WORDS.length];
  return `${w1}-${w2}-${digits}-${w3}`;
}

function deriveKey(passkey: string, saltHex: string): Buffer {
  return crypto.scryptSync(passkey.trim().toLowerCase(), saltHex, 32);
}

function hashPasskey(passkey: string, saltHex: string): string {
  const derived = crypto.scryptSync(`verify:${passkey.trim().toLowerCase()}`, saltHex, 32);
  return derived.toString('hex');
}

function verifyPasskeyHash(passkey: string, saltHex: string, expectedHex: string): boolean {
  const actual = Buffer.from(hashPasskey(passkey, saltHex), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function encryptPayload(payload: ConfidentialDecryptedPayload, passkey: string, saltHex: string): EncryptedEnvelope {
  const key = deriveKey(passkey, saltHex);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('hex')
  };
}

function decryptPayload(envelope: EncryptedEnvelope, passkey: string, saltHex: string): ConfidentialDecryptedPayload {
  const key = deriveKey(passkey, saltHex);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'hex')),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString('utf8')) as ConfidentialDecryptedPayload;
}

function computeIntegrityDigest(caseId: string, createdAt: string, ciphertextHex: string): string {
  return crypto
    .createHash('sha256')
    .update(`${caseId}:${createdAt}:${ciphertextHex}`)
    .digest('hex');
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return candidate.slice(start, end + 1);
  }
  return candidate;
}

export class ConfidentialVaultStore {
  private readonly filePath: string;
  private records: StoredConfidentialRecord[] = [];

  constructor(storagePath: string) {
    this.filePath = storagePath;
    this.records = this.load();
  }

  private load(): StoredConfidentialRecord[] {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        if (Array.isArray(parsed)) return parsed as StoredConfidentialRecord[];
      }
    } catch {
      // Fallback cleanly to empty vault
    }
    return [];
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.records, null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
    } catch {
      // Ignore read-only fs errors
    }
  }

  public getPublicStatus() {
    const criticalCount = this.records.filter((r) => r.severity === 'Critical').length;
    const highCount = this.records.filter((r) => r.severity === 'High').length;
    return {
      aiGuided: isGeminiTipBotConfigured(),
      model: isGeminiTipBotConfigured() ? 'gemini-4-hydrogen' : 'standard-intake-protocol',
      encryption: 'AES-256-GCM' as const,
      zeroIdentityLogging: true,
      categories: CONFIDENTIAL_CASE_CATEGORIES,
      severities: CONFIDENTIAL_SEVERITIES,
      regions: CONFIDENTIAL_REGIONS,
      stats: {
        totalSealed: this.records.length,
        criticalCount,
        highCount
      },
      publicAuditLog: this.records.slice(0, 12).map(
        (r): ConfidentialPublicRecord => ({
          caseId: r.caseId,
          category: r.category,
          severity: r.severity,
          region: r.region,
          status: r.status,
          redactedTopicTag: r.redactedTopicTag,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          followUpCount: r.followUpCount,
          encryption: 'AES-256-GCM'
        })
      )
    };
  }

  public submitSealedCase(params: {
    category: string;
    severity: string;
    region: string;
    narrative: string;
    involvedEntities?: string;
    evidenceTypes?: string;
    safetyNotes?: string;
    transcript?: ConfidentialChatMessage[];
    redactPii: boolean;
  }) {
    const scrubNarrative = params.redactPii
      ? scrubSensitiveIdentifiers(params.narrative)
      : { cleaned: params.narrative.trim(), scrubbedCount: 0, warnings: [] };
    const scrubEntities = params.redactPii
      ? scrubSensitiveIdentifiers(params.involvedEntities ?? '')
      : { cleaned: (params.involvedEntities ?? '').trim(), scrubbedCount: 0, warnings: [] };
    const scrubEvidence = params.redactPii
      ? scrubSensitiveIdentifiers(params.evidenceTypes ?? '')
      : { cleaned: (params.evidenceTypes ?? '').trim(), scrubbedCount: 0, warnings: [] };
    const scrubSafety = params.redactPii
      ? scrubSensitiveIdentifiers(params.safetyNotes ?? '')
      : { cleaned: (params.safetyNotes ?? '').trim(), scrubbedCount: 0, warnings: [] };

    const cleanedTranscript: ConfidentialChatMessage[] = Array.isArray(params.transcript)
      ? params.transcript.slice(-24).map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: params.redactPii ? scrubSensitiveIdentifiers(String(m.text || '')).cleaned : String(m.text || ''),
          timestamp: m.timestamp || new Date().toISOString()
        }))
      : [];

    const category = normalizeCategory(params.category, scrubNarrative.cleaned);
    const severity = normalizeSeverity(params.severity, `${scrubNarrative.cleaned} ${scrubSafety.cleaned}`);
    const region = normalizeRegion(params.region, `${scrubNarrative.cleaned} ${scrubEntities.cleaned}`);

    let caseId = generateCaseId();
    while (this.records.some((r) => r.caseId === caseId)) {
      caseId = generateCaseId();
    }

    const passkey = generateOneTimePasskey();
    const salt = crypto.randomBytes(16).toString('hex');
    const passkeyHash = hashPasskey(passkey, salt);
    const nowIso = new Date().toISOString();

    const payload: ConfidentialDecryptedPayload = {
      narrative: scrubNarrative.cleaned,
      involvedEntities: scrubEntities.cleaned || 'Withheld / Not specified',
      evidenceTypes: scrubEvidence.cleaned || 'Tipster narrative only',
      safetyNotes: scrubSafety.cleaned || 'Standard source protection active',
      transcript: cleanedTranscript,
      followUps: []
    };

    const envelope = encryptPayload(payload, passkey, salt);
    const integritySha256 = computeIntegrityDigest(caseId, nowIso, envelope.ciphertext);

    const record: StoredConfidentialRecord = {
      caseId,
      category,
      severity,
      region,
      status: 'Received & Sealed',
      redactedTopicTag: `Sealed ${category} Tip · ${region}`,
      evidenceSummary: payload.evidenceTypes.slice(0, 80),
      createdAt: nowIso,
      updatedAt: nowIso,
      followUpCount: 0,
      integritySha256,
      salt,
      passkeyHash,
      envelope
    };

    this.records.unshift(record);
    if (this.records.length > 100) {
      this.records.length = 100;
    }
    this.save();

    const totalScrubbed =
      scrubNarrative.scrubbedCount +
      scrubEntities.scrubbedCount +
      scrubEvidence.scrubbedCount +
      scrubSafety.scrubbedCount;

    return {
      receipt: {
        caseId,
        passkey,
        category,
        severity,
        region,
        status: record.status,
        encryption: 'AES-256-GCM' as const,
        integritySha256,
        createdAt: nowIso,
        redactedTopicTag: record.redactedTopicTag,
        piiScrubbedCount: totalScrubbed
      },
      vaultStatus: this.getPublicStatus()
    };
  }

  public unlockCase(caseId: string, passkey: string) {
    const cleanId = caseId.trim().toUpperCase();
    const record = this.records.find((r) => r.caseId === cleanId);
    if (!record) {
      throw Object.assign(new Error('No sealed case matches that Case ID.'), { status: 404 });
    }
    if (!verifyPasskeyHash(passkey, record.salt, record.passkeyHash)) {
      throw Object.assign(new Error('Invalid secret passkey. Decryption denied.'), { status: 403 });
    }

    const decrypted = decryptPayload(record.envelope, passkey, record.salt);
    return {
      caseId: record.caseId,
      category: record.category,
      severity: record.severity,
      region: record.region,
      status: record.status,
      encryption: 'AES-256-GCM' as const,
      integritySha256: record.integritySha256,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      followUpCount: record.followUpCount,
      ...decrypted
    };
  }

  public appendFollowUp(caseId: string, passkey: string, message: string, redactPii: boolean) {
    const cleanId = caseId.trim().toUpperCase();
    const record = this.records.find((r) => r.caseId === cleanId);
    if (!record) {
      throw Object.assign(new Error('No sealed case matches that Case ID.'), { status: 404 });
    }
    if (!verifyPasskeyHash(passkey, record.salt, record.passkeyHash)) {
      throw Object.assign(new Error('Invalid secret passkey. Cannot modify sealed dossier.'), { status: 403 });
    }

    const decrypted = decryptPayload(record.envelope, passkey, record.salt);
    const scrub = redactPii
      ? scrubSensitiveIdentifiers(message)
      : { cleaned: message.trim(), scrubbedCount: 0, warnings: [] };

    const nowIso = new Date().toISOString();
    const entry: ConfidentialFollowUp = {
      id: `FU-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      sender: 'tipster',
      message: scrub.cleaned,
      createdAt: nowIso
    };

    decrypted.followUps.push(entry);
    record.envelope = encryptPayload(decrypted, passkey, record.salt);
    record.followUpCount = decrypted.followUps.length;
    record.updatedAt = nowIso;
    record.integritySha256 = computeIntegrityDigest(record.caseId, record.createdAt, record.envelope.ciphertext);
    this.save();

    return {
      dossier: {
        caseId: record.caseId,
        category: record.category,
        severity: record.severity,
        region: record.region,
        status: record.status,
        encryption: 'AES-256-GCM' as const,
        integritySha256: record.integritySha256,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        followUpCount: record.followUpCount,
        ...decrypted
      },
      piiScrubbedCount: scrub.scrubbedCount
    };
  }
}

export async function runConfidentialIntakeTurn(params: {
  messages: ConfidentialChatMessage[];
  redactPii: boolean;
}): Promise<ConfidentialChatTurnResult> {
  const warnings: string[] = [];
  let totalScrubbed = 0;

  const sanitizedMessages = params.messages.slice(-16).map((msg) => {
    const rawText = String(msg.text || '').trim();
    if (msg.role === 'user' && params.redactPii) {
      const scrubbed = scrubSensitiveIdentifiers(rawText);
      totalScrubbed += scrubbed.scrubbedCount;
      for (const w of scrubbed.warnings) {
        if (!warnings.includes(w)) warnings.push(w);
      }
      return { role: 'user' as const, text: scrubbed.cleaned };
    }
    return { role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const), text: rawText };
  });

  const userTurns = sanitizedMessages.filter((m) => m.role === 'user');
  const combinedUserText = userTurns.map((m) => m.text).join('\n');
  const heuristicCategory = normalizeCategory('', combinedUserText);
  const heuristicSeverity = normalizeSeverity('', combinedUserText);
  const heuristicRegion = normalizeRegion('', combinedUserText);

  const ai = getGeminiClient();
  if (ai) {
    try {
      const transcriptFormatted = sanitizedMessages
        .map((m) => `${m.role === 'user' ? 'SOURCE' : 'INTAKE_BOT'}: ${m.text}`)
        .join('\n\n');

      const prompt = [
        `Review this confidential whistleblower / high-profile case intake conversation and write the next concise response to the anonymous follower.`,
        `Conversation so far:`,
        transcriptFormatted,
        ``,
        `Return ONLY a single JSON object (no markdown outside JSON) with keys:`,
        `reply (string: calm, supportive, strictly confidential investigative intake officer reply in 2-4 crisp sentences; remind them never to reveal their own identity; ask for whichever critical detail is still missing among: exact actors/entities, timeline & country/jurisdiction, corroborating evidence types held, or retaliation/safety concerns; if enough detail has been shared, invite them to click "Seal & Submit Confidential Report"),`,
        `detectedCategory (one of: ${CONFIDENTIAL_CASE_CATEGORIES.join(', ')}),`,
        `detectedSeverity (one of: ${CONFIDENTIAL_SEVERITIES.join(', ')}),`,
        `detectedRegion (one of: ${CONFIDENTIAL_REGIONS.join(', ')}),`,
        `readinessScore (integer 20 to 100 indicating how ready the briefing is for investigative desk sealing),`,
        `readyToSeal (boolean: true when core who/what/where/evidence facts are present),`,
        `suggestedTitle (short non-identifying working label under 8 words, e.g. "Municipal Infrastructure Kickback Allegation"),`,
        `suggestedEntities (short comma-separated list of named organizations/offices/officials mentioned by the source, WITHOUT naming the tipster),`,
        `suggestedEvidence (short summary of documents, recordings, or records the source mentioned having).`
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          systemInstruction:
            'You are the Confidential Source Intake Officer for News Hub 24+ (newshub24plus.com). Your top priority is protecting whistleblower anonymity while gathering clear, verifiable journalistic facts on high-profile cases. Never ask for the tipster name, email, phone, or IP. Warn the tipster if their message hints at their personal identity or workplace email.'
        }
      });

      const parsed = JSON.parse(extractJsonText(response.text ?? '{}')) as Record<string, unknown>;
      const scoreNum = Number(parsed.readinessScore);
      const readinessScore = Number.isFinite(scoreNum)
        ? Math.min(100, Math.max(20, Math.round(scoreNum)))
        : Math.min(95, 30 + userTurns.length * 22);

      return {
        reply:
          typeof parsed.reply === 'string' && parsed.reply.trim().length > 10
            ? parsed.reply.trim()
            : 'Thank you — this briefing is protected with zero-identity handling. Please add any specific dates, organizations involved, or document types you can safely describe (without sharing your own name or contact info), or click Seal & Submit Confidential Report when ready.',
        mode: 'gemini-ai',
        detectedCategory: normalizeCategory(parsed.detectedCategory, combinedUserText),
        detectedSeverity: normalizeSeverity(parsed.detectedSeverity, combinedUserText),
        detectedRegion: normalizeRegion(parsed.detectedRegion, combinedUserText),
        readinessScore,
        readyToSeal: Boolean(parsed.readyToSeal) || readinessScore >= 75,
        suggestedTitle:
          typeof parsed.suggestedTitle === 'string' && parsed.suggestedTitle.trim()
            ? parsed.suggestedTitle.trim().slice(0, 80)
            : `${heuristicCategory} Briefing`,
        suggestedEntities:
          typeof parsed.suggestedEntities === 'string' && parsed.suggestedEntities.trim()
            ? parsed.suggestedEntities.trim().slice(0, 160)
            : '',
        suggestedEvidence:
          typeof parsed.suggestedEvidence === 'string' && parsed.suggestedEvidence.trim()
            ? parsed.suggestedEvidence.trim().slice(0, 160)
            : '',
        piiScrubbedCount: totalScrubbed,
        warnings
      };
    } catch {
      // Fall back smoothly to deterministic encrypted intake protocol if upstream Gemini errors
      warnings.push('Live AI triage temporarily unavailable; using standard encrypted intake protocol.');
    }
  }

  // Deterministic confidential intake protocol (used when GEMINI_API_KEY is unset or unavailable)
  const wordCount = combinedUserText.split(/\s+/).filter(Boolean).length;
  const hasTimelineOrPlace = /\b(20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|month|week|yesterday|today|europe|asia|london|brussels|tokyo|washington|court|ministry)\b/i.test(
    combinedUserText
  );
  const hasEvidenceMention = /\b(pdf|document|email|ledger|contract|audio|video|photo|invoice|memo|filing|spreadsheet|record|witness|receipt)\b/i.test(
    combinedUserText
  );

  let reply: string;
  let readinessScore = 30;

  if (userTurns.length <= 1 && wordCount < 18) {
    readinessScore = 40;
    reply =
      `Protected channel active (${heuristicCategory} · ${heuristicRegion}). Do NOT share your name, personal email, or phone number. Next, describe what happened, the organization or public figures involved, and the approximate dates or location.`;
  } else if (!hasEvidenceMention && userTurns.length < 3) {
    readinessScore = 68;
    reply =
      `Logged under ${heuristicCategory} (${heuristicSeverity} priority). What types of supporting records exist (for example: internal memos, financial ledgers, contracts, or recordings — keep raw metadata private), and are there any personal safety or retaliation risks we should flag?`;
  } else if (!hasTimelineOrPlace && userTurns.length < 3) {
    readinessScore = 72;
    reply =
      `Thank you — key details are captured. If safe to share, add the relevant country, agency, or timeframe so our investigative desk can verify context, or click "Seal & Submit Confidential Report" below to encrypt your dossier with AES-256-GCM.`;
  } else {
    readinessScore = Math.min(96, 75 + Math.min(20, Math.floor(wordCount / 15)));
    reply =
      `Your confidential briefing looks complete for ${heuristicCategory} (${heuristicSeverity} · ${heuristicRegion}). Click "Seal & Submit Confidential Report" below to encrypt the record with AES-256-GCM and receive your one-time anonymous Case ID and secret passkey.`;
  }

  return {
    reply,
    mode: 'standard-protocol',
    detectedCategory: heuristicCategory,
    detectedSeverity: heuristicSeverity,
    detectedRegion: heuristicRegion,
    readinessScore,
    readyToSeal: readinessScore >= 70 || wordCount >= 22,
    suggestedTitle: `${heuristicCategory} Tip`,
    suggestedEntities: '',
    suggestedEvidence: hasEvidenceMention ? 'Documents or records referenced in chat' : '',
    piiScrubbedCount: totalScrubbed,
    warnings
  };
}
