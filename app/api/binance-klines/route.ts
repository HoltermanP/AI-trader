import { NextRequest } from 'next/server';
import { fetchKlines, isChartKlineInterval, type ChartKlineInterval } from '@/lib/binance';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();
  const intervalRaw = req.nextUrl.searchParams.get('interval')?.trim();
  const limitRaw = req.nextUrl.searchParams.get('limit');

  if (!symbol || !/^[A-Z0-9]+$/.test(symbol)) {
    return Response.json({ error: 'Ongeldig symbool' }, { status: 400 });
  }

  if (!intervalRaw || !isChartKlineInterval(intervalRaw)) {
    return Response.json(
      { error: 'Ongeldige interval (gebruik 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)' },
      { status: 400 },
    );
  }

  const interval = intervalRaw as ChartKlineInterval;
  const limit = limitRaw ? parseInt(limitRaw, 10) : 500;
  if (!Number.isFinite(limit) || limit < 1 || limit > 1000) {
    return Response.json({ error: 'limit moet tussen 1 en 1000' }, { status: 400 });
  }

  const candles = await fetchKlines(symbol, interval, limit);
  if (!candles) {
    return Response.json({ error: 'Kon klines niet ophalen' }, { status: 502 });
  }

  return Response.json({ symbol, interval, candles });
}
