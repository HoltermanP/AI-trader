/**
 * Geschatte USD-kosten op basis van token-tellingen (Anthropic Claude).
 * Tarieven zijn indicatief — controleer actuele prijzen op anthropic.com
 * en pas constanten hieronder aan indien nodig.
 */
const USD_PER_M = {
  /** claude-sonnet-4-6 — $ / 1M tokens (indicatief) */
  anthropic_sonnet_input: 3,
  anthropic_sonnet_output: 15,
} as const;

export function estimateAnthropicSonnetUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * USD_PER_M.anthropic_sonnet_input +
    (outputTokens / 1_000_000) * USD_PER_M.anthropic_sonnet_output
  );
}

/** Alleen voor UI: facturatie Anthropic is USD; koers indicatief (pas aan indien nodig). */
export const LLM_COST_USD_TO_EUR_DISPLAY = 0.92;

export function formatLlmCostDisplayEurFromUsd(usd: number): string {
  const eur = usd * LLM_COST_USD_TO_EUR_DISPLAY;
  if (eur > 0 && eur < 0.0001) {
    return `${eur.toExponential(2).replace('.', ',')} €`;
  }
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(eur);
}
