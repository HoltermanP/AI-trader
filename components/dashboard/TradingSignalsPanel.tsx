'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { TRADE_PAIRS } from '@/lib/crypto-pairs';
import type { PairSignal, SignalDirection, TradingSignalsMeta } from '@/lib/trading-signals';

const TIMEFRAMES = ['15m', '1h', '4h', '1d', '1w'];
const RISK_LEVELS = ['Conservative', 'Moderate', 'Aggressive'];
const REFRESH_MS = 15 * 60 * 1000;

type ModelKey = 'openai' | 'anthropic';

type PanelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; signals: PairSignal[] }
  | { status: 'error'; message: string };

function signalBadgeClasses(signal: SignalDirection): string {
  switch (signal) {
    case 'BUY':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
    case 'SELL':
      return 'bg-velocity-red/15 text-[#FF8A70] border-velocity-red/40';
    default:
      return 'bg-amber-500/10 text-amber-300/90 border-amber-500/35';
  }
}

function signalLabelNl(signal: SignalDirection): string {
  switch (signal) {
    case 'BUY':
      return 'Koop';
    case 'SELL':
      return 'Verkoop';
    default:
      return 'Neutraal';
  }
}

async function fetchSignals(
  model: ModelKey,
  timeframe: string,
  riskLevel: string,
  additionalContext: string,
): Promise<{ signals: PairSignal[]; meta: TradingSignalsMeta }> {
  const response = await fetch('/api/trading-signals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      timeframe,
      riskLevel,
      additionalContext: additionalContext || undefined,
    }),
  });

  const data = (await response.json()) as {
    signals?: PairSignal[];
    meta?: TradingSignalsMeta;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }

  if (!data.signals || !Array.isArray(data.signals)) {
    throw new Error('Ongeldig antwoord van de server.');
  }

  const meta: TradingSignalsMeta = data.meta ?? {
    generatedAt: new Date().toISOString(),
    marketDataOk: false,
    headlineCount: 0,
    newsSources: [],
    chartInterval: timeframe,
  };

  return { signals: data.signals, meta };
}

function formatNlTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('nl-NL', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return iso;
  }
}

export default function TradingSignalsPanel() {
  const [timeframe, setTimeframe] = useState('15m');
  const [riskLevel, setRiskLevel] = useState('Moderate');
  const [additionalContext, setAdditionalContext] = useState('');
  const [openaiState, setOpenaiState] = useState<PanelState>({ status: 'idle' });
  const [anthropicState, setAnthropicState] = useState<PanelState>({ status: 'idle' });
  const [isLoading, setIsLoading] = useState(false);
  const [bgRefresh, setBgRefresh] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastMeta, setLastMeta] = useState<TradingSignalsMeta | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  const busyRef = useRef(false);
  const autoRefreshRef = useRef(autoRefresh);
  const nextRefreshAtRef = useRef<number | null>(null);
  const formRef = useRef({ timeframe, riskLevel, additionalContext });

  useEffect(() => {
    autoRefreshRef.current = autoRefresh;
  }, [autoRefresh]);

  useEffect(() => {
    nextRefreshAtRef.current = nextRefreshAt;
  }, [nextRefreshAt]);

  useEffect(() => {
    formRef.current = { timeframe, riskLevel, additionalContext };
  }, [timeframe, riskLevel, additionalContext]);

  const scheduleNext = useCallback(() => {
    setNextRefreshAt(Date.now() + REFRESH_MS);
  }, []);

  const runFetch = useCallback(
    async (mode: 'manual' | 'auto') => {
      if (busyRef.current) return;
      busyRef.current = true;

      const manual = mode === 'manual';
      if (manual) {
        setIsLoading(true);
        setOpenaiState({ status: 'loading' });
        setAnthropicState({ status: 'loading' });
      } else {
        setBgRefresh(true);
      }

      const f = formRef.current;

      try {
        const settled = await Promise.allSettled([
          fetchSignals('openai', f.timeframe, f.riskLevel, f.additionalContext),
          fetchSignals('anthropic', f.timeframe, f.riskLevel, f.additionalContext),
        ]);

        const [oRes, aRes] = settled;

        if (oRes.status === 'fulfilled') {
          setOpenaiState({ status: 'done', signals: oRes.value.signals });
          setLastMeta(oRes.value.meta);
        } else {
          const msg = oRes.reason instanceof Error ? oRes.reason.message : 'OpenAI-verzoek mislukt';
          setOpenaiState({ status: 'error', message: msg });
        }

        if (aRes.status === 'fulfilled') {
          setAnthropicState({ status: 'done', signals: aRes.value.signals });
          if (oRes.status !== 'fulfilled') setLastMeta(aRes.value.meta);
        } else {
          const msg = aRes.reason instanceof Error ? aRes.reason.message : 'Anthropic-verzoek mislukt';
          setAnthropicState({ status: 'error', message: msg });
        }

        if (oRes.status === 'fulfilled' || aRes.status === 'fulfilled') {
          scheduleNext();
        }
      } finally {
        busyRef.current = false;
        setIsLoading(false);
        setBgRefresh(false);
      }
    },
    [scheduleNext],
  );

  useEffect(() => {
    if (!nextRefreshAt || !autoRefresh) {
      setCountdown('');
      return;
    }
    const tick = () => {
      const left = Math.max(0, nextRefreshAt - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRefreshAt, autoRefresh]);

  useEffect(() => {
    if (!autoRefresh || nextRefreshAt == null) return;

    const delay = Math.max(0, nextRefreshAt - Date.now());
    const id = window.setTimeout(() => {
      if (!autoRefreshRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        scheduleNext();
        return;
      }
      if (!busyRef.current) {
        void runFetch('auto');
      } else {
        scheduleNext();
      }
    }, delay);

    return () => window.clearTimeout(id);
  }, [nextRefreshAt, autoRefresh, runFetch, scheduleNext]);

  useEffect(() => {
    const onVis = () => {
      const target = nextRefreshAtRef.current;
      if (document.visibilityState !== 'visible' || !autoRefreshRef.current || target == null) return;
      const late = Date.now() > target + 2000;
      if (late && !busyRef.current) {
        void runFetch('auto');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [runFetch]);

  const handleGenerate = () => void runFetch('manual');

  const handleReset = () => {
    setOpenaiState({ status: 'idle' });
    setAnthropicState({ status: 'idle' });
    setLastMeta(null);
    setNextRefreshAt(null);
  };

  const handleAutoToggle = (on: boolean) => {
    setAutoRefresh(on);
    if (on && (openaiState.status === 'done' || anthropicState.status === 'done')) {
      scheduleNext();
    }
    if (!on) {
      setNextRefreshAt(null);
      setCountdown('');
    }
  };

  const selectClass =
    'w-full bg-[#0A0A0B] border border-[#1E1E28] rounded-lg px-3 py-2.5 text-off-white text-sm focus:outline-none focus:border-ai-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const showAnyResult =
    openaiState.status !== 'idle' ||
    anthropicState.status !== 'idle';

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-semibold text-off-white">Koop- en verkoopsignalen</h2>
            <p className="text-xs font-mono text-slate-custom mt-1">
              {TRADE_PAIRS.length} CRYPTOCURRENCY-PAREN &middot; BINANCE + INDICATOREN + NIEUWS &middot; GPT-4o + CLAUDE
            </p>
            <p className="text-sm text-slate-custom mt-2 max-w-3xl">
              Signalen gebruiken actuele koersen (24u), RSI(14) en MACD-stijl trend op de gekozen timeframe, plus
              recente headlines (o.a. crypto, macro, Trump/tarieven, olie, geopolitiek) via Google News RSS.
              Optioneel: stel <span className="font-mono text-off-white/80">NEWSAPI_KEY</span> in voor extra artikelen.
              Live X/Twitter-posts zitten niet standaard in de feed (vereist aparte API).
            </p>
            {lastMeta && (
              <p className="text-xs font-mono text-slate-custom mt-3 space-x-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  Laatste run:{' '}
                  <span className="text-off-white/90">{formatNlTime(lastMeta.generatedAt)}</span>
                </span>
                <span className="text-[#1E1E28]">|</span>
                <span>
                  Marktdata:{' '}
                  <span className={lastMeta.marketDataOk ? 'text-emerald-400/90' : 'text-amber-400/90'}>
                    {lastMeta.marketDataOk ? 'OK' : 'deels onvolledig'}
                  </span>
                </span>
                <span className="text-[#1E1E28]">|</span>
                <span>
                  Headlines: <span className="text-off-white/90">{lastMeta.headlineCount}</span>
                </span>
                <span className="text-[#1E1E28]">|</span>
                <span>
                  Candle-interval:{' '}
                  <span className="text-off-white/90">{lastMeta.chartInterval}</span>
                </span>
                {bgRefresh && (
                  <>
                    <span className="text-[#1E1E28]">|</span>
                    <span className="text-ai-blue">Achtergrondverversing…</span>
                  </>
                )}
              </p>
            )}
            {autoRefresh && nextRefreshAt != null && countdown && (
              <p className="text-xs text-slate-custom mt-1">
                Volgende automatische update over <span className="text-off-white font-mono">{countdown}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <label className="flex items-center gap-2 text-xs text-slate-custom cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => handleAutoToggle(e.target.checked)}
                className="rounded border-[#1E1E28] bg-[#0A0A0B] text-ai-blue focus:ring-ai-blue/40"
                aria-label="Automatisch elke 15 minuten verversen"
              />
              Elke 15 min automatisch verversen
            </label>
            {showAnyResult && !isLoading && (
              <Button variant="outline" onClick={handleReset} className="text-xs px-3 py-1.5">
                Wis resultaten
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">
              Timeframe (candles / indicatoren)
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className={selectClass}
              disabled={isLoading}
              aria-label="Timeframe"
            >
              {TIMEFRAMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">
              Risiconiveau
            </label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className={selectClass}
              disabled={isLoading}
              aria-label="Risiconiveau"
            >
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-2 flex flex-col justify-end">
            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              variant="primary"
              className="w-full"
              aria-label="Genereer signalen voor alle paren"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1 h-1 bg-white rounded-full animate-bounce inline-block"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                  Signalen ophalen…
                </span>
              ) : (
                'Genereer signalen (10 crypto’s)'
              )}
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">
            Extra context <span className="normal-case text-[9px]">(optioneel)</span>
          </label>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Bijv. eigen theses, specifieke events om te benadrukken…"
            rows={2}
            className="w-full bg-[#0A0A0B] border border-[#1E1E28] rounded-lg px-3 py-2.5 text-off-white text-sm placeholder-slate-custom/60 focus:outline-none focus:border-ai-blue transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
            aria-label="Extra context voor signalen"
          />
        </div>
      </Card>

      {showAnyResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SignalsTable title="GPT-4o" subtitle="OpenAI" state={openaiState} />
          <SignalsTable title="Claude Sonnet" subtitle="Anthropic" state={anthropicState} />
        </div>
      )}
    </div>
  );
}

function SignalsTable({
  title,
  subtitle,
  state,
}: {
  title: string;
  subtitle: string;
  state: PanelState;
}) {
  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-off-white">{title}</h3>
        <p className="text-[10px] font-mono text-slate-custom uppercase tracking-[0.12em]">{subtitle}</p>
      </div>

      {state.status === 'idle' && (
        <p className="text-sm text-slate-custom">Nog geen signalen. Klik op genereren.</p>
      )}

      {state.status === 'loading' && <p className="text-sm text-slate-custom">Laden…</p>}

      {state.status === 'error' && <p className="text-sm text-[#FF8A70]">{state.message}</p>}

      {state.status === 'done' && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm text-left border-collapse min-w-[320px]">
            <thead>
              <tr className="border-b border-[#1E1E28] text-[10px] font-mono text-slate-custom uppercase tracking-[0.1em]">
                <th className="py-2 pr-3 font-normal">Pair</th>
                <th className="py-2 pr-3 font-normal">Signaal</th>
                <th className="py-2 pr-3 font-normal">Vertrouwen</th>
                <th className="py-2 font-normal">Toelichting</th>
              </tr>
            </thead>
            <tbody>
              {state.signals.map((row) => (
                <tr key={row.pair} className="border-b border-[#1E1E28]/80 align-top">
                  <td className="py-2.5 pr-3 font-mono text-off-white whitespace-nowrap">{row.pair}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-mono uppercase tracking-wide ${signalBadgeClasses(row.signal)}`}
                    >
                      {signalLabelNl(row.signal)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-custom whitespace-nowrap">{row.confidence}</td>
                  <td className="py-2.5 text-slate-custom/95 text-xs leading-snug">{row.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
