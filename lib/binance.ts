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

/** Intervals voor live grafiek (Binance spot klines). */
export type ChartKlineInterval =
  | '1m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '4h'
  | '1d'
  | '1w';

export const CHART_KLINE_INTERVALS: ChartKlineInterval[] = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1d',
  '1w',
];

export function isChartKlineInterval(s: string): s is ChartKlineInterval {
  return (CHART_KLINE_INTERVALS as readonly string[]).includes(s);
}

export function timeframeToBinanceInterval(tf: string): KlineInterval {
  if (tf === '15m' || tf === '1h' || tf === '4h' || tf === '1d' || tf === '1w') return tf;
  return '4h';
}

export type KlineCandle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

/** OHLCV-candles, oud → nieuw. Max 1000 per Binance. */
export async function fetchKlines(
  symbol: string,
  interval: ChartKlineInterval,
  limit: number,
): Promise<KlineCandle[] | null> {
  try {
    const lim = Math.min(1000, Math.max(1, Math.floor(limit)));
    const res = await fetch(
      `${BINANCE_API}/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${lim}`,
      { cache: 'no-store', headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) return null;
    const out: KlineCandle[] = [];
    for (const row of raw) {
      if (!Array.isArray(row) || row.length < 7) continue;
      const openTime = Number(row[0]);
      const open = parseFloat(String(row[1]));
      const high = parseFloat(String(row[2]));
      const low = parseFloat(String(row[3]));
      const close = parseFloat(String(row[4]));
      const volume = parseFloat(String(row[5]));
      const closeTime = Number(row[6]);
      if (!Number.isFinite(openTime) || !Number.isFinite(close)) continue;
      out.push({
        openTime,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
        closeTime: Number.isFinite(closeTime) ? closeTime : openTime,
      });
    }
    return out;
  } catch {
    return null;
  }
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
