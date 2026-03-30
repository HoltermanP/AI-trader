import { anthropic } from '@/lib/ai';

/** Zelfde model als trading-routes: voorspelbare beschikbaarheid op de Anthropic-key. */
const MODEL = 'claude-sonnet-4-6';

function stripMarkdownJsonFences(text: string): string {
  const t = text.trim();
  const m = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (m?.[1]) return m[1].trim();
  return t;
}

function extractJsonObjectLoose(text: string): string {
  const t = stripMarkdownJsonFences(text);
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function pickStringArray(parsed: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(parsed.nl)) return parsed.nl;
  if (Array.isArray(parsed.translations)) return parsed.translations;
  return null;
}

function parseNlFromJson(raw: string, expectedLen: number): string[] | null {
  try {
    const parsed = JSON.parse(extractJsonObjectLoose(raw)) as Record<string, unknown>;
    const rawArr = pickStringArray(parsed);
    if (!rawArr) return null;
    const nl = rawArr
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .slice(0, expectedLen);
    if (nl.length !== expectedLen) return null;
    if (nl.some((s) => !s)) return null;
    return nl;
  } catch {
    return null;
  }
}

/** Fallback: regels zonder nummering of met "1. " prefix */
function parseNlFromLines(raw: string, expectedLen: number): string[] | null {
  const body = stripMarkdownJsonFences(raw);
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[\).\s-]+\s*/, '').trim())
    .filter((l) => l.length > 0 && !l.startsWith('```'));
  if (lines.length < expectedLen) return null;
  return lines.slice(0, expectedLen);
}

function parseTranslationOutput(raw: string, expectedLen: number): string[] | null {
  return parseNlFromJson(raw, expectedLen) ?? parseNlFromLines(raw, expectedLen);
}

/**
 * Vertaalt koppen naar Nederlands (één API-call). Bij ontbrekende key of fout:
 * originele strings. (Niet gebonden aan DISABLE_LLM_CALLS — dat blokkeert alleen
 * de zware trading-endpoints; deze call is licht en los daarvan.)
 */
export async function translateTitlesToNl(titles: string[]): Promise<{
  translations: string[];
  usedLlm: boolean;
}> {
  if (titles.length === 0) return { translations: [], usedLlm: false };
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return { translations: [...titles], usedLlm: false };
  }

  try {
    const payload = JSON.stringify(titles);
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        'Je vertaalt financiële nieuwskoppen naar vloeiend Nederlands. ' +
        'Antwoord alleen met het gevraagde JSON-object, zonder markdown-fences en zonder uitleg.',
      messages: [
        {
          role: 'user',
          content:
            `Vertaal elke string in deze JSON-array naar natuurlijk Nederlands, zelfde volgorde, precies ${titles.length} items. ` +
            'Behoud gangbare namen (Fed, ECB, SEC, ETF, Bitcoin, Ethereum, OPEC). ' +
            'Antwoord uitsluitend met JSON op één regel of meerdere regels:\n' +
            `{"nl":[ "…", "…", … ]}\n\n` +
            `Array:\n${payload}`,
        },
      ],
    });

    const textBlock = msg.content.find((b) => b.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '';
    const nl = parseTranslationOutput(rawText, titles.length);
    if (!nl) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[translate-headlines] Parse mislukt, ruwe output (afgekapt):', rawText.slice(0, 500));
      }
      return { translations: [...titles], usedLlm: false };
    }

    return {
      translations: nl.map((t, i) => (t.length > 400 ? t.slice(0, 280) : t) || titles[i]!),
      usedLlm: true,
    };
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[translate-headlines] Anthropic-fout:', err);
    }
    return { translations: [...titles], usedLlm: false };
  }
}
