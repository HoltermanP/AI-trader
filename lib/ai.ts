import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type TradingAnalysisParams = {
  pair: string;
  timeframe: string;
  riskLevel: string;
  additionalContext?: string;
};

export function buildTradingPrompt(params: TradingAnalysisParams): string {
  return `Analyze the following crypto trading scenario and provide a comprehensive, actionable strategy:

**Trading Pair:** ${params.pair}
**Timeframe:** ${params.timeframe}
**Risk Level:** ${params.riskLevel}
${params.additionalContext ? `**Additional Context:** ${params.additionalContext}` : ''}

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
