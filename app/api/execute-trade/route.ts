import { NextRequest } from 'next/server';
import { placeKrakenMarketOrder, type TradeSide } from '@/lib/trading/kraken';

type ExecuteTradeBody = {
  pair: string;
  side: TradeSide;
  notionalUsd: number;
  source?: string;
  confidence?: string;
};

function getAllowedPairs(): string[] {
  const raw = process.env.AUTO_TRADING_ALLOWED_PAIRS ?? 'BTC/USDT,ETH/USDT,SOL/USDT';
  return raw
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

function getMaxNotionalUsd(): number {
  const raw = Number(process.env.AUTO_TRADING_MAX_NOTIONAL_USD ?? 50);
  return Number.isFinite(raw) && raw > 0 ? raw : 50;
}

function assertTradingEnabled(): void {
  if (process.env.AUTO_TRADING_ENABLED !== 'true') {
    throw new Error('Auto-trading staat uit. Zet AUTO_TRADING_ENABLED=true om orders toe te staan.');
  }
}

export async function POST(req: NextRequest) {
  try {
    assertTradingEnabled();

    const body = (await req.json()) as ExecuteTradeBody;
    const pair = body.pair?.toUpperCase().trim();
    const side = body.side;
    const notionalUsd = Number(body.notionalUsd);

    if (!pair || !side || !Number.isFinite(notionalUsd)) {
      return new Response(
        JSON.stringify({ error: 'Ontbrekende of ongeldige velden: pair, side, notionalUsd.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (side !== 'buy' && side !== 'sell') {
      return new Response(
        JSON.stringify({ error: 'Ongeldige side. Gebruik "buy" of "sell".' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const allowedPairs = getAllowedPairs();
    if (!allowedPairs.includes(pair)) {
      return new Response(
        JSON.stringify({ error: `Pair ${pair} is niet toegestaan.`, allowedPairs }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const maxNotional = getMaxNotionalUsd();
    if (notionalUsd <= 0 || notionalUsd > maxNotional) {
      return new Response(
        JSON.stringify({
          error: `notionalUsd moet tussen 0 en ${maxNotional} liggen.`,
          maxNotionalUsd: maxNotional,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const order = await placeKrakenMarketOrder({
      pair,
      side,
      notionalUsd,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        broker: 'kraken',
        order,
        guardrails: {
          maxNotionalUsd: maxNotional,
          allowedPairs,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onverwachte fout tijdens order-uitvoering.';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
