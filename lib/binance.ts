/**
 * Publieke spot REST — eerst data-api (officiële mirror), daarna api.binance.com.
 * Cloud-hosts (Vercel/AWS) krijgen vaak 451 of timeouts op api.binance.com; de vision-URL is bedoeld voor marktdata.
 */
const BINANCE_REST_BASES = [
  'https://data-api.binance.vision/api/v3',
  'https://api.binance.com/api/v3',
] as const;

const BINANCE_FETCH_HEADERS = {
  Accept: 'application/json',
} as const;

async function binancePublicGet(pathAndQuery: string): Promise<Response | null> {
  for (const base of BINANCE_REST_BASES) {
    try {
      const url = `${base}${pathAndQuery.startsWith('/') ? '' : '/'}${pathAndQuery}`;
      const res = await fetch(url, { cache: 'no-store', headers: BINANCE_FETCH_HEADERS });
      if (res.ok) return res;
    } catch {
      /* volgende mirror */
    }
  }
  return null;
}

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
    const res = await binancePublicGet(
      `/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${lim}`,
    );
    if (!res) return null;
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

/** Huidige spotprijs (publiek endpoint, zelfde mirrors als klines). */
export async function fetchTickerPrice(
  symbol: string,
): Promise<{ symbol: string; price: string } | null> {
  try {
    const res = await binancePublicGet(`/ticker/price?symbol=${encodeURIComponent(symbol)}`);
    if (!res) return null;
    const data = (await res.json()) as { symbol?: string; price?: string };
    if (data.price == null || data.symbol == null) return null;
    return { symbol: data.symbol, price: data.price };
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
    const res = await binancePublicGet(`/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
    if (!res) return null;
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
    const res = await binancePublicGet(
      `/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
    );
    if (!res) return null;
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
