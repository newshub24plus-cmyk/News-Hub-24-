import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileLock2,
  KeyRound,
  Lock,
  MessageSquareLock,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface ConfidentialPublicRecord {
  caseId: string;
  category: string;
  severity: 'Critical' | 'High' | 'Elevated' | 'Standard';
  region: string;
  status: string;
  redactedTopicTag: string;
  createdAt: string;
  updatedAt: string;
  followUpCount: number;
  encryption: 'AES-256-GCM';
}

interface VaultStatusResponse {
  aiGuided: boolean;
  model: string;
  encryption: 'AES-256-GCM';
  zeroIdentityLogging: boolean;
  categories: string[];
  severities: Array<'Critical' | 'High' | 'Elevated' | 'Standard'>;
  regions: string[];
  stats: {
    totalSealed: number;
    criticalCount: number;
    highCount: number;
  };
  publicAuditLog: ConfidentialPublicRecord[];
}

interface SealedReceipt {
  caseId: string;
  passkey: string;
  category: string;
  severity: string;
  region: string;
  status: string;
  encryption: 'AES-256-GCM';
  integritySha256: string;
  createdAt: string;
  redactedTopicTag: string;
  piiScrubbedCount: number;
}

interface UnlockedDossier {
  caseId: string;
  category: string;
  severity: string;
  region: string;
  status: string;
  encryption: 'AES-256-GCM';
  integritySha256: string;
  createdAt: string;
  updatedAt: string;
  followUpCount: number;
  narrative: string;
  involvedEntities: string;
  evidenceTypes: string;
  safetyNotes: string;
  transcript: Array<{ role: 'user' | 'assistant'; text: string; timestamp?: string }>;
  followUps: Array<{ id: string; sender: 'tipster' | 'desk'; message: string; createdAt: string }>;
}

interface ConfidentialTipBotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_STARTERS = [
  {
    label: 'Public Official Corruption',
    prompt:
      'I have confidential information regarding bribery and undisclosed procurement kickbacks involving senior public officials.'
  },
  {
    label: 'Corporate / Financial Fraud',
    prompt:
      'I am reporting concealed offshore transfers and falsified financial audit records at a major corporation.'
  },
  {
    label: 'High-Profile Executive Case',
    prompt:
      'I need to safely report serious misconduct and cover-up efforts involving a high-profile public figure or executive.'
  },
  {
    label: 'Safety & Human Rights Cover-Up',
    prompt:
      'I have documented evidence of a public safety cover-up or human rights violation where whistleblowers face retaliation.'
  }
];

function buildInitialGreeting(): ChatMessage {
  return {
    id: 'msg-welcome',
    role: 'assistant',
    text: 'Welcome to the News Hub 24+ Confidential Tip Desk. No account, name, email, or IP address is logged here. Share the high-profile case details you want investigated — avoid entering your own name or personal phone/email — and I will help classify, scrub, and seal your dossier with AES-256-GCM encryption.',
    timestamp: new Date().toISOString()
  };
}

function scrubPreviewClientPii(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED-EMAIL]')
    .replace(/\b(?:\d{3}-\d{2}-\d{4})\b/g, '[REDACTED-ID]')
    .replace(/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, '[REDACTED-IP]');
}

export function ConfidentialTipBotModal({ isOpen, onClose }: ConfidentialTipBotModalProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'checkin' | 'protocol'>('chat');
  const [vaultStatus, setVaultStatus] = useState<VaultStatusResponse | null>(null);

  // Chatbot session state (ephemeral, never written to localStorage)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildInitialGreeting()]);
  const [inputText, setInputText] = useState('');
  const [redactPii, setRedactPii] = useState(true);
  const [sendingTurn, setSendingTurn] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [botMode, setBotMode] = useState<'gemini-ai' | 'standard-protocol' | null>(null);

  // Triage & seal dossier state
  const [category, setCategory] = useState('Public Corruption & Bribery');
  const [severity, setSeverity] = useState<'Critical' | 'High' | 'Elevated' | 'Standard'>('High');
  const [region, setRegion] = useState('Global / Cross-Border');
  const [readinessScore, setReadinessScore] = useState(20);
  const [showSealDrawer, setShowSealDrawer] = useState(false);
  const [narrativeDraft, setNarrativeDraft] = useState('');
  const [involvedEntities, setInvolvedEntities] = useState('');
  const [evidenceTypes, setEvidenceTypes] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [sealing, setSealing] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SealedReceipt | null>(null);
  const [copiedPasskey, setCopiedPasskey] = useState(false);

  // Anonymous Case Check-In state
  const [lookupCaseId, setLookupCaseId] = useState('');
  const [lookupPasskey, setLookupPasskey] = useState('');
  const [showPasskeyInput, setShowPasskeyInput] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockedDossier, setUnlockedDossier] = useState<UnlockedDossier | null>(null);
  const [followUpText, setFollowUpText] = useState('');
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [followUpFeedback, setFollowUpFeedback] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/confidential-tips/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: VaultStatusResponse | null) => {
        if (data) setVaultStatus(data);
      })
      .catch(() => {
        // Non-fatal load error
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sendingTurn]);

  if (!isOpen) return null;

  const handleQuickWipe = () => {
    setMessages([buildInitialGreeting()]);
    setInputText('');
    setChatError(null);
    setWarnings([]);
    setBotMode(null);
    setReadinessScore(20);
    setShowSealDrawer(false);
    setNarrativeDraft('');
    setInvolvedEntities('');
    setEvidenceTypes('');
    setSafetyNotes('');
    setSealError(null);
    setReceipt(null);
    setLookupCaseId('');
    setLookupPasskey('');
    setUnlockedDossier(null);
    setUnlockError(null);
    setFollowUpText('');
    setFollowUpFeedback(null);
  };

  const sendChatMessage = async (rawMessage: string) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || sendingTurn) return;

    const clientCleaned = redactPii ? scrubPreviewClientPii(trimmed) : trimmed;
    const userMsg: ChatMessage = {
      id: `u-${Date.now().toString(36)}`,
      role: 'user',
      text: clientCleaned,
      timestamp: new Date().toISOString()
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputText('');
    setChatError(null);
    setSendingTurn(true);

    setNarrativeDraft((prev) => (prev ? `${prev}\n\n${clientCleaned}` : clientCleaned));

    try {
      const res = await fetch('/api/confidential-tips/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, text: m.text })),
          redactPii
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Unable to reach confidential intake assistant.');
      }

      setBotMode(payload.mode);
      setCategory(payload.detectedCategory);
      setSeverity(payload.detectedSeverity);
      setRegion(payload.detectedRegion);
      setReadinessScore(payload.readinessScore);
      if (Array.isArray(payload.warnings) && payload.warnings.length > 0) {
        setWarnings(payload.warnings);
      }
      if (payload.suggestedEntities && !involvedEntities) {
        setInvolvedEntities(payload.suggestedEntities);
      }
      if (payload.suggestedEvidence && !evidenceTypes) {
        setEvidenceTypes(payload.suggestedEvidence);
      }
      if (payload.readyToSeal) {
        setShowSealDrawer(true);
      }

      const botMsg: ChatMessage = {
        id: `a-${Date.now().toString(36)}`,
        role: 'assistant',
        text: payload.reply,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : 'Confidential intake connection failed.');
    } finally {
      setSendingTurn(false);
    }
  };

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendChatMessage(inputText);
  };

  const handleSealSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSealError(null);

    const combinedNarrative =
      narrativeDraft.trim() ||
      messages
        .filter((m) => m.role === 'user')
        .map((m) => m.text)
        .join('\n\n')
        .trim();

    if (combinedNarrative.length < 20) {
      setSealError('Please describe the high-profile case details (at least 20 characters) before sealing.');
      return;
    }

    setSealing(true);
    try {
      const res = await fetch('/api/confidential-tips/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          severity,
          region,
          narrative: redactPii ? scrubPreviewClientPii(combinedNarrative) : combinedNarrative,
          involvedEntities: involvedEntities.trim(),
          evidenceTypes: evidenceTypes.trim(),
          safetyNotes: safetyNotes.trim(),
          transcript: messages.map((m) => ({
            role: m.role,
            text: m.text,
            timestamp: m.timestamp
          })),
          redactPii
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not seal confidential report.');
      }

      setReceipt(payload.receipt as SealedReceipt);
      if (payload.vaultStatus) {
        setVaultStatus(payload.vaultStatus as VaultStatusResponse);
      }
      setLookupCaseId(payload.receipt.caseId);
      setLookupPasskey(payload.receipt.passkey);
    } catch (err: unknown) {
      setSealError(err instanceof Error ? err.message : 'Failed to encrypt confidential report.');
    } finally {
      setSealing(false);
    }
  };

  const handleCopyPasskey = async () => {
    if (!receipt) return;
    try {
      await navigator.clipboard.writeText(
        `Case ID: ${receipt.caseId}\nSecret Passkey: ${receipt.passkey}\nSHA-256: ${receipt.integritySha256}`
      );
      setCopiedPasskey(true);
      window.setTimeout(() => setCopiedPasskey(false), 2500);
    } catch {
      setCopiedPasskey(false);
    }
  };

  const handleDownloadKeycard = () => {
    if (!receipt) return;
    const text = [
      'NEWS HUB 24+.COM — ANONYMOUS CONFIDENTIAL CASE KEYCARD',
      '=======================================================',
      `Case ID        : ${receipt.caseId}`,
      `Secret Passkey : ${receipt.passkey}`,
      `Category       : ${receipt.category}`,
      `Severity       : ${receipt.severity}`,
      `Region         : ${receipt.region}`,
      `Encryption     : ${receipt.encryption} (Zero-Identity Logging)`,
      `SHA-256 Digest : ${receipt.integritySha256}`,
      `Sealed At      : ${receipt.createdAt}`,
      '',
      'KEEP THIS PASSKEY PRIVATE. It is shown only once and cannot be recovered by News Hub 24+ staff.',
      'Use Case ID + Secret Passkey in "Anonymous Case Check-In" to check status or add follow-up evidence.'
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${receipt.caseId}-CONFIDENTIAL-KEYCARD.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleUnlockCase = async (e: FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    setFollowUpFeedback(null);
    if (!lookupCaseId.trim() || !lookupPasskey.trim()) {
      setUnlockError('Enter both your Case ID and Secret Passkey.');
      return;
    }

    setUnlocking(true);
    try {
      const res = await fetch('/api/confidential-tips/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: lookupCaseId.trim(),
          passkey: lookupPasskey.trim()
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not unlock sealed dossier.');
      }
      setUnlockedDossier(payload.dossier as UnlockedDossier);
    } catch (err: unknown) {
      setUnlockedDossier(null);
      setUnlockError(err instanceof Error ? err.message : 'Decryption failed.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleAppendFollowUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!unlockedDossier || followUpText.trim().length < 5) return;
    setSendingFollowUp(true);
    setFollowUpFeedback(null);
    setUnlockError(null);

    try {
      const res = await fetch('/api/confidential-tips/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: unlockedDossier.caseId,
          passkey: lookupPasskey.trim(),
          message: redactPii ? scrubPreviewClientPii(followUpText.trim()) : followUpText.trim(),
          redactPii
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to append follow-up.');
      }
      setUnlockedDossier(payload.dossier as UnlockedDossier);
      setFollowUpText('');
      setFollowUpFeedback(payload.message as string);
    } catch (err: unknown) {
      setUnlockError(err instanceof Error ? err.message : 'Unable to save follow-up.');
    } finally {
      setSendingFollowUp(false);
    }
  };

  const severityBadgeClass = (sev: string) => {
    switch (sev) {
      case 'Critical':
        return 'bg-[#991B1B] text-white border-[#991B1B] dark:bg-[#DC2626] dark:border-[#DC2626]';
      case 'High':
        return 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] dark:bg-[#2A1515] dark:text-[#FCA5A5] dark:border-[#7F1D1D]';
      default:
        return 'bg-[#F5F2EB] text-[#141413] border-[#D6D1C7] dark:bg-[#242320] dark:text-[#F5F3EE] dark:border-[#3A3732]';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confidential-bot-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#FBF9F5] dark:bg-[#141413] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Security Masthead */}
        <div className="px-5 sm:px-6 py-4 bg-[#141413] text-[#FBF9F5] border-b border-[#2C2A26] flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono text-[#FCA5A5] flex items-center gap-1.5 mb-0.5">
              <Lock className="w-3.5 h-3.5" />
              <span>ZERO-IDENTITY WHISTLEBLOWER DESK · AES-256-GCM ENCRYPTED</span>
            </p>
            <h2 id="confidential-bot-title" className="font-serif text-xl sm:text-2xl font-bold text-white">
              Anonymous Confidential Case Bot
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickWipe}
              title="Immediately clear all messages and receipts from screen"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#FCA5A5] bg-[#2A1515] hover:bg-[#451A1A] border border-[#7F1D1D] rounded-md transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Quick Wipe Screen</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close confidential tip bot"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#242320] text-[#D6D3CD] hover:text-white border border-[#3A3732]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 sm:px-6 py-2.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Confidential Tip Desk Sections">
            {[
              { id: 'chat', label: 'Confidential Tip Chatbot', icon: MessageSquareLock },
              { id: 'checkin', label: 'Anonymous Case Check-In', icon: KeyRound },
              { id: 'protocol', label: 'Vault & Confidentiality Log', icon: ShieldCheck }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#141413] text-white dark:bg-[#F5F3EE] dark:text-[#141413]'
                      : 'text-[#44403C] dark:text-[#D6D3CD] hover:bg-white dark:hover:bg-[#242320]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
            <span>
              {botMode === 'gemini-ai' || vaultStatus?.aiGuided
                ? 'AI Triage Active (No Logs)'
                : 'Encrypted Protocol Active'}
            </span>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* TAB 1: ANONYMOUS CHATBOT */}
          {activeTab === 'chat' && (
            <>
              {/* Confidentiality & PII Protection Bar */}
              <div className="p-3.5 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-[#991B1B] dark:text-[#F87171] shrink-0 mt-0.5" />
                  <p className="text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
                    <strong className="text-[#141413] dark:text-[#F5F3EE]">Strictly Confidential:</strong> Do not type your own name, personal email, or phone number. Reports are never stored in browser storage and are sealed with one-time passkey encryption.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 font-medium text-[#141413] dark:text-[#F5F3EE] shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={redactPii}
                    onChange={(e) => setRedactPii(e.target.checked)}
                    className="rounded border-[#D6D1C7] text-[#991B1B] focus:ring-[#991B1B]"
                  />
                  <span>Auto-Scrub PII (Emails/Phones/IPs)</span>
                </label>
              </div>

              {/* Sealed Receipt View (after submission) */}
              {receipt ? (
                <div className="p-6 bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#86EFAC] dark:border-[#166534] rounded-lg space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-[#14532D] dark:text-[#4ADE80] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-mono font-semibold text-[#14532D] dark:text-[#4ADE80]">
                          AES-256-GCM CONFIDENTIAL SEAL CONFIRMED
                        </p>
                        <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE] mt-0.5">
                          High-Profile Case Dossier Sealed: {receipt.caseId}
                        </h3>
                        <p className="text-xs text-[#292524] dark:text-[#D6D3CD] mt-1">
                          Save your one-time Secret Passkey below. It is displayed only once and is NOT stored anywhere on our servers.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white dark:bg-[#141413] border border-[#BBF7D0] dark:border-[#166534] rounded-md">
                    <div>
                      <span className="block text-[11px] text-[#57534E] dark:text-[#A8A29E] font-medium">
                        Anonymous Case ID
                      </span>
                      <span className="font-mono text-base font-bold text-[#141413] dark:text-[#F5F3EE] select-all">
                        {receipt.caseId}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-[#57534E] dark:text-[#A8A29E] font-medium">
                        One-Time Secret Passkey (Save Securely)
                      </span>
                      <span className="font-mono text-base font-bold text-[#991B1B] dark:text-[#FCA5A5] select-all">
                        {receipt.passkey}
                      </span>
                    </div>
                    <div className="sm:col-span-2 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26] text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E] break-all">
                      SHA-256 Seal Digest: {receipt.integritySha256}
                      {receipt.piiScrubbedCount > 0 && ` · ${receipt.piiScrubbedCount} PII item(s) scrubbed`}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleCopyPasskey}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:opacity-90 transition-opacity"
                    >
                      {copiedPasskey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPasskey ? 'Credentials Copied' : 'Copy Case ID & Passkey'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadKeycard}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:bg-[#F5F2EB] dark:hover:bg-[#242320] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Offline Keycard (.txt)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('checkin')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] bg-white dark:bg-[#1C1B19] border border-[#86EFAC] dark:border-[#166534] rounded-md hover:bg-[#F0FDF4] dark:hover:bg-[#14331E] transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Open in Case Check-In</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickWipe}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5] hover:underline ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Wipe Receipt From Screen</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Triage Telemetry Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                      <span className="block text-[11px] text-[#57534E] dark:text-[#A8A29E]">Detected Category</span>
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate block">{category}</span>
                    </div>
                    <div className="p-2.5 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                      <span className="block text-[11px] text-[#57534E] dark:text-[#A8A29E]">Priority Level</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 text-[11px] font-semibold border rounded-sm ${severityBadgeClass(severity)}`}>
                        {severity}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                      <span className="block text-[11px] text-[#57534E] dark:text-[#A8A29E]">Region / Desk</span>
                      <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate block">{region}</span>
                    </div>
                    <div className="p-2.5 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                      <div className="flex items-center justify-between text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                        <span>Dossier Readiness</span>
                        <span className="font-mono font-bold text-[#141413] dark:text-[#F5F3EE]">{readinessScore}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full bg-[#E5E2DC] dark:bg-[#2C2A26] rounded-full overflow-hidden">
                        <svg
                          className="block w-full h-full"
                          viewBox="0 0 100 4"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <rect
                            x="0"
                            y="0"
                            width={readinessScore}
                            height="4"
                            className="fill-[#991B1B] dark:fill-[#DC2626] transition-all duration-300"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Quick Case Starters */}
                  {messages.length <= 1 && (
                    <div>
                      <p className="text-[11px] font-semibold text-[#57534E] dark:text-[#A8A29E] mb-2">
                        Quick-Start High-Profile Case Topics:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_STARTERS.map((starter) => (
                          <button
                            key={starter.label}
                            type="button"
                            onClick={() => void sendChatMessage(starter.prompt)}
                            className="px-3 py-1.5 text-xs font-medium text-[#141413] dark:text-[#F5F3EE] bg-white dark:bg-[#1C1B19] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md hover:border-[#991B1B] dark:hover:border-[#F87171] transition-colors"
                          >
                            {starter.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chat Message Feed */}
                  <div className="h-64 sm:h-72 overflow-y-auto p-4 bg-white dark:bg-[#10100F] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-md space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 rounded-md text-xs sm:text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-[#141413] text-[#FBF9F5] dark:bg-[#F5F3EE] dark:text-[#141413]'
                              : 'bg-[#F5F2EB] text-[#141413] dark:bg-[#1C1B19] dark:text-[#F5F3EE] border border-[#E5E2DC] dark:border-[#2E2C28]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono opacity-75">
                            <span>{msg.role === 'user' ? 'ANONYMOUS SOURCE (MASKED)' : 'NH24+ CONFIDENTIAL BOT'}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      </div>
                    ))}
                    {sendingTurn && (
                      <div className="flex justify-start">
                        <div className="px-3.5 py-2.5 rounded-md text-xs bg-[#F5F2EB] dark:bg-[#1C1B19] border border-[#E5E2DC] dark:border-[#2E2C28] text-[#57534E] dark:text-[#A8A29E] font-mono">
                          Reviewing briefing &amp; checking for identifying metadata…
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {warnings.length > 0 && (
                    <div
                      role="status"
                      className="p-3 bg-[#FFFBEB] dark:bg-[#271F0E] border border-[#FDE68A] dark:border-[#78350F] rounded-md text-xs text-[#92400E] dark:text-[#FCD34D] flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>{warnings.join(' ')}</div>
                    </div>
                  )}

                  {chatError && (
                    <p role="alert" className="text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5]">
                      {chatError}
                    </p>
                  )}

                  {/* Chat Composer + Toggle Seal Form */}
                  <form onSubmit={handleChatSubmit} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Describe the case, actors, timeline, or evidence anonymously…"
                      aria-label="Confidential tip message"
                      className="flex-1 px-3.5 py-2.5 text-sm bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE] placeholder:text-[#78716C] focus:outline-none focus:border-[#141413] dark:focus:border-[#F5F3EE]"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="submit"
                        disabled={sendingTurn || !inputText.trim()}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSealDrawer((prev) => !prev)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors whitespace-nowrap"
                      >
                        <FileLock2 className="w-3.5 h-3.5" />
                        <span>{showSealDrawer ? 'Hide Seal Form' : 'Seal & Submit Report'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Finalize & AES-256-GCM Seal Dossier Form */}
                  {showSealDrawer && (
                    <form
                      onSubmit={handleSealSubmit}
                      className="p-4 sm:p-5 bg-white dark:bg-[#171715] border-2 border-[#991B1B]/40 dark:border-[#DC2626]/40 rounded-md space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                        <div>
                          <h3 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                            Seal &amp; Encrypt Confidential Case Dossier
                          </h3>
                          <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                            Review extracted classification and narrative before generating your one-time passkey.
                          </p>
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-[#14532D] dark:text-[#4ADE80]">
                          AES-256-GCM Ready
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="seal-category" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                            Case Category
                          </label>
                          <select
                            id="seal-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                          >
                            {(vaultStatus?.categories ?? [
                              'Public Corruption & Bribery',
                              'Corporate & Financial Fraud',
                              'High-Profile Executive / Public Figure Case',
                              'Human Rights & Conflict Reporting',
                              'Judicial & Law Enforcement Misconduct',
                              'Cybersecurity & Data Breach',
                              'Environment & Safety Cover-Up',
                              'Press Freedom & Whistleblower Threats',
                              'Other High-Profile Case'
                            ]).map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="seal-severity" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                            Urgency / Severity
                          </label>
                          <select
                            id="seal-severity"
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value as typeof severity)}
                            className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                          >
                            {['Critical', 'High', 'Elevated', 'Standard'].map((sev) => (
                              <option key={sev} value={sev}>
                                {sev}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="seal-region" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                            Region / Jurisdiction
                          </label>
                          <select
                            id="seal-region"
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                          >
                            {(vaultStatus?.regions ?? [
                              'Global / Cross-Border',
                              'Europe',
                              'Asia-Pacific',
                              'Americas',
                              'Africa & Middle East'
                            ]).map((reg) => (
                              <option key={reg} value={reg}>
                                {reg}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="seal-narrative" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                          Confidential Case Summary &amp; Facts (Do NOT include your own identity)
                        </label>
                        <textarea
                          id="seal-narrative"
                          rows={3}
                          value={narrativeDraft}
                          onChange={(e) => setNarrativeDraft(e.target.value)}
                          placeholder="Full summary of events, timeline, and verifiable facts..."
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="seal-entities" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                            Entities / Officials Named
                          </label>
                          <input
                            id="seal-entities"
                            type="text"
                            value={involvedEntities}
                            onChange={(e) => setInvolvedEntities(e.target.value)}
                            placeholder="Agency, firm, or public office"
                            className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                          />
                        </div>
                        <div>
                          <label htmlFor="seal-evidence" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                            Evidence Held (Types Only)
                          </label>
                          <input
                            id="seal-evidence"
                            type="text"
                            value={evidenceTypes}
                            onChange={(e) => setEvidenceTypes(e.target.value)}
                            placeholder="e.g. Contracts, Ledgers, Audio"
                            className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                          />
                        </div>
                        <div>
                          <label htmlFor="seal-safety" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                            Safety / Embargo Notes
                          </label>
                          <input
                            id="seal-safety"
                            type="text"
                            value={safetyNotes}
                            onChange={(e) => setSafetyNotes(e.target.value)}
                            placeholder="e.g. Delay naming department"
                            className="w-full px-2.5 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                          />
                        </div>
                      </div>

                      {sealError && (
                        <p role="alert" className="text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5]">
                          {sealError}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="submit"
                          disabled={sealing}
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-60 transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>{sealing ? 'Encrypting with AES-256-GCM…' : 'Encrypt & Seal Confidential Report'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </>
          )}

          {/* TAB 2: ANONYMOUS CASE CHECK-IN & FOLLOW-UP */}
          {activeTab === 'checkin' && (
            <div className="space-y-5">
              <div className="p-4 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md">
                <h3 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE] mb-1">
                  Unlock Your Sealed Confidential Dossier
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mb-4">
                  Enter the anonymous Case ID and one-time Secret Passkey issued when you sealed your report to verify receipt or add protected follow-up facts.
                </p>

                <form onSubmit={handleUnlockCase} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label htmlFor="unlock-case-id" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Anonymous Case ID
                    </label>
                    <input
                      id="unlock-case-id"
                      type="text"
                      value={lookupCaseId}
                      onChange={(e) => setLookupCaseId(e.target.value)}
                      placeholder="NH24-ANON-XXXXXX"
                      className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label htmlFor="unlock-passkey" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                      Secret Passkey
                    </label>
                    <div className="relative">
                      <input
                        id="unlock-passkey"
                        type={showPasskeyInput ? 'text' : 'password'}
                        value={lookupPasskey}
                        onChange={(e) => setLookupPasskey(e.target.value)}
                        placeholder="word-word-0000-word"
                        className="w-full pl-3 pr-9 py-2 text-xs font-mono bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasskeyInput((prev) => !prev)}
                        aria-label={showPasskeyInput ? 'Hide passkey' : 'Show passkey'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#57534E] dark:text-[#A8A29E]"
                      >
                        {showPasskeyInput ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={unlocking}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:opacity-90 disabled:opacity-60 transition-opacity"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{unlocking ? 'Decrypting…' : 'Unlock Dossier'}</span>
                    </button>
                  </div>
                </form>

                {unlockError && (
                  <p role="alert" className="mt-3 text-xs font-medium text-[#991B1B] dark:text-[#FCA5A5]">
                    {unlockError}
                  </p>
                )}
              </div>

              {unlockedDossier && (
                <div className="p-5 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                    <div>
                      <span className="font-mono text-xs text-[#14532D] dark:text-[#4ADE80] font-semibold">
                        DECRYPTED IN SESSION · {unlockedDossier.status}
                      </span>
                      <h4 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                        {unlockedDossier.caseId} — {unlockedDossier.category}
                      </h4>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold border rounded-sm ${severityBadgeClass(unlockedDossier.severity)}`}>
                      {unlockedDossier.severity} · {unlockedDossier.region}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-semibold text-[#57534E] dark:text-[#A8A29E] block mb-1">
                        Confidential Briefing Narrative
                      </span>
                      <p className="p-3 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md text-[#141413] dark:text-[#F5F3EE] whitespace-pre-wrap leading-relaxed">
                        {unlockedDossier.narrative}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                        <span className="font-semibold text-[#57534E] dark:text-[#A8A29E] block mb-0.5">Entities Named</span>
                        <span className="text-[#141413] dark:text-[#F5F3EE]">{unlockedDossier.involvedEntities}</span>
                      </div>
                      <div className="p-3 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                        <span className="font-semibold text-[#57534E] dark:text-[#A8A29E] block mb-0.5">Evidence Types</span>
                        <span className="text-[#141413] dark:text-[#F5F3EE]">{unlockedDossier.evidenceTypes}</span>
                      </div>
                      <div className="p-3 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md">
                        <span className="font-semibold text-[#57534E] dark:text-[#A8A29E] block mb-0.5">Safety Protocol</span>
                        <span className="text-[#141413] dark:text-[#F5F3EE]">{unlockedDossier.safetyNotes}</span>
                      </div>
                    </div>
                  </div>

                  {unlockedDossier.followUps.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                      <p className="text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                        Sealed Follow-Up Updates ({unlockedDossier.followUps.length})
                      </p>
                      <div className="space-y-2">
                        {unlockedDossier.followUps.map((fu) => (
                          <div
                            key={fu.id}
                            className="p-3 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md text-xs"
                          >
                            <div className="flex items-center justify-between text-[11px] font-mono text-[#57534E] dark:text-[#A8A29E] mb-1">
                              <span>{fu.id} · SOURCE UPDATE</span>
                              <span>{new Date(fu.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-[#141413] dark:text-[#F5F3EE] whitespace-pre-wrap">{fu.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleAppendFollowUp} className="pt-3 border-t border-[#E5E2DC] dark:border-[#2C2A26] space-y-2.5">
                    <label htmlFor="followup-input" className="block text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                      Add Anonymous Follow-Up Fact or Evidence Note
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="followup-input"
                        type="text"
                        value={followUpText}
                        onChange={(e) => setFollowUpText(e.target.value)}
                        placeholder="Add new dates, document references, or clarifications…"
                        className="flex-1 px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                      />
                      <button
                        type="submit"
                        disabled={sendingFollowUp || followUpText.trim().length < 5}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] rounded-md disabled:opacity-50 whitespace-nowrap"
                      >
                        {sendingFollowUp ? 'Re-Sealing…' : 'Append & Re-Seal'}
                      </button>
                    </div>
                    {followUpFeedback && (
                      <p role="status" className="text-xs font-medium text-[#14532D] dark:text-[#4ADE80]">
                        {followUpFeedback}
                      </p>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VAULT TRANSPARENCY & PROTOCOL */}
          {activeTab === 'protocol' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md">
                  <span className="text-[#57534E] dark:text-[#A8A29E] block">Sealed High-Profile Cases</span>
                  <span className="font-serif text-2xl font-bold text-[#141413] dark:text-[#F5F3EE] tabular-nums">
                    {vaultStatus?.stats.totalSealed ?? 0}
                  </span>
                </div>
                <div className="p-4 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md">
                  <span className="text-[#57534E] dark:text-[#A8A29E] block">Critical / High Priority</span>
                  <span className="font-serif text-2xl font-bold text-[#991B1B] dark:text-[#FCA5A5] tabular-nums">
                    {(vaultStatus?.stats.criticalCount ?? 0) + (vaultStatus?.stats.highCount ?? 0)}
                  </span>
                </div>
                <div className="p-4 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md">
                  <span className="text-[#57534E] dark:text-[#A8A29E] block">Cryptographic Standard</span>
                  <span className="font-mono text-base font-bold text-[#14532D] dark:text-[#4ADE80] block mt-1">
                    AES-256-GCM + scrypt
                  </span>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md space-y-2 text-xs">
                <h3 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                  How News Hub 24+ Protects Confidential Sources
                </h3>
                <ul className="space-y-1.5 text-[#44403C] dark:text-[#D6D3CD] list-disc pl-5">
                  <li>
                    <strong>Zero Identity Logging:</strong> Requests never record IP addresses, User-Agent headers, cookies, names, or email addresses.
                  </li>
                  <li>
                    <strong>Automatic PII Scrubbing:</strong> Emails, phone numbers, IPv4s, and ID strings are masked client-side and server-side before storage.
                  </li>
                  <li>
                    <strong>Authenticated AES-256-GCM Vault:</strong> Full narratives, entities, and transcripts are encrypted at rest using per-case scrypt keys derived from your one-time Secret Passkey.
                  </li>
                  <li>
                    <strong>No-Store HTTP Headers:</strong> All confidential tip routes return <span className="font-mono">Cache-Control: no-store</span>.
                  </li>
                </ul>
              </div>

              <div className="bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] text-xs font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  Redacted Vault Transparency Log (No Confidential Content Shown)
                </div>
                {!vaultStatus || vaultStatus.publicAuditLog.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#57534E] dark:text-[#A8A29E]">
                    No sealed tips logged yet. Submitted reports appear here strictly as redacted Case IDs and severity tags.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                    {vaultStatus.publicAuditLog.map((item) => (
                      <div key={item.caseId} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-mono font-bold text-[#141413] dark:text-[#F5F3EE] mr-2">
                            {item.caseId}
                          </span>
                          <span className="text-[#44403C] dark:text-[#D6D3CD]">{item.redactedTopicTag}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className={`px-2 py-0.5 border rounded-sm ${severityBadgeClass(item.severity)}`}>
                            {item.severity}
                          </span>
                          <span className="text-[#14532D] dark:text-[#4ADE80]">{item.encryption} Sealed</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
