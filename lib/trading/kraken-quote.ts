export type KrakenQuoteCurrency = 'USDT' | 'EUR';

/** Spot-quote voor Kraken AddOrder. Standaard EUR (app en NL-accounts); zet `KRAKEN_QUOTE=USDT` voor USDT-orders. */
export function getKrakenQuoteFromEnv(): KrakenQuoteCurrency {
  const v = (process.env.KRAKEN_QUOTE ?? 'EUR').toUpperCase().trim();
  if (v === 'USDT') return 'USDT';
  return 'EUR';
}
