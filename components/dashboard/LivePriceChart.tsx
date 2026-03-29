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

const MAX_POINTS = 180;
/** Eén punt per minuut */
const POLL_MS = 60_000;

export const PAIRS = [
  { id: 'btcusdt', label: 'BTC / USDT', short: 'BTC' },
  { id: 'ethusdt', label: 'ETH / USDT', short: 'ETH' },
  { id: 'solusdt', label: 'SOL / USDT', short: 'SOL' },
] as const;

type PairId = (typeof PAIRS)[number]['id'];

type Point = { t: number; price: number };

function formatPrice(n: number) {
  if (n >= 1000) return n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export default function LivePriceChart() {
  const [pair, setPair] = useState<PairId>('btcusdt');
  const [points, setPoints] = useState<Point[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchMinutePrice = useCallback(
    async (signal: AbortSignal, options?: { initial?: boolean }) => {
      const initial = options?.initial ?? false;
      if (initial) {
        setStatus('loading');
        setErrorMessage(null);
        setPoints([]);
        setLastPrice(null);
      }

      const symbol = pair.toUpperCase();
      const res = await fetch(`/api/binance-price?symbol=${encodeURIComponent(symbol)}`, {
        signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === 'string' ? err.error : 'Ophalen mislukt');
      }

      const data = (await res.json()) as { price: string };
      const price = parseFloat(data.price);
      if (Number.isNaN(price)) throw new Error('Ongeldige prijs');

      const t = Date.now();
      setLastPrice(price);
      setPoints((prev) => {
        const next = [...prev, { t, price }];
        if (next.length > MAX_POINTS) return next.slice(-MAX_POINTS);
        return next;
      });
      setStatus('ok');
    },
    [pair],
  );

  useEffect(() => {
    const ac = new AbortController();

    const run = (initial: boolean) => {
      fetchMinutePrice(ac.signal, { initial }).catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : 'Ophalen mislukt');
      });
    };

    run(true);
    const id = window.setInterval(() => run(false), POLL_MS);

    return () => {
      ac.abort();
      window.clearInterval(id);
    };
  }, [pair, fetchMinutePrice]);

  const chartData = useMemo(
    () =>
      points.map((p) => ({
        t: p.t,
        price: p.price,
        timeLabel: new Date(p.t).toLocaleString('nl-NL', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    [points],
  );

  const yDomain = useMemo(() => {
    if (points.length < 2) return undefined;
    const vals = points.map((p) => p.price);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.08 || min * 0.0005;
    return [min - pad, max + pad] as [number, number];
  }, [points]);

  const pairLabel = PAIRS.find((p) => p.id === pair)?.label ?? pair;

  const refreshNow = useCallback(() => {
    const ac = new AbortController();
    fetchMinutePrice(ac.signal, { initial: false }).catch((e: unknown) => {
      if (e instanceof Error && e.name === 'AbortError') return;
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Ophalen mislukt');
    });
  }, [fetchMinutePrice]);

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-off-white tracking-tight">Koers (per minuut)</h2>
          <p className="text-[11px] font-mono text-slate-custom mt-0.5">
            Binance spotprijs · één waarde per minuut · {pairLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[11px] font-mono text-slate-custom sr-only" htmlFor="pair-select">
            Handelspaar
          </label>
          <select
            id="pair-select"
            value={pair}
            onChange={(e) => setPair(e.target.value as PairId)}
            className="bg-deep-black border border-[#1E1E28] rounded-lg px-3 py-2 text-sm text-off-white font-mono focus:outline-none focus:ring-2 focus:ring-ai-blue/40"
          >
            {PAIRS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
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
            <span className="text-[11px] font-mono text-slate-custom">
              {status === 'loading' && 'Laden…'}
              {status === 'ok' && 'Bijgewerkt elke min'}
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
                {status === 'loading' ? 'Eerste koers ophalen…' : 'Geen data'}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4B8EFF" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4B8EFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E28" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v) =>
                    new Date(v as number).toLocaleString('nl-NL', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111116',
                    border: '1px solid #1E1E28',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-ibm-plex-mono)',
                  }}
                  labelStyle={{ color: '#6B82A8' }}
                  formatter={(value) => [
                    typeof value === 'number' ? formatPrice(value) : '—',
                    'Prijs',
                  ]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { timeLabel?: string } | undefined;
                    return row?.timeLabel ?? '';
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#4B8EFF"
                  strokeWidth={2}
                  fill="url(#priceFill)"
                  isAnimationActive={false}
                  dot={{ r: 2, fill: '#4B8EFF', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="space-y-3 lg:border-l lg:border-[#1E1E28] lg:pl-6">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-custom">Laatste prijs (USDT)</p>
            <p className="text-2xl font-semibold text-off-white tabular-nums mt-1">
              {lastPrice != null ? formatPrice(lastPrice) : '—'}
            </p>
          </div>
          <p className="text-[11px] text-slate-custom leading-relaxed">
            Maximaal {MAX_POINTS} punten ({Math.floor(MAX_POINTS / 60)} uur geschiedenis bij 1 punt/min). Indicatief;
            geen beleggingsadvies.
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
            Nu ophalen
          </button>
        </div>
      </div>
    </Card>
  );
}
