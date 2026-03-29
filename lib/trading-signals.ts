import { TRADE_PAIRS } from '@/lib/crypto-pairs';

export type TradingSignalsMeta = {
  generatedAt: string;
  marketDataOk: boolean;
  headlineCount: number;
  newsSources: string[];
  chartInterval: string;
};

export type SignalDirection = 'BUY' | 'SELL' | 'HOLD';
export type SignalConfidence = 'Low' | 'Medium' | 'High';

export type PairSignal = {
  pair: string;
  signal: SignalDirection;
  confidence: SignalConfidence;
  rationale: string;
};

const ALLOWED_SIGNALS: SignalDirection[] = ['BUY', 'SELL', 'HOLD'];
const ALLOWED_CONFIDENCE: SignalConfidence[] = ['Low', 'Medium', 'High'];

function isSignalDirection(v: unknown): v is SignalDirection {
  return typeof v === 'string' && (ALLOWED_SIGNALS as string[]).includes(v);
}

function isSignalConfidence(v: unknown): v is SignalConfidence {
  return typeof v === 'string' && (ALLOWED_CONFIDENCE as string[]).includes(v);
}

/** Zorgt dat elke verwachte pair precies één geldig signaal heeft (fallback: HOLD). */
export function normalizeSignalsPayload(
  raw: unknown,
  allowedPairs: readonly string[] = TRADE_PAIRS as unknown as string[],
): PairSignal[] {
  const byPair = new Map<string, PairSignal>();

  const list =
    raw &&
    typeof raw === 'object' &&
    'signals' in raw &&
    Array.isArray((raw as { signals: unknown }).signals)
      ? (raw as { signals: unknown[] }).signals
      : [];

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const pair = typeof o.pair === 'string' ? o.pair : '';
    if (!allowedPairs.includes(pair)) continue;

    const signal = isSignalDirection(o.signal) ? o.signal : 'HOLD';
    const confidence = isSignalConfidence(o.confidence) ? o.confidence : 'Medium';
    const rationale =
      typeof o.rationale === 'string' && o.rationale.trim().length > 0
        ? o.rationale.trim()
        : 'Geen toelichting.';

    byPair.set(pair, { pair, signal, confidence, rationale });
  }

  return allowedPairs.map((pair) => {
    const existing = byPair.get(pair);
    if (existing) return existing;
    return {
      pair,
      signal: 'HOLD' as const,
      confidence: 'Low' as const,
      rationale: 'Model gaf geen geldig antwoord voor dit paar.',
    };
  });
}

export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
