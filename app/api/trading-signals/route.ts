import { NextRequest } from 'next/server';
import { anthropic, buildMultiPairSignalsPrompt } from '@/lib/ai';
import { estimateAnthropicSonnetUsd } from '@/lib/llm-cost';
import { isLlmDisabledByEnv } from '@/lib/llm-disabled';
import { buildMarketSnapshot } from '@/lib/market-snapshot';
import { buildNewsDigest } from '@/lib/news/headlines';
import {
  normalizeSignalsPayload,
  extractJsonObject,
  type TradingSignalsMeta,
  type TradingSignalsUsage,
} from '@/lib/trading-signals';

const SYSTEM_SIGNALS =
  'Je bent een gedisciplineerde crypto-marktanalist. Je krijgt echte Binance OHLCV-indicatoren en recente nieuws-headlines in het gebruikersbericht — weeg techniek, 24u-koers en macro/nieuws mee bij elk signaal. Geef alleen geldige JSON wanneer daarom wordt gevraagd. Signalen zijn educatieve meningen, geen financieel advies. Veld "rationale" altijd in het Nederlands.';

export async function POST(req: NextRequest) {
  try {
    if (isLlmDisabledByEnv()) {
      return new Response(
        JSON.stringify({
          error: 'LLM-aanroepen staan uit (DISABLE_LLM_CALLS in serveromgeving).',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const body = (await req.json()) as {
      timeframe: string;
      riskLevel: string;
      additionalContext?: string;
    };

    const { timeframe, riskLevel, additionalContext } = body;

    if (!timeframe || !riskLevel) {
      return new Response(
        JSON.stringify({ error: 'Ontbrekende velden: timeframe, riskLevel' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY ontbreekt in de omgeving.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const [market, news] = await Promise.all([
      buildMarketSnapshot(timeframe),
      buildNewsDigest(),
    ]);

    const prompt = buildMultiPairSignalsPrompt({
      timeframe,
      riskLevel,
      additionalContext,
      marketDataBlock: market.summaryText,
      newsDigestBlock: news.digestText,
    });

    const meta: TradingSignalsMeta = {
      generatedAt: new Date().toISOString(),
      marketDataOk: market.ok,
      headlineCount: news.headlines.length,
      newsSources: news.sourcesUsed,
      chartInterval: market.interval,
    };

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_SIGNALS,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = msg.content.find((b) => b.type === 'text');
    const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : '{}';
    const jsonStr = extractJsonObject(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {};
    }

    const signals = normalizeSignalsPayload(parsed);
    const u = msg.usage;
    const promptTokens = u?.input_tokens ?? 0;
    const completionTokens = u?.output_tokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const usage: TradingSignalsUsage = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedUsd: estimateAnthropicSonnetUsd(promptTokens, completionTokens),
    };
    return new Response(JSON.stringify({ signals, meta, usage }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onverwachte fout';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
