import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Unsubscribe,
  type User
} from 'firebase/auth';
import { auth } from './firebase';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/presentations'
] as const;

const workspaceProvider = new GoogleAuthProvider();
workspaceProvider.setCustomParameters({ prompt: 'consent select_account' });
for (const scope of WORKSPACE_SCOPES) {
  workspaceProvider.addScope(scope);
}

// Strict in-memory token cache (never stored in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export function initWorkspaceAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
}

export async function workspaceGoogleSignIn(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, workspaceProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain a Google Workspace access token from sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getWorkspaceAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearWorkspaceAccessToken(): void {
  cachedAccessToken = null;
}

export async function workspaceLogout(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

// ==========================================
// GMAIL REST CLIENT (gmail.googleapis.com)
// ==========================================

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  bodyText: string;
  labelIds: string[];
}

function decodeBase64UrlUtf8(encoded: string | undefined): string {
  if (!encoded) return '';
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const bin = atob(normalized + pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64UrlUtf8(raw: string): string {
  const bytes = new TextEncoder().encode(raw);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
}

function extractPlainBodyFromPayload(payload: GmailPayloadPart | undefined): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64UrlUtf8(payload.body.data);
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const text = extractPlainBodyFromPayload(part);
      if (text) return text;
    }
  }
  if (payload.body?.data) {
    const raw = decodeBase64UrlUtf8(payload.body.data);
    return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

export async function listGmailMessages(accessToken: string, maxResults = 8): Promise<GmailMessageSummary[]> {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.max(1, Math.min(20, maxResults))}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  if (!listRes.ok) {
    const errText = await listRes.text().catch(() => '');
    throw new Error(
      listRes.status === 401 || listRes.status === 403
        ? 'Gmail access expired or lacks permission. Please sign in again with Google.'
        : `Gmail request failed (${listRes.status}): ${errText.slice(0, 140)}`
    );
  }

  const listJson = (await listRes.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
  };
  const items = listJson.messages ?? [];
  if (items.length === 0) return [];

  const details = await Promise.all(
    items.map(async (item) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      if (!msgRes.ok) return null;
      const raw = (await msgRes.json()) as {
        id: string;
        threadId: string;
        snippet?: string;
        labelIds?: string[];
        payload?: GmailPayloadPart & {
          headers?: Array<{ name?: string; value?: string }>;
        };
      };
      const headers = raw.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => (h.name ?? '').toLowerCase() === name.toLowerCase())?.value ?? '';

      return {
        id: raw.id,
        threadId: raw.threadId,
        subject: getHeader('Subject') || '(No Subject)',
        from: getHeader('From') || 'Unknown Sender',
        to: getHeader('To') || 'me',
        date: getHeader('Date') || '',
        snippet: raw.snippet || '',
        bodyText: extractPlainBodyFromPayload(raw.payload) || raw.snippet || '',
        labelIds: raw.labelIds ?? []
      } satisfies GmailMessageSummary;
    })
  );

  return details.filter((d): d is GmailMessageSummary => d !== null);
}

export async function sendGmailMessage(
  accessToken: string,
  params: { to: string; subject: string; body: string }
): Promise<{ id: string; threadId: string }> {
  const safeTo = params.to.replace(/[\r\n]/g, '').trim();
  const safeSubject = params.subject.replace(/[\r\n]/g, ' ').trim();
  const rfc2822 = [
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    params.body
  ].join('\r\n');

  const raw = encodeBase64UrlUtf8(rfc2822);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });
  const json = (await res.json()) as { id?: string; threadId?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || `Failed to send Gmail message (${res.status}).`);
  }
  return {
    id: json.id || 'sent',
    threadId: json.threadId || ''
  };
}

// ==========================================
// GOOGLE SLIDES REST CLIENT (slides.googleapis.com)
// ==========================================

export interface GoogleSlidesPresentationSummary {
  presentationId: string;
  title: string;
  slideCount: number;
  url: string;
  slides: Array<{
    objectId: string;
    index: number;
    textPreview: string[];
  }>;
}

function parseSlidesSummary(raw: {
  presentationId?: string;
  title?: string;
  slides?: Array<{
    objectId?: string;
    pageElements?: Array<{
      shape?: {
        text?: {
          textElements?: Array<{ textRun?: { content?: string } }>;
        };
      };
    }>;
  }>;
}): GoogleSlidesPresentationSummary {
  const id = raw.presentationId || '';
  const slides = (raw.slides ?? []).map((s, idx) => {
    const snippets: string[] = [];
    for (const el of s.pageElements ?? []) {
      const runs = el.shape?.text?.textElements ?? [];
      const joined = runs
        .map((r) => r.textRun?.content ?? '')
        .join('')
        .trim();
      if (joined) snippets.push(joined);
    }
    return {
      objectId: s.objectId || `slide-${idx + 1}`,
      index: idx + 1,
      textPreview: snippets
    };
  });
  return {
    presentationId: id,
    title: raw.title || 'Untitled Presentation',
    slideCount: slides.length,
    url: `https://docs.google.com/presentation/d/${encodeURIComponent(id)}/edit`,
    slides
  };
}

export async function createGooglePresentation(
  accessToken: string,
  title: string
): Promise<GoogleSlidesPresentationSummary> {
  const res = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: title.trim() || 'News Hub 24+ Briefing Deck' })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Failed to create Google Slides deck (${res.status}).`);
  }
  return parseSlidesSummary(json);
}

export async function getGooglePresentation(
  accessToken: string,
  presentationIdOrUrl: string
): Promise<GoogleSlidesPresentationSummary> {
  const match = presentationIdOrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const id = (match ? match[1] : presentationIdOrUrl).trim();
  if (!id) {
    throw new Error('Enter a valid Google Slides presentation ID or URL.');
  }
  const res = await fetch(
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Could not open Google Slides deck (${res.status}).`);
  }
  return parseSlidesSummary(json);
}

export async function appendEditorialSlide(
  accessToken: string,
  params: {
    presentationId: string;
    heading: string;
    body: string;
  }
): Promise<GoogleSlidesPresentationSummary> {
  const uid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const slideId = `nh_slide_${uid}`;
  const titleShapeId = `nh_title_${uid}`;
  const bodyShapeId = `nh_body_${uid}`;

  const res = await fetch(
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(params.presentationId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            createSlide: {
              objectId: slideId,
              slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
              placeholderIdMappings: [
                {
                  layoutPlaceholder: { type: 'TITLE', index: 0 },
                  objectId: titleShapeId
                },
                {
                  layoutPlaceholder: { type: 'BODY', index: 0 },
                  objectId: bodyShapeId
                }
              ]
            }
          },
          {
            insertText: {
              objectId: titleShapeId,
              insertionIndex: 0,
              text: params.heading.slice(0, 240)
            }
          },
          {
            insertText: {
              objectId: bodyShapeId,
              insertionIndex: 0,
              text: params.body.slice(0, 2000)
            }
          }
        ]
      })
    }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Failed to add slide to Google Slides (${res.status}).`);
  }
  return getGooglePresentation(accessToken, params.presentationId);
}
