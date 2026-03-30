import { NextRequest } from 'next/server';
import { fetchTickerPrice } from '@/lib/binance';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();
  if (!raw || !/^[A-Z0-9]+$/.test(raw)) {
    return Response.json({ error: 'Ongeldig symbool' }, { status: 400 });
  }

  const data = await fetchTickerPrice(raw);
  if (!data) {
    return Response.json({ error: 'Koers tijdelijk niet beschikbaar' }, { status: 502 });
  }

  return Response.json({ symbol: data.symbol, price: data.price });
}
