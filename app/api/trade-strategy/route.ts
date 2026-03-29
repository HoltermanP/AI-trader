import { NextRequest } from 'next/server';
import { anthropic, buildTradingPrompt, type TradingAnalysisParams } from '@/lib/ai';
import { isLlmDisabledByEnv } from '@/lib/llm-disabled';
import { buildSinglePairMarketSnapshot } from '@/lib/market-snapshot';
import { buildNewsDigest } from '@/lib/news/headlines';

const SYSTEM_PROMPT =
  'Je bent een ervaren crypto-handelsanalist. Het gebruikersbericht kan real-time Binance OHLCV-data bevatten (prijs, RSI, MACD-achtige trend) voor het gekozen paar en timeframe, plus optionele nieuws-headlines. Baseer support/resistance en indicatorcommentaar op die data wanneer die er is; als data ontbreekt, zeg dat kort. Geef gedetailleerde, concrete en uitvoerbare handelsstrategieën met prijsniveaus, percentages en risicoparameters. Schrijf je volledige antwoord in het Nederlands.';

export async function POST(req: NextRequest) {
  try {
    if (isLlmDisabledByEnv()) {
      return new Response(
        JSON.stringify({ error: 'LLM-aanroepen staan uit (DISABLE_LLM_CALLS in serveromgeving).' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const body = (await req.json()) as {
      pair: string;
      timeframe: string;
      riskLevel: string;
      additionalContext?: string;
    };

    const { pair, timeframe, riskLevel, additionalContext } = body;

    if (!pair || !timeframe || !riskLevel) {
      return new Response(JSON.stringify({ error: 'Missing required fields: pair, timeframe, riskLevel' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment variables.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const [market, news] = await Promise.all([
      buildSinglePairMarketSnapshot(pair, timeframe),
      buildNewsDigest(),
    ]);

    const params: TradingAnalysisParams = {
      pair,
      timeframe,
      riskLevel,
      additionalContext,
      marketDataBlock: market.summaryText,
      newsDigestBlock: news.digestText,
    };
    const prompt = buildTradingPrompt(params);
    const encoder = new TextEncoder();

    const streamHelper = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamHelper) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const text = event.delta.text;
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
