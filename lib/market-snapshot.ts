import { TRADE_PAIRS } from '@/lib/crypto-pairs';
import {
  fetchCloses,
  fetchTicker24h,
  pairToBinanceSymbol,
  timeframeToBinanceInterval,
  type KlineInterval,
} from '@/lib/binance';
import { macdStyleTrend, rsiWilder } from '@/lib/indicators';

export type PairMarketRow = {
  pair: string;
  symbol: string;
  lastPrice: number | null;
  change24hPct: number | null;
  rsi14: number | null;
  macdTrend: 'bullish' | 'bearish' | null;
};

export type MarketSnapshotResult = {
  ok: boolean;
  timeframe: string;
  interval: KlineInterval;
  rows: PairMarketRow[];
  summaryText: string;
};

function formatNum(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('nl-NL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export async function buildMarketSnapshot(chartTimeframe: string): Promise<MarketSnapshotResult> {
  const interval = timeframeToBinanceInterval(chartTimeframe);
  const rows: PairMarketRow[] = [];

  await Promise.all(
    TRADE_PAIRS.map(async (pair) => {
      const symbol = pairToBinanceSymbol(pair);
      const [ticker, closes] = await Promise.all([
        fetchTicker24h(symbol),
        fetchCloses(symbol, interval, 200),
      ]);

      let rsi14: number | null = null;
      let macdTrend: 'bullish' | 'bearish' | null = null;

      if (closes && closes.length >= 20) {
        rsi14 = rsiWilder(closes, 14);
        const m = macdStyleTrend(closes);
        if (m) macdTrend = m.trend;
      }

      rows.push({
        pair,
        symbol,
        lastPrice: ticker?.lastPrice ?? null,
        change24hPct: ticker?.priceChangePercent ?? null,
        rsi14,
        macdTrend,
      });
    }),
  );

  const sorted = TRADE_PAIRS.map((p) => rows.find((r) => r.pair === p)).filter(
    (r): r is PairMarketRow => r != null,
  );

  const lines: string[] = [
    `Timeframe grafiek: ${chartTimeframe} (Binance candles, interval ${interval}).`,
    `Per pair: slotkoers (USDT), 24u %-verandering, RSI(14), MACD-stijl trend (EMA12−EMA26).`,
    '',
  ];

  for (const r of sorted) {
    const price =
      r.lastPrice != null ? formatNum(r.lastPrice, r.lastPrice >= 100 ? 2 : r.lastPrice >= 1 ? 4 : 6) : '—';
    const ch =
      r.change24hPct != null
        ? `${r.change24hPct >= 0 ? '+' : ''}${formatNum(r.change24hPct, 2)}%`
        : '—';
    const rsi = r.rsi14 != null ? formatNum(r.rsi14, 1) : '—';
    const macd =
      r.macdTrend != null
        ? `${r.macdTrend} (MACD-stijl: EMA12 vs EMA26)`
        : '—';
    lines.push(
      `- ${r.pair}: prijs ${price} USDT | 24u ${ch} | RSI(14) ${rsi} | trend ${macd}`,
    );
  }

  const ok = sorted.some((r) => r.lastPrice != null);

  return {
    ok,
    timeframe: chartTimeframe,
    interval,
    rows: sorted,
    summaryText: lines.join('\n'),
  };
}
