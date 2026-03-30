'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { ScoredHeadline } from '@/lib/news/headlines';

type ApiOk = {
  fetchedAt: string;
  items: ScoredHeadline[];
  sourcesUsed: string[];
  fetchedBeforeFilter: number;
};

type PanelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: ApiOk }
  | { status: 'error'; message: string };

function formatNlTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function CryptoImpactNewsPanel() {
  const [state, setState] = useState<PanelState>({ status: 'idle' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/crypto-news');
      const data = (await res.json()) as ApiOk & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setState({ status: 'done', data });
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Laden mislukt',
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-off-white tracking-tight">Impact-nieuws</h2>
          <p className="mt-1 text-xs font-mono text-slate-custom leading-relaxed max-w-xl">
            Alleen items met duidelijke band aan macro, rente, regulering, geopolitiek, banken,
            cryptostress, energie of tarieven. Geen rankings op basis van koers — wel een streng
            woordfilter om ruis te verminderen.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 self-start"
          onClick={() => void load()}
          disabled={state.status === 'loading'}
        >
          {state.status === 'loading' ? 'Laden…' : 'Vernieuwen'}
        </Button>
      </div>

      {state.status === 'error' && (
        <p className="mt-4 text-sm text-[#FF8A70]" role="alert">
          {state.message}
        </p>
      )}

      {state.status === 'done' && (
        <>
          <p className="mt-4 text-[11px] font-mono text-slate-custom/90">
            {state.data.items.length > 0 ?
              <>
                {state.data.items.length} van {state.data.fetchedBeforeFilter} headlines · Bron:{' '}
                {state.data.sourcesUsed.join(', ')} · {formatNlTime(state.data.fetchedAt)}
              </>
            : <>
                Geen impact-headlines nu ({state.data.fetchedBeforeFilter} ruwe items opgehaald).
              </>
            }
          </p>

          {state.data.items.length > 0 && (
            <ul className="mt-4 space-y-3 border-t border-[#1E1E28] pt-4">
              {state.data.items.map((item, i) => (
                <li key={`${item.title.slice(0, 48)}-${i}`} className="text-sm">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {item.impactCategories.slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-light/10 text-blue-light border border-blue-light/25"
                      >
                        {c}
                      </span>
                    ))}
                    <span className="text-[10px] font-mono text-slate-custom/80 ml-auto tabular-nums">
                      score {item.impactScore}
                    </span>
                  </div>
                  {item.url ?
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-off-white/95 hover:text-blue-light transition-colors font-medium leading-snug"
                    >
                      {item.title}
                    </a>
                  : <span className="text-off-white/95 font-medium leading-snug">{item.title}</span>}
                  {item.publishedAt && (
                    <p className="mt-1 text-[11px] font-mono text-slate-custom">
                      {item.publishedAt}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
