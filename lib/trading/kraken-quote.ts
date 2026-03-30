export type KrakenQuoteCurrency = 'USDT' | 'EUR';

/** Spot-quote voor Kraken AddOrder. Voor NL-rekeningen: vaak `EUR` (USDT staat vaak uit). */
export function getKrakenQuoteFromEnv(): KrakenQuoteCurrency {
  const v = (process.env.KRAKEN_QUOTE ?? 'USDT').toUpperCase().trim();
  if (v === 'EUR') return 'EUR';
  return 'USDT';
}
