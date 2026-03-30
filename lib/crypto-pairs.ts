/** Vaste set van 10 EUR-handelsparen (Binance spot) voor signalen en analyse. */
export const TRADE_PAIRS = [
  'BTC/EUR',
  'ETH/EUR',
  'SOL/EUR',
  'BNB/EUR',
  'XRP/EUR',
  'ADA/EUR',
  'DOGE/EUR',
  'AVAX/EUR',
  'MATIC/EUR',
  'LINK/EUR',
] as const;

export type TradePair = (typeof TRADE_PAIRS)[number];
