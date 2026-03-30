'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { TRADE_PAIRS, type TradePair } from '@/lib/crypto-pairs';
import {
  type ChartKlineInterval,
  CHART_KLINE_INTERVALS,
  type KlineCandle,
  pairToBinanceSymbol,
} from '@/lib/binance';

const HISTORY_OPTIONS = [100, 200, 500, 1000] as const;
/** Bij live-update alleen de laatste N candles ophalen om te mergen (vormende candle + nieuwe sloten). */
const POLL_FETCH_LIMIT = 24;

function mergeCandles(prev: KlineCandle[], incoming: KlineCandle[], maxLen: number): KlineCandle[] {
  const map = new Map<number, KlineCandle>();
  for (const c of prev) map.set(c.openTime, c);
  for (const c of incoming) map.set(c.openTime, c);
  const merged = Array.from(map.values()).sort((a, b) => a.openTime - b.openTime);
  if (merged.length <= maxLen) return merged;
  return merged.slice(-maxLen);
}

function pollMsForInterval(iv: ChartKlineInterval): number {
  switch (iv) {
    case '1m':
      return 10_000;
    case '5m':
      return 15_000;
    case '15m':
      return 30_000;
    case '30m':
      return 45_000;
    case '1h':
      return 60_000;
    case '4h':
      return 120_000;
    case '1d':
      return 300_000;
    case '1w':
      return 600_000;
    default:
      return 30_000;
  }
}

function intervalLabel(iv: ChartKlineInterval): string {
  const map: Record<ChartKlineInterval, string> = {
    '1m': '1 min',
    '5m': '5 min',
    '15m': '15 min',
    '30m': '30 min',
    '1h': '1 uur',
    '4h': '4 uur',
    '1d': '1 dag',
    '1w': '1 week',
  };
  return map[iv];
}

/** Prijs in EUR (Binance EUR-quote). */
function formatPrice(n: number) {
  let s: string;
  if (n >= 1000) {
    s = n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (n >= 1) {
    s = n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  } else {
    s = n.toLocaleString('nl-NL', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  }
  return `€${s}`;
}

type ChartPoint = {
  t: number;
  price: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  timeLabel: string;
};

function CandleTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-[#1E1E28] bg-[#111116] px-3 py-2 text-[11px] font-mono text-off-white shadow-lg max-w-[300px]">
      <p className="text-slate-custom mb-1.5">{p.timeLabel}</p>
      <p className="text-[10px] leading-relaxed">
        <span className="text-slate-custom">O</span> {formatPrice(p.open)}{' '}
        <span className="text-slate-custom">H</span> {formatPrice(p.high)}{' '}
        <span className="text-slate-custom">L</span> {formatPrice(p.low)}{' '}
        <span className="text-slate-custom">C</span> {formatPrice(p.price)}
      </p>
      <p className="text-slate-custom mt-1.5 text-[10px]">
        Vol {p.volume.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

type KlinesResponse = {
  candles: KlineCandle[];
  interval: ChartKlineInterval;
  symbol: string;
};

export default function LivePriceChart() {
  const [pair, setPair] = useState<TradePair>(TRADE_PAIRS[0]);
  const [interval, setInterval] = useState<ChartKlineInterval>('15m');
  const [historyLimit, setHistoryLimit] = useState<number>(500);
  const [candles, setCandles] = useState<KlineCandle[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const symbol = pairToBinanceSymbol(pair);

  const fetchKlinesJson = useCallback(
    async (signal: AbortSignal, limit: number): Promise<KlinesResponse> => {
      const q = new URLSearchParams({
        symbol,
        interval,
        limit: String(limit),
      });
      const res = await fetch(`/api/binance-klines?${q}`, { signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === 'string' ? err.error : 'Ophalen mislukt');
      }
      return (await res.json()) as KlinesResponse;
    },
    [symbol, interval],
  );

  const loadInitial = useCallback(
    async (signal: AbortSignal) => {
      setStatus('loading');
      setErrorMessage(null);
      setCandles([]);
      setLastPrice(null);
      const data = await fetchKlinesJson(signal, historyLimit);
      setCandles(data.candles);
      const last = data.candles[data.candles.length - 1];
      setLastPrice(last?.close ?? null);
      setLastUpdated(Date.now());
      setStatus('ok');
    },
    [fetchKlinesJson, historyLimit],
  );

  const pollLatest = useCallback(
    async (signal: AbortSignal) => {
      const data = await fetchKlinesJson(signal, POLL_FETCH_LIMIT);
      setCandles((prev) => mergeCandles(prev, data.candles, historyLimit));
      const last = data.candles[data.candles.length - 1];
      if (last) {
        setLastPrice(last.close);
        setLastUpdated(Date.now());
      }
      setStatus('ok');
    },
    [fetchKlinesJson, historyLimit],
  );

  useEffect(() => {
    const ac = new AbortController();
    loadInitial(ac.signal).catch((e: unknown) => {
      if (e instanceof Error && e.name === 'AbortError') return;
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Ophalen mislukt');
    });
    return () => ac.abort();
  }, [pair, interval, historyLimit, loadInitial]);

  useEffect(() => {
    if (status !== 'ok' || candles.length === 0) return;
    const ac = new AbortController();
    const ms = pollMsForInterval(interval);
    const id = window.setInterval(() => {
      pollLatest(ac.signal).catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : 'Live-update mislukt');
      });
    }, ms);
    return () => {
      ac.abort();
      window.clearInterval(id);
    };
  }, [interval, pollLatest, status, candles.length]);

  const chartData: ChartPoint[] = useMemo(
    () =>
      candles.map((c) => ({
        t: c.openTime,
        price: c.close,
        high: c.high,
        low: c.low,
        open: c.open,
        volume: c.volume,
        timeLabel: new Date(c.openTime).toLocaleString('nl-NL', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    [candles],
  );

  const yDomain = useMemo(() => {
    if (candles.length < 2) return undefined;
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const pad = (max - min) * 0.08 || min * 0.0005;
    return [min - pad, max + pad] as [number, number];
  }, [candles]);

  const xTickFormatter = useCallback(
    (v: number) => {
      const d = new Date(v);
      if (interval === '1d' || interval === '1w') {
        return d.toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });
      }
      return d.toLocaleString('nl-NL', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    [interval],
  );

  const refreshNow = useCallback(() => {
    const ac = new AbortController();
    loadInitial(ac.signal).catch((e: unknown) => {
      if (e instanceof Error && e.name === 'AbortError') return;
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Ophalen mislukt');
    });
  }, [loadInitial]);

  const pollMs = pollMsForInterval(interval);

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-off-white tracking-tight">Live koersgrafiek</h2>
          <p className="text-[11px] font-mono text-slate-custom mt-0.5">
            Binance spot · OHLC · {intervalLabel(interval)} · {pair}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-wider mb-1">
              Pair
            </label>
            <select
              value={pair}
              onChange={(e) => setPair(e.target.value as TradePair)}
              className="bg-deep-black border border-[#1E1E28] rounded-lg px-3 py-2 text-sm text-off-white font-mono focus:outline-none focus:ring-2 focus:ring-ai-blue/40 min-w-[140px]"
            >
              {TRADE_PAIRS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-wider mb-1">
              Timeframe
            </label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as ChartKlineInterval)}
              className="bg-deep-black border border-[#1E1E28] rounded-lg px-3 py-2 text-sm text-off-white font-mono focus:outline-none focus:ring-2 focus:ring-ai-blue/40 min-w-[100px]"
            >
              {CHART_KLINE_INTERVALS.map((iv) => (
                <option key={iv} value={iv}>
                  {iv}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-wider mb-1">
              Historie
            </label>
            <select
              value={historyLimit}
              onChange={(e) => setHistoryLimit(Number(e.target.value))}
              className="bg-deep-black border border-[#1E1E28] rounded-lg px-3 py-2 text-sm text-off-white font-mono focus:outline-none focus:ring-2 focus:ring-ai-blue/40 min-w-[100px]"
            >
              {HISTORY_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} candles
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <span
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                status === 'ok' && 'bg-emerald-500',
                status === 'loading' && 'bg-amber-400',
                status === 'error' && 'bg-velocity-red',
                status === 'idle' && 'bg-slate-custom',
              )}
              aria-hidden
            />
            <span className="text-[11px] font-mono text-slate-custom max-w-[200px]">
              {status === 'loading' && 'Historie laden…'}
              {status === 'ok' && `Live · elke ${Math.round(pollMs / 1000)}s`}
              {status === 'error' && 'Fout'}
              {status === 'idle' && '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="h-[300px] w-full min-w-0">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-[#1E1E28] bg-deep-black/50">
              <p className="text-sm text-slate-custom font-mono text-center px-4">
                {status === 'loading' ? 'Eerste candles ophalen…' : 'Geen data'}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceFillLive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4B8EFF" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4B8EFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E28" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={xTickFormatter}
                  stroke="#6B82A8"
                  tick={{ fill: '#6B82A8', fontSize: 10, fontFamily: 'var(--font-ibm-plex-mono)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={yDomain ?? ['auto', 'auto']}
                  orientation="right"
                  tickFormatter={(v) => formatPrice(Number(v))}
                  stroke="#6B82A8"
                  tick={{ fill: '#6B82A8', fontSize: 10, fontFamily: 'var(--font-ibm-plex-mono)' }}
                  tickLine={false}
                  width={88}
                />
                <Tooltip content={<CandleTooltip />} cursor={{ stroke: '#4B8EFF33' }} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#4B8EFF"
                  strokeWidth={2}
                  fill="url(#priceFillLive)"
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 3, fill: '#4B8EFF' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="space-y-3 lg:border-l lg:border-[#1E1E28] lg:pl-6">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-custom">Laatste slot (EUR)</p>
            <p className="text-2xl font-semibold text-off-white tabular-nums mt-1">
              {lastPrice != null ? formatPrice(lastPrice) : '—'}
            </p>
            {lastUpdated != null && (
              <p className="text-[10px] font-mono text-slate-custom mt-1">
                {new Date(lastUpdated).toLocaleString('nl-NL')}
              </p>
            )}
          </div>
          <p className="text-[11px] text-slate-custom leading-relaxed">
            Historische candles van Binance; bij elke poll worden de laatste candles vernieuwd en verschuift de serie
            mee (max. {historyLimit} punten). Indicatief; geen beleggingsadvies.
          </p>
          {errorMessage && (
            <p className="text-[11px] text-velocity-red font-mono border border-red-900/40 rounded-lg p-2 bg-red-950/20">
              {errorMessage}
            </p>
          )}
          <button
            type="button"
            onClick={refreshNow}
            className="text-[11px] font-mono text-blue-light hover:underline"
          >
            Volledige refresh
          </button>
        </div>
      </div>
    </Card>
  );
}
