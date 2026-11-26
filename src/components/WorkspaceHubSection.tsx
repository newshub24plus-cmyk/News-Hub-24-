import {
  AlertTriangle,
  ExternalLink,
  FilePlus2,
  Inbox,
  LogOut,
  Mail,
  NotebookPen,
  Plus,
  Presentation,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import type { NewsArticle } from '../data/newsData';
import {
  appendEditorialSlide,
  clearWorkspaceAccessToken,
  createGooglePresentation,
  getGooglePresentation,
  getWorkspaceAccessToken,
  initWorkspaceAuth,
  listGmailMessages,
  sendGmailMessage,
  workspaceGoogleSignIn,
  workspaceLogout,
  type GmailMessageSummary,
  type GoogleSlidesPresentationSummary
} from '../lib/workspaceAuth';

export interface WorkspaceEditorialNote {
  id: string;
  title: string;
  body: string;
  tag: string;
  articleTitle?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceHubSectionProps {
  articles: NewsArticle[];
  availableUsd: number;
  totalWatchHours: number;
  totalClicks: number;
}

type ConfirmActionState =
  | {
      kind: 'gmail_send';
      title: string;
      description: string;
      details: string[];
      confirmLabel: string;
      payload: { to: string; subject: string; body: string };
    }
  | {
      kind: 'slides_create';
      title: string;
      description: string;
      details: string[];
      confirmLabel: string;
      payload: { deckTitle: string };
    }
  | {
      kind: 'slides_append';
      title: string;
      description: string;
      details: string[];
      confirmLabel: string;
      payload: { presentationId: string; heading: string; body: string };
    }
  | {
      kind: 'note_delete';
      title: string;
      description: string;
      details: string[];
      confirmLabel: string;
      payload: { noteId: string };
    };

export function WorkspaceHubSection({
  articles,
  availableUsd,
  totalWatchHours,
  totalClicks
}: WorkspaceHubSectionProps) {
  const [activeTab, setActiveTab] = useState<'gmail' | 'slides' | 'keep_notes'>('gmail');
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getWorkspaceAccessToken());
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getWorkspaceAccessToken());
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Gmail State
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [loadingInbox, setLoadingInbox] = useState<boolean>(false);
  const [composeTo, setComposeTo] = useState<string>('newshub24plus@gmail.com');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [gmailFeedback, setGmailFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Google Slides State
  const [newDeckTitle, setNewDeckTitle] = useState<string>('News Hub 24+ Executive Briefing');
  const [openDeckInput, setOpenDeckInput] = useState<string>('');
  const [activeDeck, setActiveDeck] = useState<GoogleSlidesPresentationSummary | null>(null);
  const [recentDecks, setRecentDecks] = useState<GoogleSlidesPresentationSummary[]>([]);
  const [slideHeading, setSlideHeading] = useState<string>('');
  const [slideBody, setSlideBody] = useState<string>('');
  const [loadingSlides, setLoadingSlides] = useState<boolean>(false);
  const [slidesFeedback, setSlidesFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Keep / Editorial Notes State
  const [notes, setNotes] = useState<WorkspaceEditorialNote[]>([]);
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteBody, setNoteBody] = useState<string>('');
  const [noteTag, setNoteTag] = useState<string>('Editorial Wire');
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [notesFeedback, setNotesFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mandatory Explicit Confirmation Modal State
  const [confirmState, setConfirmState] = useState<ConfirmActionState | null>(null);
  const [executingConfirm, setExecutingConfirm] = useState<boolean>(false);

  const loadEditorialNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const res = await fetch('/api/workspace/notes');
      if (res.ok) {
        const json = (await res.json()) as { notes?: WorkspaceEditorialNote[] };
        if (Array.isArray(json.notes)) {
          setNotes(json.notes);
        }
      }
    } catch {
      // Non-fatal background load
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  const fetchGmailInbox = useCallback(async (tokenOverride?: string | null) => {
    const token = tokenOverride ?? getWorkspaceAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setLoadingInbox(true);
    setGmailFeedback(null);
    try {
      const list = await listGmailMessages(token, 10);
      setMessages(list);
      if (list[0]) {
        setSelectedMessageId((prev) => prev || list[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not fetch Gmail messages.';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('expired')) {
        clearWorkspaceAccessToken();
        setAccessToken(null);
        setNeedsAuth(true);
      }
      setGmailFeedback({ type: 'error', text: msg });
    } finally {
      setLoadingInbox(false);
    }
  }, []);

  useEffect(() => {
    const unsub = initWorkspaceAuth(
      (signedInUser, token) => {
        setUser(signedInUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      (firebaseUser) => {
        setUser(firebaseUser);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    void loadEditorialNotes();
    return () => unsub();
  }, [loadEditorialNotes]);

  useEffect(() => {
    if (accessToken && activeTab === 'gmail' && messages.length === 0) {
      void fetchGmailInbox(accessToken);
    }
  }, [accessToken, activeTab, messages.length, fetchGmailInbox]);

  const handleWorkspaceSignIn = async () => {
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const result = await workspaceGoogleSignIn();
      setUser(result.user);
      setAccessToken(result.accessToken);
      setNeedsAuth(false);
      void fetchGmailInbox(result.accessToken);
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or blocked by popup settings.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleWorkspaceLogout = async () => {
    await workspaceLogout();
    setUser(null);
    setAccessToken(null);
    setMessages([]);
    setSelectedMessageId(null);
    setActiveDeck(null);
    setNeedsAuth(true);
  };

  const handlePrefillEmailFromArticle = (article: NewsArticle) => {
    setComposeSubject(`[News Hub 24+] ${article.title}`);
    setComposeBody(
      [
        `Editorial Dispatch · ${article.category} (${article.bureau})`,
        `${article.title}`,
        '',
        article.deck,
        '',
        `Author: ${article.author} · Est. ${article.readTime}`,
        `Verified Revenue Balance: $${availableUsd.toFixed(2)} USD (${totalWatchHours.toFixed(2)}h watch, ${totalClicks.toLocaleString()} clicks)`,
        '',
        'Sent via News Hub 24+ (newshub24plus.com)'
      ].join('\n')
    );
    setActiveTab('gmail');
  };

  const handlePrefillRevenueEmail = () => {
    setComposeTo(user?.email || 'newshub24plus@gmail.com');
    setComposeSubject(`News Hub 24+ Verified Revenue & Watch-Hours Summary`);
    setComposeBody(
      [
        'News Hub 24+ Creator Treasury Summary',
        '--------------------------------------',
        `Available Verified Balance: $${availableUsd.toFixed(2)} USD`,
        `Total Watch Time Tracked:   ${totalWatchHours.toFixed(2)} hours`,
        `Total Per-Clicks Tracked:   ${totalClicks.toLocaleString()} clicks`,
        `Default MoMo Rail:          MTN Mobile Money Ghana (0557711975)`,
        '',
        `Prepared at ${new Date().toISOString()}`
      ].join('\n')
    );
    setActiveTab('gmail');
  };

  const handlePrefillSlideFromArticle = (article: NewsArticle) => {
    setSlideHeading(`${article.category}: ${article.title}`);
    setSlideBody(
      [
        article.deck,
        '',
        `• Bureau: ${article.bureau} | Author: ${article.author}`,
        `• Reading Time: ${article.readTime} | Views: ${article.views.toLocaleString()}`,
        `• News Hub 24+ Treasury Balance: $${availableUsd.toFixed(2)} USD (${totalWatchHours.toFixed(2)}h watch)`
      ].join('\n')
    );
    setActiveTab('slides');
  };

  const handleOpenDeckSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = accessToken ?? getWorkspaceAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setSlidesFeedback(null);
    setLoadingSlides(true);
    try {
      const deck = await getGooglePresentation(token, openDeckInput);
      setActiveDeck(deck);
      setRecentDecks((prev) => [deck, ...prev.filter((d) => d.presentationId !== deck.presentationId)].slice(0, 6));
      setSlidesFeedback({ type: 'success', text: `Loaded presentation "${deck.title}" (${deck.slideCount} slides).` });
    } catch (err: unknown) {
      setSlidesFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not load Google Slides presentation.'
      });
    } finally {
      setLoadingSlides(false);
    }
  };

  const handleSaveNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteBody.trim()) {
      setNotesFeedback({ type: 'error', text: 'Enter both a note title and note content.' });
      return;
    }
    setSavingNote(true);
    setNotesFeedback(null);
    try {
      const res = await fetch('/api/workspace/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle.trim(),
          body: noteBody.trim(),
          tag: noteTag.trim() || 'Editorial Wire'
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save editorial note.');
      if (Array.isArray(json.notes)) {
        setNotes(json.notes);
      }
      setNoteTitle('');
      setNoteBody('');
      setNotesFeedback({ type: 'success', text: 'Saved note to your News Hub 24+ Editorial Vault.' });
    } catch (err: unknown) {
      setNotesFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save note.'
      });
    } finally {
      setSavingNote(false);
    }
  };

  const handleConfirmExecute = async () => {
    if (!confirmState) return;
    setExecutingConfirm(true);
    try {
      if (confirmState.kind === 'gmail_send') {
        const token = accessToken ?? getWorkspaceAccessToken();
        if (!token) throw new Error('Sign in with Google to send email via Gmail.');
        const sent = await sendGmailMessage(token, confirmState.payload);
        setGmailFeedback({
          type: 'success',
          text: `Email sent via Gmail to ${confirmState.payload.to} (Message ID: ${sent.id}).`
        });
        setComposeSubject('');
        setComposeBody('');
        void fetchGmailInbox(token);
      } else if (confirmState.kind === 'slides_create') {
        const token = accessToken ?? getWorkspaceAccessToken();
        if (!token) throw new Error('Sign in with Google to create a Google Slides deck.');
        const created = await createGooglePresentation(token, confirmState.payload.deckTitle);
        setActiveDeck(created);
        setRecentDecks((prev) => [created, ...prev.filter((d) => d.presentationId !== created.presentationId)].slice(0, 6));
        setSlidesFeedback({
          type: 'success',
          text: `Created Google Slides deck "${created.title}" (${created.presentationId}).`
        });
      } else if (confirmState.kind === 'slides_append') {
        const token = accessToken ?? getWorkspaceAccessToken();
        if (!token) throw new Error('Sign in with Google to add a slide.');
        const updated = await appendEditorialSlide(token, confirmState.payload);
        setActiveDeck(updated);
        setSlideHeading('');
        setSlideBody('');
        setSlidesFeedback({
          type: 'success',
          text: `Added slide to "${updated.title}" — now ${updated.slideCount} slides.`
        });
      } else if (confirmState.kind === 'note_delete') {
        const res = await fetch(`/api/workspace/notes/${encodeURIComponent(confirmState.payload.noteId)}`, {
          method: 'DELETE'
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not delete note.');
        if (Array.isArray(json.notes)) {
          setNotes(json.notes);
        }
        setNotesFeedback({ type: 'success', text: 'Removed note from Editorial Vault.' });
      }
      setConfirmState(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Workspace operation failed.';
      if (confirmState.kind === 'gmail_send') {
        setGmailFeedback({ type: 'error', text: msg });
      } else if (confirmState.kind === 'slides_create' || confirmState.kind === 'slides_append') {
        setSlidesFeedback({ type: 'error', text: msg });
      } else {
        setNotesFeedback({ type: 'error', text: msg });
      }
      setConfirmState(null);
    } finally {
      setExecutingConfirm(false);
    }
  };

  const selectedMessage = messages.find((m) => m.id === selectedMessageId) ?? messages[0] ?? null;

  return (
    <section
      id="workspace-hub"
      className="border-t border-[#E5E2DC] dark:border-[#2C2A26] bg-white dark:bg-[#141413]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>Google Workspace Desk · Gmail, Google Slides &amp; Google Keep Notes</span>
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#141413] dark:text-[#F5F3EE] mb-2">
              Editorial Gmail, Slides Briefings &amp; Keep Notes
            </h2>
            <p className="text-sm sm:text-base text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
              Connect your Google account with permission to read and send dispatches in Gmail, build executive story presentations in Google Slides, and organize Keep-compatible reporter notes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {needsAuth ? (
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={() => void handleWorkspaceSignIn()}
                className="inline-flex items-center gap-3 h-10 px-4 bg-white text-[#1F1F1F] border border-[#747775] rounded-full text-sm font-medium shadow-xs hover:bg-[#F7F8FA] transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <span className="w-5 h-5 shrink-0 inline-flex items-center justify-center">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="w-5 h-5 block"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </span>
                <span>{isLoggingIn ? 'Signing in…' : 'Sign in with Google'}</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-3 px-3.5 py-2 bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-md text-xs">
                <ShieldCheck className="w-4 h-4 text-[#14532D] dark:text-[#4ADE80] shrink-0" />
                <span className="font-medium text-[#14532D] dark:text-[#DCFCE7] truncate max-w-[220px]">
                  {user?.email || 'Google Workspace Connected'}
                </span>
                <button
                  type="button"
                  onClick={() => void handleWorkspaceLogout()}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white dark:bg-[#171715] text-[#141413] dark:text-[#F5F3EE] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {authError && (
          <p
            role="alert"
            className="text-xs font-medium px-4 py-3 rounded-md border text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]"
          >
            {authError}
          </p>
        )}

        {/* Workspace Tab Selector */}
        <div
          role="tablist"
          aria-label="Google Workspace tools"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F5F2EB] dark:bg-[#0D0D0C] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'gmail'}
            onClick={() => setActiveTab('gmail')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'gmail'
                ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#F87171]" />
            <span>Gmail Inbox &amp; Dispatches</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'slides'}
            onClick={() => setActiveTab('slides')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'slides'
                ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
            }`}
          >
            <Presentation className="w-3.5 h-3.5 text-[#14532D] dark:text-[#4ADE80]" />
            <span>Google Slides Decks</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'keep_notes'}
            onClick={() => setActiveTab('keep_notes')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'keep_notes'
                ? 'bg-white dark:bg-[#242320] text-[#141413] dark:text-[#F5F3EE] shadow-xs font-semibold'
                : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#141413] dark:hover:text-[#F5F3EE]'
            }`}
          >
            <NotebookPen className="w-3.5 h-3.5 text-[#B45309] dark:text-[#FBBF24]" />
            <span>Google Keep &amp; Reporter Notes ({notes.length})</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: GMAIL INBOX & DISPATCH COMPOSER                       */}
        {/* ============================================================ */}
        {activeTab === 'gmail' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" role="tabpanel">
            {/* Left 6 Cols: Live Gmail Inbox */}
            <div className="lg:col-span-6 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-[#141413] dark:text-[#F5F3EE]">
                  <Inbox className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                  <span>Live Gmail Mailbox</span>
                </div>
                <button
                  type="button"
                  disabled={loadingInbox || needsAuth}
                  onClick={() => void fetchGmailInbox()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingInbox ? 'animate-spin' : ''}`} />
                  <span>Sync Inbox</span>
                </button>
              </div>

              {needsAuth ? (
                <div className="p-8 text-center space-y-4">
                  <p className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    Sign in with Google to view your Gmail inbox
                  </p>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] max-w-md mx-auto">
                    Your Google token is kept strictly in browser memory during this session and cleared immediately when you sign out.
                  </p>
                  <button
                    type="button"
                    disabled={isLoggingIn}
                    onClick={() => void handleWorkspaceSignIn()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md"
                  >
                    <span>{isLoggingIn ? 'Connecting…' : 'Sign in with Google'}</span>
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-6 text-xs text-[#57534E] dark:text-[#A8A29E]">
                  {loadingInbox ? 'Loading recent Gmail messages…' : 'No recent Gmail messages loaded yet. Click Sync Inbox.'}
                </div>
              ) : (
                <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#E5E2DC] dark:divide-[#2C2A26]">
                    {messages.map((msg) => (
                      <button
                        key={msg.id}
                        type="button"
                        onClick={() => setSelectedMessageId(msg.id)}
                        className={`w-full text-left px-5 py-3 transition-colors ${
                          selectedMessage?.id === msg.id
                            ? 'bg-white dark:bg-[#242320]'
                            : 'hover:bg-white/70 dark:hover:bg-[#1C1B19]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#141413] dark:text-[#F5F3EE] truncate">
                            {msg.subject}
                          </span>
                          <span className="font-mono text-[10px] text-[#78716C] dark:text-[#A8A29E] shrink-0">
                            {msg.date.slice(0, 16)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate mt-0.5">
                          From: {msg.from}
                        </p>
                        <p className="text-xs text-[#44403C] dark:text-[#D6D3CD] truncate mt-0.5">
                          {msg.snippet}
                        </p>
                      </button>
                    ))}
                  </div>

                  {selectedMessage && (
                    <div className="p-5 bg-white dark:bg-[#141413] space-y-2">
                      <p className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                        {selectedMessage.subject}
                      </p>
                      <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E] break-all">
                        From: {selectedMessage.from} · To: {selectedMessage.to}
                      </p>
                      <pre className="mt-2 p-3 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md text-xs text-[#292524] dark:text-[#D6D3CD] whitespace-pre-wrap max-h-48 overflow-y-auto font-sans">
                        {selectedMessage.bodyText}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right 6 Cols: Compose & Send via Gmail (Confirmation Gated) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setGmailFeedback(null);
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(composeTo.trim())) {
                  setGmailFeedback({ type: 'error', text: 'Enter a valid recipient email address.' });
                  return;
                }
                if (!composeSubject.trim() || !composeBody.trim()) {
                  setGmailFeedback({ type: 'error', text: 'Enter both an email subject and message body.' });
                  return;
                }
                if (needsAuth) {
                  setGmailFeedback({ type: 'error', text: 'Sign in with Google first to send email via Gmail.' });
                  return;
                }
                setConfirmState({
                  kind: 'gmail_send',
                  title: 'Send Email via Gmail?',
                  description: `Are you sure you want to send this email from ${user?.email || 'your Gmail account'}?`,
                  details: [
                    `Recipient: ${composeTo.trim()}`,
                    `Subject: ${composeSubject.trim()}`,
                    `Preview: ${composeBody.trim().slice(0, 140)}${composeBody.trim().length > 140 ? '…' : ''}`
                  ],
                  confirmLabel: 'Confirm & Send Gmail',
                  payload: {
                    to: composeTo.trim(),
                    subject: composeSubject.trim(),
                    body: composeBody.trim()
                  }
                });
              }}
              className="lg:col-span-6 p-6 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Compose &amp; Send via Gmail
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {articles[0] && (
                    <button
                      type="button"
                      onClick={() => handlePrefillEmailFromArticle(articles[0])}
                      className="px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm hover:border-[#141413]"
                    >
                      Prefill Lead Story
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePrefillRevenueEmail}
                    className="px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm hover:border-[#14532D]"
                  >
                    Prefill Treasury Report
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="gmail-to" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Recipient Email
                </label>
                <input
                  id="gmail-to"
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="editor@newshub24plus.com"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="gmail-subject" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Subject Line
                </label>
                <input
                  id="gmail-subject"
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Breaking Dispatch / Revenue Settlement Summary"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="gmail-body" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Message Body
                </label>
                <textarea
                  id="gmail-body"
                  rows={6}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your newsroom dispatch or revenue report..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              {gmailFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium px-3 py-2.5 rounded-md border ${
                    gmailFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  {gmailFeedback.text}
                </p>
              )}

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Review &amp; Send via Gmail</span>
              </button>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: GOOGLE SLIDES PRESENTATION BUILDER & INSPECTOR        */}
        {/* ============================================================ */}
        {activeTab === 'slides' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" role="tabpanel">
            {/* Left 6 Cols: Create or Open Presentation + Slide Viewer */}
            <div className="lg:col-span-6 space-y-6">
              <div className="p-6 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg space-y-4">
                <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Create or Open a Google Slides Deck
                </h3>

                <div className="space-y-2">
                  <label htmlFor="slides-new-title" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD]">
                    New Editorial Presentation Title
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="slides-new-title"
                      type="text"
                      value={newDeckTitle}
                      onChange={(e) => setNewDeckTitle(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (needsAuth) {
                          setSlidesFeedback({ type: 'error', text: 'Sign in with Google first to create a Slides deck.' });
                          return;
                        }
                        setConfirmState({
                          kind: 'slides_create',
                          title: 'Create New Google Slides Deck?',
                          description: 'This will create a new presentation inside your Google account.',
                          details: [`Deck Title: ${newDeckTitle.trim() || 'News Hub 24+ Briefing Deck'}`],
                          confirmLabel: 'Create Presentation',
                          payload: { deckTitle: newDeckTitle.trim() || 'News Hub 24+ Briefing Deck' }
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md whitespace-nowrap shrink-0"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" />
                      <span>Create Deck</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleOpenDeckSubmit} className="space-y-2 pt-3 border-t border-[#E5E2DC] dark:border-[#2C2A26]">
                  <label htmlFor="slides-open-id" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD]">
                    Open Existing Presentation by ID or Google Slides URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="slides-open-id"
                      type="text"
                      value={openDeckInput}
                      onChange={(e) => setOpenDeckInput(e.target.value)}
                      placeholder="https://docs.google.com/presentation/d/... or ID"
                      className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                    />
                    <button
                      type="submit"
                      disabled={loadingSlides}
                      className="px-3.5 py-2 text-xs font-semibold bg-[#141413] dark:bg-[#F5F3EE] text-white dark:text-[#141413] rounded-md whitespace-nowrap shrink-0"
                    >
                      {loadingSlides ? 'Opening…' : 'Open Deck'}
                    </button>
                  </div>
                </form>

                {recentDecks.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {recentDecks.map((d) => (
                      <button
                        key={d.presentationId}
                        type="button"
                        onClick={() => setActiveDeck(d)}
                        className={`px-2.5 py-1 text-[11px] rounded-sm border ${
                          activeDeck?.presentationId === d.presentationId
                            ? 'bg-[#141413] text-white border-[#141413]'
                            : 'bg-white dark:bg-[#141413] text-[#44403C] dark:text-[#D6D3CD] border-[#D6D1C7] dark:border-[#3A3732]'
                        }`}
                      >
                        {d.title} ({d.slideCount})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {activeDeck && (
                <div className="p-6 bg-white dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                    <div>
                      <h4 className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]">
                        {activeDeck.title}
                      </h4>
                      <p className="font-mono text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                        {activeDeck.slideCount} slides · ID: {activeDeck.presentationId}
                      </p>
                    </div>
                    <a
                      href={activeDeck.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#14532D] dark:text-[#4ADE80] bg-[#F0FDF4] dark:bg-[#0E2416] border border-[#BBF7D0] dark:border-[#166534] rounded-sm"
                    >
                      <span>Open in Google Slides</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {activeDeck.slides.map((s) => (
                      <div
                        key={s.objectId}
                        className="p-3 bg-[#FBF9F5] dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md text-xs space-y-1"
                      >
                        <p className="font-mono font-semibold text-[#991B1B] dark:text-[#F87171]">
                          Slide {s.index}
                        </p>
                        {s.textPreview.length === 0 ? (
                          <p className="text-[#78716C] italic">Empty / cover layout</p>
                        ) : (
                          s.textPreview.map((txt, i) => (
                            <p key={`${s.objectId}-${i}`} className="text-[#141413] dark:text-[#F5F3EE]">
                              {txt}
                            </p>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right 6 Cols: Add Story / Dashboard Slide (Confirmation Gated) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSlidesFeedback(null);
                if (!activeDeck) {
                  setSlidesFeedback({ type: 'error', text: 'Create or open a Google Slides deck on the left first.' });
                  return;
                }
                if (!slideHeading.trim() || !slideBody.trim()) {
                  setSlidesFeedback({ type: 'error', text: 'Enter both a slide title and bullet content.' });
                  return;
                }
                setConfirmState({
                  kind: 'slides_append',
                  title: 'Add Slide to Google Slides Deck?',
                  description: `Append a new slide to "${activeDeck.title}" in your Google Slides presentation?`,
                  details: [
                    `Presentation ID: ${activeDeck.presentationId}`,
                    `Slide Title: ${slideHeading.trim()}`
                  ],
                  confirmLabel: 'Confirm & Add Slide',
                  payload: {
                    presentationId: activeDeck.presentationId,
                    heading: slideHeading.trim(),
                    body: slideBody.trim()
                  }
                });
              }}
              className="lg:col-span-6 p-6 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E2DC] dark:border-[#2C2A26]">
                <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                  Insert Newsroom or Revenue Slide
                </h3>
                {articles[0] && (
                  <button
                    type="button"
                    onClick={() => handlePrefillSlideFromArticle(articles[0])}
                    className="px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm"
                  >
                    Fill Lead Story
                  </button>
                )}
              </div>

              <div>
                <label htmlFor="slide-heading" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Slide Headline
                </label>
                <input
                  id="slide-heading"
                  type="text"
                  value={slideHeading}
                  onChange={(e) => setSlideHeading(e.target.value)}
                  placeholder="Q4 Editorial Briefing & Revenue Performance"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              <div>
                <label htmlFor="slide-body" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                  Slide Key Points
                </label>
                <textarea
                  id="slide-body"
                  rows={6}
                  value={slideBody}
                  onChange={(e) => setSlideBody(e.target.value)}
                  placeholder="• Key editorial takeaways&#10;• Verified watch-hours & revenue metrics"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                />
              </div>

              {slidesFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium px-3 py-2.5 rounded-md border ${
                    slidesFeedback.type === 'success'
                      ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                      : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                  }`}
                >
                  {slidesFeedback.text}
                </p>
              )}

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#166534] rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Review &amp; Append Slide to Deck</span>
              </button>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: GOOGLE KEEP & REPORTER NOTES                          */}
        {/* ============================================================ */}
        {activeTab === 'keep_notes' && (
          <div className="space-y-6" role="tabpanel">
            <div className="p-4 bg-[#FFFBEB] dark:bg-[#291F0E] border border-[#FDE68A] dark:border-[#78350F] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-[#92400E] dark:text-[#FBBF24]">
                  Google Keep Enterprise Note Notice &amp; Direct Newsroom Sync
                </p>
                <p className="text-[#78350F] dark:text-[#FDE68A] leading-relaxed">
                  Google restricts the Google Keep API to Google Workspace enterprise domains using admin domain-wide delegation (personal @gmail.com sign-ins are blocked by Google). Capture your reporter notes below, and sync any note to <strong>Gmail</strong> or <strong>Google Slides</strong> with one click, or open Google Keep directly.
                </p>
              </div>
              <a
                href="https://keep.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#141413] bg-white border border-[#F59E0B] rounded-md hover:bg-[#FEF3C7] whitespace-nowrap shrink-0"
              >
                <span>Open Google Keep</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <form
                onSubmit={handleSaveNote}
                className="lg:col-span-5 p-6 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg space-y-4"
              >
                <h3 className="font-serif text-xl font-bold text-[#141413] dark:text-[#F5F3EE]">
                  New Reporter / Desk Note
                </h3>

                <div>
                  <label htmlFor="keep-note-title" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Note Title
                  </label>
                  <input
                    id="keep-note-title"
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Source follow-up / MoMo payout checklist"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>

                <div>
                  <label htmlFor="keep-note-tag" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Desk Label
                  </label>
                  <input
                    id="keep-note-tag"
                    type="text"
                    value={noteTag}
                    onChange={(e) => setNoteTag(e.target.value)}
                    placeholder="Editorial Wire"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>

                <div>
                  <label htmlFor="keep-note-body" className="block text-xs font-medium text-[#292524] dark:text-[#D6D3CD] mb-1">
                    Note Details
                  </label>
                  <textarea
                    id="keep-note-body"
                    rows={5}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Jot down field leads, timestamps, watch-hour targets..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#10100F] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md text-[#141413] dark:text-[#F5F3EE]"
                  />
                </div>

                {notesFeedback && (
                  <p
                    role="status"
                    className={`text-xs font-medium px-3 py-2.5 rounded-md border ${
                      notesFeedback.type === 'success'
                        ? 'text-[#14532D] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#0E2416] border-[#BBF7D0] dark:border-[#166534]'
                        : 'text-[#991B1B] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#2A1515] border-[#FECACA] dark:border-[#7F1D1D]'
                    }`}
                  >
                    {notesFeedback.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingNote}
                  className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md disabled:opacity-50"
                >
                  {savingNote ? 'Saving Note…' : 'Save Editorial Note'}
                </button>
              </form>

              <div className="lg:col-span-7 bg-[#FBF9F5] dark:bg-[#171715] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#141413] dark:text-[#F5F3EE]">
                    News Hub 24+ Notes Vault
                  </span>
                  <span className="font-mono text-[#57534E] dark:text-[#A8A29E]">
                    {loadingNotes ? 'Syncing…' : `${notes.length} notes`}
                  </span>
                </div>

                {notes.length === 0 ? (
                  <p className="p-6 text-xs text-[#57534E] dark:text-[#A8A29E]">
                    No reporter notes saved yet. Create a note on the left to store leads or export to Gmail and Google Slides.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E5E2DC] dark:divide-[#2C2A26] max-h-96 overflow-y-auto">
                    {notes.map((n) => (
                      <div key={n.id} className="p-5 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-[10px] font-semibold uppercase text-[#991B1B] dark:text-[#F87171]">
                              {n.tag}
                            </span>
                            <h4 className="font-serif text-base font-bold text-[#141413] dark:text-[#F5F3EE]">
                              {n.title}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setComposeSubject(`[Keep Note] ${n.title}`);
                                setComposeBody(n.body);
                                setActiveTab('gmail');
                              }}
                              className="px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm"
                            >
                              Send to Gmail
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSlideHeading(n.title);
                                setSlideBody(n.body);
                                setActiveTab('slides');
                              }}
                              className="px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-sm"
                            >
                              Add to Slides
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmState({
                                  kind: 'note_delete',
                                  title: 'Delete Editorial Note?',
                                  description: `Are you sure you want to permanently remove "${n.title}"?`,
                                  details: [`Tag: ${n.tag}`],
                                  confirmLabel: 'Delete Note',
                                  payload: { noteId: n.id }
                                })
                              }
                              aria-label={`Delete ${n.title}`}
                              className="p-1 text-[#78716C] hover:text-[#991B1B] dark:hover:text-[#F87171]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[#44403C] dark:text-[#D6D3CD] whitespace-pre-wrap leading-relaxed">
                          {n.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Explicit React Confirmation Modal (Required before Gmail send / Slides mutation / Note delete) */}
      {confirmState && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => (!executingConfirm ? setConfirmState(null) : undefined)}
        >
          <div
            className="w-full max-w-md bg-[#FBF9F5] dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2E2C28] rounded-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border-b border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
                <h3
                  id="workspace-confirm-title"
                  className="font-serif text-lg font-bold text-[#141413] dark:text-[#F5F3EE]"
                >
                  {confirmState.title}
                </h3>
              </div>
              <button
                type="button"
                disabled={executingConfirm}
                onClick={() => setConfirmState(null)}
                aria-label="Cancel action"
                className="p-1 text-[#57534E] hover:text-[#141413] dark:hover:text-[#F5F3EE]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-[#292524] dark:text-[#E5E2DC] leading-relaxed">
                {confirmState.description}
              </p>
              <ul className="p-3 bg-white dark:bg-[#10100F] border border-[#E5E2DC] dark:border-[#2C2A26] rounded-md space-y-1 font-mono text-[11px] text-[#44403C] dark:text-[#D6D3CD]">
                {confirmState.details.map((line, i) => (
                  <li key={i} className="break-words">
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="px-5 py-4 bg-[#F5F2EB] dark:bg-[#1C1B19] border-t border-[#E5E2DC] dark:border-[#2C2A26] flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={executingConfirm}
                onClick={() => setConfirmState(null)}
                className="px-3.5 py-2 text-xs font-medium text-[#44403C] dark:text-[#D6D3CD] bg-white dark:bg-[#242320] border border-[#D6D1C7] dark:border-[#3A3732] rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={executingConfirm}
                onClick={() => void handleConfirmExecute()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] dark:bg-[#DC2626] dark:hover:bg-[#B91C1C] rounded-md disabled:opacity-50"
              >
                {executingConfirm ? 'Processing…' : confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
