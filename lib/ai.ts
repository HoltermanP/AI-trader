import Anthropic from '@anthropic-ai/sdk';
import { TRADE_PAIRS } from '@/lib/crypto-pairs';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type TradingAnalysisParams = {
  pair: string;
  timeframe: string;
  riskLevel: string;
  additionalContext?: string;
  /** Binance koers + RSI + MACD-stijl trend voor het gekozen paar */
  marketDataBlock?: string;
  /** Optioneel: headlines (macro/crypto) */
  newsDigestBlock?: string;
};

export function buildTradingPrompt(params: TradingAnalysisParams): string {
  const marketSection =
    params.marketDataBlock?.trim() ?
      `\n## Live market data (Binance, indicators on selected timeframe)\n${params.marketDataBlock.trim()}\n`
      : '';
  const newsSection =
    params.newsDigestBlock?.trim() ?
      `\n## Recent news & macro headlines\n${params.newsDigestBlock.trim()}\n`
      : '';

  return `Analyze the following crypto trading scenario and provide a comprehensive, actionable strategy. Base your technical read primarily on the live market data below when present; incorporate headlines only where they add relevant context.

**Trading Pair:** ${params.pair}
**Timeframe:** ${params.timeframe}
**Risk Level:** ${params.riskLevel}
${params.additionalContext ? `**Additional Context:** ${params.additionalContext}` : ''}
${marketSection}${newsSection}
Structure your analysis with the following sections:

## 1. Market Analysis
Describe current market conditions, trend direction, momentum, and key support/resistance levels for ${params.pair} on the ${params.timeframe} timeframe. Identify whether the market is trending, ranging, or at a potential reversal point.

## 2. Entry Strategy
- Primary entry point and trigger conditions
- Confirmation signals to wait for before entering
- Recommended order type (market, limit, stop-limit)

## 3. Exit Strategy
- **Take Profit:** Specific target level(s) with rationale
- **Stop Loss:** Placement with reasoning
- **Risk/Reward Ratio:** Calculated R:R for this setup

## 4. Risk Management
- Suggested position size as % of portfolio given ${params.riskLevel} risk
- Maximum acceptable loss scenario
- Conditions that would invalidate this setup

## 5. Key Technical Indicators
List 3–5 most relevant indicators to monitor and what signal each should show for trade confirmation.

## 6. Confidence Assessment
**Confidence Level: Low / Medium / High**

Brief reasoning for your confidence, noting any significant risks or market conditions that could affect this strategy.

Be specific and practical. Use concrete numbers where possible.`;
}

export type MultiPairSignalsParams = {
  timeframe: string;
  riskLevel: string;
  additionalContext?: string;
  /** Binance-koersen + RSI + MACD-stijl trend */
  marketDataBlock?: string;
  /** Geaggregeerde headlines (macro, crypto, etc.) */
  newsDigestBlock?: string;
};

export function buildMultiPairSignalsPrompt(params: MultiPairSignalsParams): string {
  const pairsList = TRADE_PAIRS.join(', ');
  const marketSection =
    params.marketDataBlock?.trim() ?
      `\n## Actuele marktdata (Binance, technische indicatoren)\n${params.marketDataBlock.trim()}\n`
      : '';
  const newsSection =
    params.newsDigestBlock?.trim() ?
      `\n## Recente nieuws- & macro-headlines\n${params.newsDigestBlock.trim()}\n`
      : '';

  return `Je bent een crypto-analist. Gebruik de onderstaande marktdata en headlines waar relevant — geef voor ELK van de volgende paren precies één handelsignaal. Leg in de rationale kort uit of je vooral op techniek (RSI, trend), koersbeweging 24u, of nieuws/macro leunt.

**Timeframe analyse:** ${params.timeframe}
**Risiconiveau:** ${params.riskLevel}
${params.additionalContext ? `**Extra context van gebruiker:** ${params.additionalContext}` : ''}
${marketSection}${newsSection}
**Paren (exact deze labels gebruiken):** ${pairsList}

Antwoord uitsluitend met geldige JSON (geen markdown, geen tekst eromheen) in dit formaat:
{
  "signals": [
    {
      "pair": "BTC/USDT",
      "signal": "BUY",
      "confidence": "Medium",
      "rationale": "Korte zin met reden."
    }
  ]
}

Regels:
- "signal" is altijd één van: BUY, SELL, HOLD.
- "confidence" is één van: Low, Medium, High.
- "rationale": maximaal 1–2 zinnen, Nederlands of Engels is toegestaan.
- Het array "signals" moet precies ${TRADE_PAIRS.length} objecten bevatten, één per paar, met "pair" exact zoals in de lijst hierboven.

Disclaimer: dit is geen financieel advies; signalen zijn educatief.`;
}
