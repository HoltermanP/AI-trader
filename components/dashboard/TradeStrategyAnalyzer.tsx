'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { isLlmCallsEnabledClient } from '@/lib/settings-storage';
import TradeResult from './TradeResult';
import { TRADE_PAIRS } from '@/lib/crypto-pairs';

type FormState = {
  pair: string;
  timeframe: string;
  riskLevel: string;
  additionalContext: string;
};

type ModelStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

type ModelState = {
  status: ModelStatus;
  content: string;
  error?: string;
};

const TIMEFRAMES = ['15m', '1h', '4h', '1d', '1w'];
const RISK_LEVELS = ['Conservative', 'Moderate', 'Aggressive'];

async function streamAnalysis(
  formState: FormState,
  onChunk: (text: string) => void,
  onError: (error: string) => void,
  onDone: () => void,
): Promise<void> {
  try {
    const response = await fetch('/api/trade-strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pair: formState.pair,
        timeframe: formState.timeframe,
        riskLevel: formState.riskLevel,
        additionalContext: formState.additionalContext || undefined,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const err = (await response.json()) as { error?: string };
        onError(err.error ?? 'Analysis failed');
      } else {
        onError(`Request failed with status ${response.status}`);
      }
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('Failed to read response stream');
      return;
    }

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      onChunk(text);
    }

    onDone();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error occurred';
    onError(message);
  }
}

export default function TradeStrategyAnalyzer() {
  const [form, setForm] = useState<FormState>({
    pair: 'BTC/USDT',
    timeframe: '4h',
    riskLevel: 'Moderate',
    additionalContext: '',
  });

  const [analysisState, setAnalysisState] = useState<ModelState>({ status: 'idle', content: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [llmCallsEnabled, setLlmCallsEnabled] = useState(true);

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

  const handleAnalyze = async () => {
    if (!isLlmCallsEnabledClient()) return;
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisState({ status: 'loading', content: '' });

    await streamAnalysis(
      form,
      (text) => setAnalysisState((prev) => ({ ...prev, status: 'streaming', content: prev.content + text })),
      (error) => setAnalysisState({ status: 'error', content: '', error }),
      () => setAnalysisState((prev) => ({ ...prev, status: 'done' })),
    );

    setIsAnalyzing(false);
  };

  const handleReset = () => {
    setAnalysisState({ status: 'idle', content: '' });
  };

  const showResults = analysisState.status !== 'idle';
  const selectClass =
    'w-full bg-[#0A0A0B] border border-[#1E1E28] rounded-lg px-3 py-2.5 text-off-white text-sm focus:outline-none focus:border-ai-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold text-off-white">Trade Strategy Analyzer</h2>
            <p className="text-xs font-mono text-slate-custom mt-1">
              CLAUDE SONNET (ANTHROPIC)
            </p>
            <p className="text-xs text-slate-custom mt-2 max-w-2xl">
              Live Binance-koersen, RSI en MACD-stijl trend op jouw timeframe; optioneel recente headlines (zelfde aanpak als Trading Signals).
            </p>
            {!llmCallsEnabled && (
              <p className="text-sm text-amber-400/95 mt-2 max-w-2xl">
                LLM-aanroepen staan uit in Instellingen. Zet &quot;LLM-aanroepen toestaan&quot; aan om analyses te draaien.
              </p>
            )}
          </div>
          {showResults && !isAnalyzing && (
            <Button variant="outline" onClick={handleReset} className="text-xs px-3 py-1.5">
              Clear Results
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">
              Trading Pair
            </label>
            <select
              value={form.pair}
              onChange={(e) => setForm({ ...form, pair: e.target.value })}
              className={selectClass}
              disabled={isAnalyzing}
              aria-label="Trading pair"
            >
              {TRADE_PAIRS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">
              Timeframe
            </label>
            <select
              value={form.timeframe}
              onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
              className={selectClass}
              disabled={isAnalyzing}
              aria-label="Timeframe"
            >
              {TIMEFRAMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">
              Risk Level
            </label>
            <select
              value={form.riskLevel}
              onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}
              className={selectClass}
              disabled={isAnalyzing}
              aria-label="Risk level"
            >
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !llmCallsEnabled}
              variant="primary"
              className="w-full"
              aria-label="Run trade strategy analysis"
            >
              {isAnalyzing ? (
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
                  Analyzing...
                </span>
              ) : (
                'Analyze Strategy'
              )}
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">
            Additional Context <span className="normal-case text-[9px]">(optional)</span>
          </label>
          <textarea
            value={form.additionalContext}
            onChange={(e) => setForm({ ...form, additionalContext: e.target.value })}
            placeholder="e.g. Recent news, current market sentiment, on-chain signals, specific indicators to focus on..."
            rows={3}
            className="w-full bg-[#0A0A0B] border border-[#1E1E28] rounded-lg px-3 py-2.5 text-off-white text-sm placeholder-slate-custom/60 focus:outline-none focus:border-ai-blue transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isAnalyzing}
            aria-label="Additional context for analysis"
          />
        </div>
      </Card>

      {showResults && (
        <TradeResult
          modelLabel="Claude-analyse"
          modelProvider="Anthropic"
          state={analysisState}
        />
      )}
    </div>
  );
}
