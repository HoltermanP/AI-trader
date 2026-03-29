export const TRADER_SETTINGS_KEY = 'ai-trader-settings';

export type TraderSettingsStored = {
  defaultPair?: string;
  defaultTimeframe?: string;
  defaultRiskLevel?: string;
  preferredModels?: string[];
  /** false = geen LLM-calls vanuit de browser (signalen + strategy analyzer). */
  llmCallsEnabled?: boolean;
};

export function loadTraderSettings(): TraderSettingsStored {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TRADER_SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TraderSettingsStored;
  } catch {
    return {};
  }
}

/** Standaard aan; alleen uit als expliciet opgeslagen als false. */
export function isLlmCallsEnabledClient(): boolean {
  return loadTraderSettings().llmCallsEnabled !== false;
}

export function notifyTraderSettingsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('ai-trader-settings-updated'));
}
