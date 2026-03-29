import { NextRequest } from 'next/server';
import { openai, anthropic, buildMultiPairSignalsPrompt } from '@/lib/ai';
import { buildMarketSnapshot } from '@/lib/market-snapshot';
import { buildNewsDigest } from '@/lib/news/headlines';
import { normalizeSignalsPayload, extractJsonObject, type TradingSignalsMeta } from '@/lib/trading-signals';

const SYSTEM_SIGNALS =
  'You are a disciplined crypto market analyst. You receive real Binance OHLCV-derived indicators and recent news headlines in the user message — weigh technicals, 24h price action, and macro/news when forming each signal. Output only valid JSON when asked. Signals are educational opinions, not financial advice.';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      model: string;
      timeframe: string;
      riskLevel: string;
      additionalContext?: string;
    };

    const { model, timeframe, riskLevel, additionalContext } = body;

    if (!model || !timeframe || !riskLevel) {
      return new Response(
        JSON.stringify({ error: 'Ontbrekende velden: model, timeframe, riskLevel' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
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

    if (model === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'OPENAI_API_KEY ontbreekt in de omgeving.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_SIGNALS },
          { role: 'user', content: prompt },
        ],
        temperature: 0.35,
        max_tokens: 4096,
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {};
      }

      const signals = normalizeSignalsPayload(parsed);
      return new Response(JSON.stringify({ signals, meta }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (model === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'ANTHROPIC_API_KEY ontbreekt in de omgeving.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
      }

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
      return new Response(JSON.stringify({ signals, meta }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ongeldig model. Gebruik "openai" of "anthropic".' }), {
      status: 400,
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
