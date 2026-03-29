'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
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
  model: string,
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
        model,
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

  const [openaiState, setOpenaiState] = useState<ModelState>({ status: 'idle', content: '' });
  const [anthropicState, setAnthropicState] = useState<ModelState>({ status: 'idle', content: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setOpenaiState({ status: 'loading', content: '' });
    setAnthropicState({ status: 'loading', content: '' });

    const openaiPromise = streamAnalysis(
      'openai',
      form,
      (text) => setOpenaiState((prev) => ({ ...prev, status: 'streaming', content: prev.content + text })),
      (error) => setOpenaiState({ status: 'error', content: '', error }),
      () => setOpenaiState((prev) => ({ ...prev, status: 'done' })),
    );

    const anthropicPromise = streamAnalysis(
      'anthropic',
      form,
      (text) => setAnthropicState((prev) => ({ ...prev, status: 'streaming', content: prev.content + text })),
      (error) => setAnthropicState({ status: 'error', content: '', error }),
      () => setAnthropicState((prev) => ({ ...prev, status: 'done' })),
    );

    await Promise.all([openaiPromise, anthropicPromise]);
    setIsAnalyzing(false);
  };

  const handleReset = () => {
    setOpenaiState({ status: 'idle', content: '' });
    setAnthropicState({ status: 'idle', content: '' });
  };

  const showResults = openaiState.status !== 'idle' || anthropicState.status !== 'idle';
  const selectClass =
    'w-full bg-[#0A0A0B] border border-[#1E1E28] rounded-lg px-3 py-2.5 text-off-white text-sm focus:outline-none focus:border-ai-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold text-off-white">Trade Strategy Analyzer</h2>
            <p className="text-xs font-mono text-slate-custom mt-1">
              DUAL-AI ANALYSIS &middot; GPT-4o + CLAUDE SONNET
            </p>
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
              disabled={isAnalyzing}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TradeResult
            model="openai"
            modelLabel="GPT-4o Analysis"
            modelProvider="OpenAI"
            state={openaiState}
          />
          <TradeResult
            model="anthropic"
            modelLabel="Claude Analysis"
            modelProvider="Anthropic"
            state={anthropicState}
          />
        </div>
      )}
    </div>
  );
}
