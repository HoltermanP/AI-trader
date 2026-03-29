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
