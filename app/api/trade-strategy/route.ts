import { NextRequest } from 'next/server';
import { openai, anthropic, buildTradingPrompt, type TradingAnalysisParams } from '@/lib/ai';

const SYSTEM_PROMPT =
  'You are an expert crypto trading analyst with deep knowledge of technical analysis, on-chain metrics, market microstructure, and risk management. Provide detailed, specific, and actionable trading strategies. Always include concrete price levels, percentages, and risk parameters.';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      model: string;
      pair: string;
      timeframe: string;
      riskLevel: string;
      additionalContext?: string;
    };

    const { model, pair, timeframe, riskLevel, additionalContext } = body;

    if (!model || !pair || !timeframe || !riskLevel) {
      return new Response(JSON.stringify({ error: 'Missing required fields: model, pair, timeframe, riskLevel' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const params: TradingAnalysisParams = { pair, timeframe, riskLevel, additionalContext };
    const prompt = buildTradingPrompt(params);
    const encoder = new TextEncoder();

    if (model === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your environment variables.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        stream: true,
        max_tokens: 2048,
        temperature: 0.4,
      });

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content ?? '';
              if (text) {
                controller.enqueue(encoder.encode(text));
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
    }

    if (model === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment variables.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

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
              if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
              ) {
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
    }

    return new Response(JSON.stringify({ error: 'Invalid model. Use "openai" or "anthropic".' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
