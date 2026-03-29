'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Card from '@/components/ui/Card';

type ModelStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

interface TradeResultProps {
  modelLabel: string;
  modelProvider: string;
  state: {
    status: ModelStatus;
    content: string;
    error?: string;
  };
}

const statusConfig: Record<ModelStatus, { color: string; badge: string; badgeClass: string }> = {
  idle: {
    color: 'bg-slate-custom',
    badge: 'Idle',
    badgeClass: 'border-[#1E1E28] text-slate-custom',
  },
  loading: {
    color: 'bg-blue-light animate-pulse',
    badge: 'Connecting...',
    badgeClass: 'border-blue-light/30 text-blue-light bg-blue-light/10',
  },
  streaming: {
    color: 'bg-blue-light animate-pulse',
    badge: 'Streaming',
    badgeClass: 'border-blue-light/30 text-blue-light bg-blue-light/10',
  },
  done: {
    color: 'bg-green-500',
    badge: 'Complete',
    badgeClass: 'border-green-500/30 text-green-400 bg-green-500/10',
  },
  error: {
    color: 'bg-velocity-red',
    badge: 'Error',
    badgeClass: 'border-velocity-red/30 text-velocity-red bg-velocity-red/10',
  },
};

export default function TradeResult({ modelLabel, modelProvider, state }: TradeResultProps) {
  const cfg = statusConfig[state.status];

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-off-white leading-tight">{modelLabel}</h3>
          <p className="text-[11px] font-mono text-slate-custom">Anthropic · Claude Sonnet</p>
        </div>
        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.badgeClass}`}>
          {cfg.badge}
        </span>
      </div>

      <div className="min-h-[200px]">
        {state.status === 'idle' && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[#1E1E28] flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-custom" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-sm text-slate-custom">Ready to analyze</p>
              <p className="text-xs text-slate-custom/60 mt-1 font-mono">{modelProvider}</p>
            </div>
          </div>
        )}

        {state.status === 'loading' && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-blue-light rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-sm text-slate-custom font-mono">Analyzing market...</span>
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="p-4 bg-velocity-red/10 border border-velocity-red/30 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-velocity-red flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-velocity-red font-mono">{state.error ?? 'Analysis failed'}</p>
                <p className="text-xs text-slate-custom mt-1.5">
                  Ensure your API key is set in{' '}
                  <code className="font-mono bg-[#1E1E28] px-1 rounded text-blue-light">.env.local</code> or Vercel environment variables.
                </p>
              </div>
            </div>
          </div>
        )}

        {(state.status === 'streaming' || state.status === 'done') && state.content && (
          <div className={`ai-response text-sm leading-relaxed ${state.status === 'streaming' ? 'streaming-cursor' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </Card>
  );
}
