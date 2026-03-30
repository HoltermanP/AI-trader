import { anthropic } from '@/lib/ai';
import { isLlmDisabledByEnv } from '@/lib/llm-disabled';
import { extractJsonObject } from '@/lib/trading-signals';

/** Snel en goedkoop voor korte kopregels. */
const MODEL = 'claude-3-5-haiku-20241022';

function parseNlOutput(raw: string, expectedLen: number): string[] | null {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as { nl?: unknown };
    if (!Array.isArray(parsed.nl)) return null;
    const nl = parsed.nl
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .slice(0, expectedLen);
    if (nl.length !== expectedLen) return null;
    if (nl.some((s) => !s)) return null;
    return nl;
  } catch {
    return null;
  }
}

/**
 * Vertaalt koppen naar Nederlands (één API-call). Bij ontbrekende key,
 * DISABLE_LLM_CALLS of fout: originele strings terug.
 */
export async function translateTitlesToNl(titles: string[]): Promise<{
  translations: string[];
  usedLlm: boolean;
}> {
  if (titles.length === 0) return { translations: [], usedLlm: false };
  if (isLlmDisabledByEnv() || !process.env.ANTHROPIC_API_KEY?.trim()) {
    return { translations: [...titles], usedLlm: false };
  }

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 768,
      system:
        'Je vertaalt nieuwskoppen naar natuurlijk Nederlands. Antwoord uitsluitend met geldige JSON, geen markdown, geen uitleg.',
      messages: [
        {
          role: 'user',
          content: `Vertaal elke kopregel naar natuurlijk Nederlands. Behoud gangbare namen (Fed, ECB, SEC, ETF, Bitcoin, Ethereum, OPEC) waar passend. Geef precies één JSON-object met sleutel "nl": een array van ${titles.length} strings in dezelfde volgorde als de invoer. Geen markdown.\n\nInvoer als JSON-array:\n${JSON.stringify(titles)}`,
        },
      ],
    });

    const textBlock = msg.content.find((b) => b.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '';
    const nl = parseNlOutput(rawText, titles.length);
    if (!nl) return { translations: [...titles], usedLlm: false };

    return {
      translations: nl.map((t, i) => (t.length > 400 ? t.slice(0, 280) : t) || titles[i]),
      usedLlm: true,
    };
  } catch {
    return { translations: [...titles], usedLlm: false };
  }
}
