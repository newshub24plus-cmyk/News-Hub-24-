import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from '@google/genai';
import { ARTICLE_CATALOGS, type NewsArticle } from '../src/data/newsData.ts';

export type AiRegionFocus = 'Global' | 'Europe & Asia' | 'Europe' | 'Asia';

export interface GroundedSourceLink {
  title: string;
  uri: string;
}

export interface TrendingBriefingTopic {
  id: string;
  headline: string;
  summary: string;
  region: AiRegionFocus;
  suggestedCatalog: Exclude<NewsArticle['category'], 'All'>;
  whyTrending: string;
  sources: GroundedSourceLink[];
}

export interface AiGeneratedDispatchDraft {
  category: Exclude<NewsArticle['category'], 'All'>;
  kicker: string;
  title: string;
  deck: string;
  author: string;
  authorRole: string;
  bureau: string;
  pullQuote?: string;
  paragraphs: string[];
  regionFocus: AiRegionFocus;
  breaking: boolean;
}

const VALID_CATALOGS = ARTICLE_CATALOGS;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

export function isAiAssistantConfigured(): boolean {
  return getGeminiClient() !== null;
}

function extractGroundingLinks(response: GenerateContentResponse): GroundedSourceLink[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const links: GroundedSourceLink[] = [];

  for (const chunk of chunks) {
    const web = chunk?.web;
    if (web?.uri && /^https?:\/\//i.test(web.uri) && !seen.has(web.uri)) {
      seen.add(web.uri);
      links.push({
        title: (web.title || new URL(web.uri).hostname).trim().slice(0, 120),
        uri: web.uri
      });
    }
    if (links.length >= 6) break;
  }
  return links;
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const firstObj = candidate.indexOf('{');
  const firstArr = candidate.indexOf('[');
  let start = -1;
  if (firstObj !== -1 && firstArr !== -1) {
    start = Math.min(firstObj, firstArr);
  } else {
    start = Math.max(firstObj, firstArr);
  }
  if (start === -1) return candidate;
  const endObj = candidate.lastIndexOf('}');
  const endArr = candidate.lastIndexOf(']');
  const end = Math.max(endObj, endArr);
  if (end > start) {
    return candidate.slice(start, end + 1);
  }
  return candidate;
}

function normalizeCatalog(raw: unknown, fallback?: string): Exclude<NewsArticle['category'], 'All'> {
  if (typeof raw === 'string') {
    const clean = raw.trim().toLowerCase();
    const matched = VALID_CATALOGS.find((c) => c.toLowerCase() === clean);
    if (matched) return matched;
    const partial = VALID_CATALOGS.find(
      (c) => clean.includes(c.toLowerCase()) || c.toLowerCase().includes(clean)
    );
    if (partial) return partial;
  }
  if (fallback && VALID_CATALOGS.includes(fallback as (typeof VALID_CATALOGS)[number])) {
    return fallback as (typeof VALID_CATALOGS)[number];
  }
  return 'World';
}

function normalizeRegion(raw: unknown, fallback: AiRegionFocus): AiRegionFocus {
  if (raw === 'Global' || raw === 'Europe' || raw === 'Asia' || raw === 'Europe & Asia') {
    return raw;
  }
  if (typeof raw === 'string') {
    const low = raw.toLowerCase();
    if (low.includes('europe') && low.includes('asia')) return 'Europe & Asia';
    if (low.includes('europe') || low.includes('eu') || low.includes('uk')) return 'Europe';
    if (low.includes('asia') || low.includes('apac')) return 'Asia';
    if (low.includes('world') || low.includes('global')) return 'Global';
  }
  return fallback;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(msg)) {
    return {
      status: 403,
      message:
        'Gemini API access was denied. Please check your GEMINI_API_KEY in the Settings > Secrets panel.'
    };
  }
  if (/RESOURCE_EXHAUSTED|429/i.test(msg)) {
    return {
      status: 429,
      message:
        'Gemini API rate or quota limit reached. Please wait a moment or check your key tier in Settings > Secrets.'
    };
  }
  if (/NOT_FOUND|404/i.test(msg)) {
    return {
      status: 502,
      message: 'Configured Gemini model endpoint returned not found. Please retry shortly.'
    };
  }
  return {
    status: 502,
    message: `AI Trending Desk error: ${msg.slice(0, 220)}`
  };
}

function getRegionGuidance(region: AiRegionFocus): string {
  switch (region) {
    case 'Europe':
      return 'Prioritize major breaking news, policy, business, tech, culture, and sports trending right now across Europe (EU, UK, Nordics, Eastern & Southern Europe).';
    case 'Asia':
      return 'Prioritize major breaking news, markets, technology, diplomacy, entertainment, and sports trending right now across Asia (East Asia, South Asia, Southeast Asia).';
    case 'Europe & Asia':
      return 'Balance top trending developments across Europe and Asia-Pacific, highlighting cross-continental global impact.';
    case 'Global':
    default:
      return 'Prioritize the most significant real-world global trending stories worldwide, explicitly including major developments from Europe, Asia, and worldwide geopolitics, markets, tech, culture, and sports.';
  }
}

export async function discoverTrendingBriefings(params: {
  regionFocus: AiRegionFocus;
  catalog?: string;
}): Promise<{ topics: TrendingBriefingTopic[]; sources: GroundedSourceLink[] }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw Object.assign(
      new Error('GEMINI_API_KEY is not configured in Settings > Secrets for the AI Trending Desk.'),
      { status: 503 }
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const targetCatalogText =
    params.catalog && params.catalog !== 'auto' && VALID_CATALOGS.includes(params.catalog as never)
      ? `Focus on stories suited to the "${params.catalog}" catalog.`
      : `Match each story to the best fitting catalog from: ${VALID_CATALOGS.join(', ')}.`;

  const prompt = [
    `Today is ${todayIso}. Use Google Search to find 5 real, currently trending news stories.`,
    getRegionGuidance(params.regionFocus),
    targetCatalogText,
    `Return ONLY valid JSON (no markdown commentary outside JSON) as an array of 5 objects with keys:`,
    `headline (string, concise broadsheet headline),`,
    `summary (string, 2 crisp factual sentences based on search results),`,
    `region ("Global" | "Europe" | "Asia" | "Europe & Asia"),`,
    `suggestedCatalog (one of: ${VALID_CATALOGS.join(', ')}),`,
    `whyTrending (string, 1 short sentence on why readers globally are following this today).`
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are the Chief Wire Editor at News Hub 24+. Report strictly factual, currently trending real-world news grounded via Google Search. Always return valid JSON matching the requested schema.'
      }
    });

    const rawText = response.text ?? '[]';
    const sources = extractGroundingLinks(response);
    const parsed = JSON.parse(extractJsonText(rawText)) as Array<Record<string, unknown>>;
    const list = Array.isArray(parsed) ? parsed : [];

    const topics: TrendingBriefingTopic[] = list.slice(0, 5).map((item, idx) => ({
      id: `trend-${Date.now().toString(36)}-${idx}`,
      headline: String(item.headline || 'Global Wire Update').trim(),
      summary: String(item.summary || '').trim(),
      region: normalizeRegion(item.region, params.regionFocus),
      suggestedCatalog: normalizeCatalog(
        item.suggestedCatalog,
        params.catalog && params.catalog !== 'auto' ? params.catalog : undefined
      ),
      whyTrending: String(item.whyTrending || 'High global wire engagement today.').trim(),
      sources
    }));

    return { topics, sources };
  } catch (err) {
    const formatted = formatGeminiError(err);
    throw Object.assign(new Error(formatted.message), { status: formatted.status });
  }
}

export async function generateTrendingDispatches(params: {
  regionFocus: AiRegionFocus;
  catalog?: string;
  topicHint?: string;
  count: number;
  markBreaking?: boolean;
  existingTitles: string[];
}): Promise<{ drafts: AiGeneratedDispatchDraft[]; sources: GroundedSourceLink[] }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw Object.assign(
      new Error('GEMINI_API_KEY is not configured in Settings > Secrets for the AI Trending Desk.'),
      { status: 503 }
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const safeCount = Math.min(3, Math.max(1, Math.round(params.count || 1)));
  const requestedCatalog =
    params.catalog && params.catalog !== 'auto' && VALID_CATALOGS.includes(params.catalog as never)
      ? params.catalog
      : null;

  const catalogInstruction = requestedCatalog
    ? `Every story MUST belong to the "${requestedCatalog}" catalog.`
    : `Assign each story to the single most appropriate catalog from: ${VALID_CATALOGS.join(', ')}.`;

  const topicInstruction =
    params.topicHint && params.topicHint.trim().length > 0
      ? `Cover this specific trending topic or angle: "${params.topicHint.trim()}".`
      : `Select distinct, high-impact trending stories from today's live news cycle.`;

  const avoidList =
    params.existingTitles.length > 0
      ? `Do NOT duplicate these already-published headlines:\n- ${params.existingTitles.slice(0, 12).join('\n- ')}`
      : '';

  const prompt = [
    `Today is ${todayIso}. Use Google Search to research ${safeCount} real, currently trending news story/stories and write authoritative broadsheet dispatches for News Hub 24+.`,
    getRegionGuidance(params.regionFocus),
    catalogInstruction,
    topicInstruction,
    avoidList,
    `Special editorial style guidance when fitting specialized catalogs:`,
    `- "Black History": highlight living heritage milestones, museum archives, civic honors, or historical context trending today.`,
    `- "Movie Snippets" or "Entertainment": highlight trending cinema festivals (Cannes/Venice/Tokyo/Busan/Global box office), series premieres, or cultural awards.`,
    `- "Comic Series": highlight trending manga, graphic novels, webtoon adaptations, or comic conventions in Asia, Europe, or globally.`,
    `- "Commercials & Ads": highlight major global brand campaigns, media buying shifts, or streaming ad-tier developments.`,
    `Return ONLY a valid JSON array of ${safeCount} object(s) (no markdown text outside the JSON array) with keys:`,
    `category (exact match from: ${VALID_CATALOGS.join(', ')}),`,
    `regionFocus ("Global" | "Europe" | "Asia" | "Europe & Asia"),`,
    `kicker (short 2-4 word dateline label, e.g. "Brussels Policy Desk" or "Tokyo Tech Wire"),`,
    `title (compelling factual headline, 8-16 words),`,
    `deck (concise 1-2 sentence broadsheet summary deck),`,
    `author (realistic correspondent name matched to the region/beat, e.g. Lukas Meyer, Mei-Ling Zhou, Priya Nair, Elena Rostova),`,
    `authorRole (e.g. "European Affairs Correspondent", "Asia-Pacific Bureau Chief", "Global Markets Reporter"),`,
    `bureau (e.g. "Brussels Bureau", "Tokyo Desk", "London Bureau", "Singapore Bureau", "Global Wire Desk"),`,
    `pullQuote (1 sharp illustrative quote or analytical takeaway sentence from the story),`,
    `breaking (boolean — ${params.markBreaking ? 'true for top story' : 'true only if major breaking news'}),`,
    `paragraphs (array of 4 substantive, factual journalistic paragraphs grounded in today's search results; start paragraph 1 with an uppercase CITY dateline like "BRUSSELS — ").`
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        systemInstruction:
          'You are the Senior Global Wire Editor at News Hub 24+ (newshub24plus.com). Every dispatch must be factually grounded in current Google Search results, written in crisp international newspaper style, never invent fake statistics, and output valid JSON.'
      }
    });

    const rawText = response.text ?? '[]';
    const sources = extractGroundingLinks(response);
    const parsedRaw = JSON.parse(extractJsonText(rawText));
    const items: Array<Record<string, unknown>> = Array.isArray(parsedRaw)
      ? parsedRaw
      : parsedRaw && typeof parsedRaw === 'object'
        ? [parsedRaw as Record<string, unknown>]
        : [];

    if (items.length === 0) {
      throw new Error('AI assistant returned an empty dispatch list.');
    }

    const drafts: AiGeneratedDispatchDraft[] = items.slice(0, safeCount).map((item, idx) => {
      const rawParagraphs = Array.isArray(item.paragraphs)
        ? item.paragraphs.map((p) => String(p).trim()).filter((p) => p.length > 15)
        : [];

      const deck = String(item.deck || item.summary || '').trim();
      const paragraphs =
        rawParagraphs.length >= 2
          ? rawParagraphs
          : [
              deck || 'Global correspondents report developing updates tracked across international wires.',
              'Officials and industry observers across Europe, Asia, and international markets continue monitoring developments as additional filings emerge.'
            ];

      return {
        category: normalizeCatalog(requestedCatalog ?? item.category),
        regionFocus: normalizeRegion(item.regionFocus, params.regionFocus),
        kicker: String(item.kicker || `${params.regionFocus} Trending Desk`).trim().slice(0, 60),
        title: String(item.title || 'Global Trending Wire Dispatch').trim().slice(0, 180),
        deck: deck || paragraphs[0].slice(0, 200),
        author: String(item.author || 'Elena Rostova').trim().slice(0, 80),
        authorRole: String(item.authorRole || 'Global Wire Correspondent').trim().slice(0, 80),
        bureau: String(item.bureau || 'Global Wire Desk').trim().slice(0, 80),
        pullQuote:
          typeof item.pullQuote === 'string' && item.pullQuote.trim().length > 10
            ? item.pullQuote.trim().slice(0, 240)
            : undefined,
        breaking: params.markBreaking ? idx === 0 || Boolean(item.breaking) : Boolean(item.breaking),
        paragraphs
      };
    });

    return { drafts, sources };
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      throw err;
    }
    const formatted = formatGeminiError(err);
    throw Object.assign(new Error(formatted.message), { status: formatted.status });
  }
}
