const BINANCE_API = 'https://api.binance.com/api/v3';

export function pairToBinanceSymbol(pair: string): string {
  return pair.replace('/', '');
}

export type KlineInterval =
  | '15m'
  | '1h'
  | '4h'
  | '1d'
  | '1w';

export function timeframeToBinanceInterval(tf: string): KlineInterval {
  if (tf === '15m' || tf === '1h' || tf === '4h' || tf === '1d' || tf === '1w') return tf;
  return '4h';
}

export type Ticker24h = {
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  quoteVolume: number;
};

export async function fetchTicker24h(symbol: string): Promise<Ticker24h | null> {
  try {
    const res = await fetch(`${BINANCE_API}/ticker/24hr?symbol=${encodeURIComponent(symbol)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      lastPrice?: string;
      priceChangePercent?: string;
      highPrice?: string;
      lowPrice?: string;
      quoteVolume?: string;
    };
    const last = parseFloat(d.lastPrice ?? '');
    if (!Number.isFinite(last)) return null;
    return {
      lastPrice: last,
      priceChangePercent: parseFloat(d.priceChangePercent ?? '0') || 0,
      highPrice: parseFloat(d.highPrice ?? '0') || 0,
      lowPrice: parseFloat(d.lowPrice ?? '0') || 0,
      quoteVolume: parseFloat(d.quoteVolume ?? '0') || 0,
    };
  } catch {
    return null;
  }
}

/** Sluitkoersen (oud → nieuw), max `limit` candles. */
export async function fetchCloses(
  symbol: string,
  interval: KlineInterval,
  limit = 200,
): Promise<number[] | null> {
  try {
    const res = await fetch(
      `${BINANCE_API}/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
      { cache: 'no-store', headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const raw = (await res.json()) as [unknown, unknown, unknown, unknown, unknown][];
    if (!Array.isArray(raw)) return null;
    return raw.map((k) => {
      const c = parseFloat(String(k[4]));
      return Number.isFinite(c) ? c : NaN;
    }).filter((n) => Number.isFinite(n));
  } catch {
    return null;
  }
}
