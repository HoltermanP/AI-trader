'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { TRADE_PAIRS } from '@/lib/crypto-pairs';
import { isLlmCallsEnabledClient } from '@/lib/settings-storage';
import type {
  PairSignal,
  SignalDirection,
  TradingSignalsMeta,
  TradingSignalsUsage,
} from '@/lib/trading-signals';

const TIMEFRAMES = ['15m', '1h', '4h', '1d', '1w'];
const RISK_LEVELS = ['Conservative', 'Moderate', 'Aggressive'];
const REFRESH_MS = 15 * 60 * 1000;

type PanelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; signals: PairSignal[]; usage?: TradingSignalsUsage }
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

function signalToKrakenSide(signal: SignalDirection): 'buy' | 'sell' | null {
  if (signal === 'BUY') return 'buy';
  if (signal === 'SELL') return 'sell';
  return null;
}

async function fetchSignals(
  timeframe: string,
  riskLevel: string,
  additionalContext: string,
): Promise<{ signals: PairSignal[]; meta: TradingSignalsMeta; usage?: TradingSignalsUsage }> {
  const response = await fetch('/api/trading-signals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeframe,
      riskLevel,
      additionalContext: additionalContext || undefined,
    }),
  });

  const data = (await response.json()) as {
    signals?: PairSignal[];
    meta?: TradingSignalsMeta;
    usage?: TradingSignalsUsage;
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

  return { signals: data.signals, meta, usage: data.usage };
}

function formatUsd(n: number): string {
  if (n < 0.0001) return n.toExponential(2);
  if (n < 0.01) return n.toFixed(4);
  return n.toFixed(3);
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
  const [signalsState, setSignalsState] = useState<PanelState>({ status: 'idle' });
  const [isLoading, setIsLoading] = useState(false);
  const [bgRefresh, setBgRefresh] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastMeta, setLastMeta] = useState<TradingSignalsMeta | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [llmCallsEnabled, setLlmCallsEnabled] = useState(true);
  const [sessionSignalsCostUsd, setSessionSignalsCostUsd] = useState(0);
  const [krakenNotionalUsdt, setKrakenNotionalUsdt] = useState('25');
  const [krakenExecutingPair, setKrakenExecutingPair] = useState<string | null>(null);
  const [krakenFeedback, setKrakenFeedback] = useState<{
    pair: string;
    ok: boolean;
    message: string;
  } | null>(null);

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

  useEffect(() => {
    const sync = () => setLlmCallsEnabled(isLlmCallsEnabledClient());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('ai-trader-settings-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('ai-trader-settings-updated', sync);
    };
  }, []);

  useEffect(() => {
    if (!llmCallsEnabled) {
      setNextRefreshAt(null);
    }
  }, [llmCallsEnabled]);

  const scheduleNext = useCallback(() => {
    setNextRefreshAt(Date.now() + REFRESH_MS);
  }, []);

  const runFetch = useCallback(
    async (mode: 'manual' | 'auto') => {
      if (!isLlmCallsEnabledClient()) return;
      if (busyRef.current) return;
      busyRef.current = true;

      const manual = mode === 'manual';
      if (manual) {
        setIsLoading(true);
        setSignalsState({ status: 'loading' });
      } else {
        setBgRefresh(true);
      }

      const f = formRef.current;

      try {
        const result = await fetchSignals(f.timeframe, f.riskLevel, f.additionalContext);
        setSignalsState({
          status: 'done',
          signals: result.signals,
          usage: result.usage,
        });
        setLastMeta(result.meta);
        const runCost = result.usage?.estimatedUsd ?? 0;
        if (runCost > 0) setSessionSignalsCostUsd((s) => s + runCost);
        scheduleNext();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Anthropic (Claude)-verzoek mislukt';
        setSignalsState({ status: 'error', message: msg });
      } finally {
        busyRef.current = false;
        setIsLoading(false);
        setBgRefresh(false);
      }
    },
    [scheduleNext],
  );

  useEffect(() => {
    if (!nextRefreshAt || !autoRefresh || !llmCallsEnabled) {
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
  }, [nextRefreshAt, autoRefresh, llmCallsEnabled]);

  useEffect(() => {
    if (!autoRefresh || nextRefreshAt == null || !llmCallsEnabled) return;

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
  }, [nextRefreshAt, autoRefresh, runFetch, scheduleNext, llmCallsEnabled]);

  useEffect(() => {
    const onVis = () => {
      if (!isLlmCallsEnabledClient()) return;
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
    setSignalsState({ status: 'idle' });
    setLastMeta(null);
    setNextRefreshAt(null);
    setSessionSignalsCostUsd(0);
  };

  const handleAutoToggle = (on: boolean) => {
    setAutoRefresh(on);
    if (on && signalsState.status === 'done') {
      scheduleNext();
    }
    if (!on) {
      setNextRefreshAt(null);
      setCountdown('');
    }
  };

  const executeKrakenForRow = useCallback(async (row: PairSignal) => {
    const side = signalToKrakenSide(row.signal);
    if (!side) return;

    const notional = Number(krakenNotionalUsdt.replace(',', '.'));
    if (!Number.isFinite(notional) || notional <= 0) {
      setKrakenFeedback({
        pair: row.pair,
        ok: false,
        message: 'Vul een geldig bedrag in USDT in.',
      });
      return;
    }

    const ok = window.confirm(
      `Kraken Spot (${side === 'buy' ? 'kopen' : 'verkopen'}): ongeveer ${notional} USDT aan ${row.pair} — doorgaan?`,
    );
    if (!ok) return;

    setKrakenExecutingPair(row.pair);
    setKrakenFeedback(null);

    try {
      const response = await fetch('/api/execute-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair: row.pair,
          side,
          notionalUsd: notional,
          source: 'signals-panel',
          confidence: row.confidence,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        order?: { txid?: string[]; descr_order?: string };
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      const tx = data.order?.txid?.[0];
      setKrakenFeedback({
        pair: row.pair,
        ok: true,
        message: tx ? `Order geplaatst (txid: ${tx}).` : (data.order?.descr_order ?? 'Order geplaatst.'),
      });
    } catch (e) {
      setKrakenFeedback({
        pair: row.pair,
        ok: false,
        message: e instanceof Error ? e.message : 'Kraken-aanroep mislukt.',
      });
    } finally {
      setKrakenExecutingPair(null);
    }
  }, [krakenNotionalUsdt]);

  const selectClass =
    'w-full bg-[#0A0A0B] border border-[#1E1E28] rounded-lg px-3 py-2.5 text-off-white text-sm focus:outline-none focus:border-ai-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const showAnyResult = signalsState.status !== 'idle';

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-semibold text-off-white">Koop- en verkoopsignalen</h2>
            <p className="text-xs font-mono text-slate-custom mt-1">
              {TRADE_PAIRS.length} CRYPTOCURRENCY-PAREN &middot; BINANCE + INDICATOREN + NIEUWS &middot; CLAUDE (ANTHROPIC)
            </p>
            <p className="text-sm text-slate-custom mt-2 max-w-3xl">
              Signalen gebruiken actuele koersen (24u), RSI(14) en MACD-stijl trend op de gekozen timeframe, plus
              recente headlines (o.a. crypto, macro, Trump/tarieven, olie, geopolitiek) via Google News RSS.
              Optioneel: stel <span className="font-mono text-off-white/80">NEWSAPI_KEY</span> in voor extra artikelen.
              Live X/Twitter-posts zitten niet standaard in de feed (vereist aparte API).
            </p>
            {!llmCallsEnabled && (
              <p className="text-sm text-amber-400/95 mt-3 max-w-3xl">
                LLM-aanroepen staan uit in Instellingen. Schakel ze in om signalen te genereren, of zet op de server{' '}
                <span className="font-mono text-off-white/90">DISABLE_LLM_CALLS</span> om te controleren of de server blokkeert.
              </p>
            )}
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
            {(lastMeta || sessionSignalsCostUsd > 0) && (
              <p
                className="text-xs font-mono text-slate-custom mt-2"
                title="Geschat op basis van token-tellingen per aanroep; tarieven in lib/llm-cost.ts"
              >
                Sessie (signalen), geschat:{' '}
                <span className="text-off-white/90">${formatUsd(sessionSignalsCostUsd)}</span> USD
              </p>
            )}
            {autoRefresh && nextRefreshAt != null && countdown && llmCallsEnabled && (
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
                disabled={!llmCallsEnabled}
                className="rounded border-[#1E1E28] bg-[#0A0A0B] text-ai-blue focus:ring-ai-blue/40 disabled:opacity-40"
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
              disabled={isLoading || !llmCallsEnabled}
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
        <SignalsTable
          title="Claude Sonnet"
          subtitle="Anthropic"
          state={signalsState}
          krakenNotionalUsdt={krakenNotionalUsdt}
          onKrakenNotionalChange={setKrakenNotionalUsdt}
          krakenExecutingPair={krakenExecutingPair}
          krakenFeedback={krakenFeedback}
          onExecuteKraken={executeKrakenForRow}
        />
      )}
    </div>
  );
}

function SignalsTable({
  title,
  subtitle,
  state,
  krakenNotionalUsdt,
  onKrakenNotionalChange,
  krakenExecutingPair,
  krakenFeedback,
  onExecuteKraken,
}: {
  title: string;
  subtitle: string;
  state: PanelState;
  krakenNotionalUsdt: string;
  onKrakenNotionalChange: (v: string) => void;
  krakenExecutingPair: string | null;
  krakenFeedback: { pair: string; ok: boolean; message: string } | null;
  onExecuteKraken: (row: PairSignal) => void | Promise<void>;
}) {
  const inputClass =
    'w-full max-w-[7rem] bg-[#0A0A0B] border border-[#1E1E28] rounded-lg px-2 py-1.5 text-off-white text-sm focus:outline-none focus:border-ai-blue';

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
          {state.usage && (
            <p className="text-[11px] font-mono text-slate-custom mb-3 pb-3 border-b border-[#1E1E28]/80">
              Tokens: in {state.usage.promptTokens.toLocaleString('nl-NL')} · uit{' '}
              {state.usage.completionTokens.toLocaleString('nl-NL')} · totaal{' '}
              {state.usage.totalTokens.toLocaleString('nl-NL')}
              <span className="text-[#1E1E28] mx-2">|</span>
              Geschat: <span className="text-emerald-400/90">${formatUsd(state.usage.estimatedUsd)}</span> USD (
              {state.usage.model})
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4 p-3 rounded-lg bg-[#0A0A0B] border border-[#1E1E28]/90">
            <div>
              <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-1.5">
                Bedrag per order (USDT)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={krakenNotionalUsdt}
                onChange={(e) => onKrakenNotionalChange(e.target.value)}
                className={inputClass}
                aria-label="Orderbedrag in USDT voor Kraken"
              />
            </div>
            <p className="text-xs text-slate-custom leading-relaxed max-w-xl pb-0.5">
              Uitvoering gaat via je server naar{' '}
              <span className="font-mono text-off-white/85">/api/execute-trade</span> (Kraken Spot). Limiet en toegestane
              paren staan in <span className="font-mono text-off-white/85">AUTO_TRADING_*</span>; zet{' '}
              <span className="font-mono text-off-white/85">AUTO_TRADING_ENABLED=true</span> alleen als je dit bewust
              wilt.
            </p>
          </div>

          {krakenFeedback && (
            <p
              className={`text-sm mb-3 font-mono ${krakenFeedback.ok ? 'text-emerald-400/95' : 'text-[#FF8A70]'}`}
              role="status"
            >
              [{krakenFeedback.pair}] {krakenFeedback.message}
            </p>
          )}

          <table className="w-full text-sm text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-[#1E1E28] text-[10px] font-mono text-slate-custom uppercase tracking-[0.1em]">
                <th className="py-2 pr-3 font-normal">Pair</th>
                <th className="py-2 pr-3 font-normal">Signaal</th>
                <th className="py-2 pr-3 font-normal">Vertrouwen</th>
                <th className="py-2 pr-3 font-normal">Kraken</th>
                <th className="py-2 font-normal">Toelichting</th>
              </tr>
            </thead>
            <tbody>
              {state.signals.map((row) => {
                const side = signalToKrakenSide(row.signal);
                const busy = krakenExecutingPair === row.pair;
                return (
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
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {side ? (
                        <Button
                          type="button"
                          variant="primary"
                          className="text-[11px] px-2.5 py-1 min-w-0"
                          disabled={busy}
                          onClick={() => void onExecuteKraken(row)}
                          aria-label={`Uitvoeren op Kraken: ${row.pair} ${side}`}
                        >
                          {busy ? '…' : 'Kraken'}
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-custom font-mono">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-slate-custom/95 text-xs leading-snug">{row.rationale}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
