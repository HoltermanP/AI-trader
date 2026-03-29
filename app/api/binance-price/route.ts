import { NextRequest } from 'next/server';

const BINANCE = 'https://api.binance.com/api/v3/ticker/price';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();
  if (!raw || !/^[A-Z0-9]+$/.test(raw)) {
    return Response.json({ error: 'Ongeldig symbool' }, { status: 400 });
  }

  const upstream = await fetch(`${BINANCE}?symbol=${encodeURIComponent(raw)}`, {
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return Response.json({ error: 'Koers tijdelijk niet beschikbaar' }, { status: 502 });
  }

  const data = (await upstream.json()) as { symbol?: string; price?: string };
  if (data.price == null || data.symbol == null) {
    return Response.json({ error: 'Onverwacht antwoord' }, { status: 502 });
  }

  return Response.json({ symbol: data.symbol, price: data.price });
}
