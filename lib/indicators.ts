/** Wilder RSI op slotkoersen (laatste candle). */
export function rsiWilder(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const c = changes[i];
    if (c > 0) avgGain += c;
    else avgLoss -= c;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    const c = changes[i];
    const gain = c > 0 ? c : 0;
    const loss = c < 0 ? -c : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function emaLast(closes: number[], span: number): number | null {
  if (closes.length < span) return null;
  const k = 2 / (span + 1);
  let ema = 0;
  for (let i = 0; i < span; i++) ema += closes[i];
  ema /= span;
  for (let i = span; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

/** MACD-lijn ≈ EMA12 − EMA26; trend op basis van teken. */
export function macdStyleTrend(closes: number[]): {
  macdLine: number;
  trend: 'bullish' | 'bearish';
} | null {
  const e12 = emaLast(closes, 12);
  const e26 = emaLast(closes, 26);
  if (e12 == null || e26 == null) return null;
  const macdLine = e12 - e26;
  return {
    macdLine,
    trend: macdLine >= 0 ? 'bullish' : 'bearish',
  };
}
