'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

type PreferredModel = 'openai' | 'anthropic';

type Settings = {
  defaultPair: string;
  defaultTimeframe: string;
  defaultRiskLevel: string;
  preferredModels: PreferredModel[];
};

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT', 'AVAX/USDT', 'LINK/USDT'];
const TIMEFRAMES = ['15m', '1h', '4h', '1d', '1w'];
const RISK_LEVELS = ['Conservative', 'Moderate', 'Aggressive'];

const selectClass =
  'w-full bg-[#0A0A0B] border border-[#1E1E28] rounded-lg px-3 py-2.5 text-off-white text-sm focus:outline-none focus:border-ai-blue transition-colors';

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings>({
    defaultPair: 'BTC/USDT',
    defaultTimeframe: '4h',
    defaultRiskLevel: 'Moderate',
    preferredModels: ['openai', 'anthropic'],
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-trader-settings', JSON.stringify(settings));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleModel = (model: PreferredModel) => {
    setSettings((prev) => ({
      ...prev,
      preferredModels: prev.preferredModels.includes(model)
        ? prev.preferredModels.filter((m) => m !== model)
        : [...prev.preferredModels, model],
    }));
  };

  const aiModels: { id: PreferredModel; label: string; provider: string; desc: string }[] = [
    { id: 'openai', label: 'GPT-4o', provider: 'OpenAI', desc: 'Advanced reasoning, strong with pattern recognition and market structure' },
    { id: 'anthropic', label: 'Claude Sonnet', provider: 'Anthropic', desc: 'Nuanced analysis with detailed risk assessment and scenario planning' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* AI Models */}
      <Card>
        <h2 className="text-lg font-semibold text-off-white mb-1">AI Models</h2>
        <p className="text-sm text-slate-custom mb-5">
          Select which models power your trade strategy analysis.
        </p>

        <div className="space-y-3">
          {aiModels.map((model) => {
            const isSelected = settings.preferredModels.includes(model.id);
            return (
              <button
                key={model.id}
                onClick={() => toggleModel(model.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'border-ai-blue/50 bg-ai-blue/10'
                    : 'border-[#1E1E28] bg-[#0A0A0B] hover:border-[#2E2E38]'
                }`}
                aria-pressed={isSelected}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'border-ai-blue bg-ai-blue' : 'border-[#3E3E4E]'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-off-white text-sm">{model.label}</p>
                  <p className="text-xs text-slate-custom font-mono mt-0.5">
                    {model.provider} &middot; {model.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Trading Defaults */}
      <Card>
        <h2 className="text-lg font-semibold text-off-white mb-1">Trading Defaults</h2>
        <p className="text-sm text-slate-custom mb-5">
          Pre-fill the analyzer with your most-used parameters.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">
              Default Pair
            </label>
            <select
              value={settings.defaultPair}
              onChange={(e) => setSettings({ ...settings, defaultPair: e.target.value })}
              className={selectClass}
              aria-label="Default trading pair"
            >
              {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">
              Default Timeframe
            </label>
            <select
              value={settings.defaultTimeframe}
              onChange={(e) => setSettings({ ...settings, defaultTimeframe: e.target.value })}
              className={selectClass}
              aria-label="Default timeframe"
            >
              {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-custom uppercase tracking-[0.15em] mb-2">
              Default Risk Level
            </label>
            <select
              value={settings.defaultRiskLevel}
              onChange={(e) => setSettings({ ...settings, defaultRiskLevel: e.target.value })}
              className={selectClass}
              aria-label="Default risk level"
            >
              {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* API Keys */}
      <Card>
        <h2 className="text-lg font-semibold text-off-white mb-1">API Keys</h2>
        <p className="text-sm text-slate-custom mb-5">
          Keys are loaded from environment variables — never stored in the browser.
        </p>

        <div className="space-y-2.5">
          {[
            { label: 'OpenAI API Key', env: 'OPENAI_API_KEY', required: true },
            { label: 'Anthropic API Key', env: 'ANTHROPIC_API_KEY', required: true },
          ].map((item) => (
            <div
              key={item.env}
              className="flex items-center justify-between p-3.5 bg-[#0A0A0B] border border-[#1E1E28] rounded-lg"
            >
              <div>
                <p className="text-sm text-off-white font-medium">{item.label}</p>
                <p className="text-[11px] font-mono text-slate-custom mt-0.5">{item.env}</p>
              </div>
              <span className="text-[10px] font-mono text-slate-custom px-2 py-1 bg-[#1E1E28] rounded border border-[#2E2E38]">
                ENV VAR
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-ai-blue/10 border border-ai-blue/20 rounded-lg">
          <p className="text-xs text-slate-custom leading-relaxed">
            <span className="text-blue-light font-medium">Local:</span> Add keys to{' '}
            <code className="font-mono bg-[#1E1E28] px-1 py-0.5 rounded text-blue-light">.env.local</code>
            {' '}in your project root.
            <br />
            <span className="text-blue-light font-medium">Production:</span> Add via Vercel Dashboard &rarr; Settings &rarr; Environment Variables.
          </p>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} variant="primary" aria-label="Save settings">
          {saved ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          ) : (
            'Save Settings'
          )}
        </Button>
        {saved && (
          <span className="text-xs text-slate-custom font-mono">
            Preferences saved to local storage
          </span>
        )}
      </div>
    </div>
  );
}
