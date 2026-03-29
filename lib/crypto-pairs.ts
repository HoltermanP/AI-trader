/** Vaste set van 10 USDT-handelsparen voor signalen en analyse. */
export const TRADE_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'SOL/USDT',
  'BNB/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'DOGE/USDT',
  'AVAX/USDT',
  'MATIC/USDT',
  'LINK/USDT',
] as const;

export type TradePair = (typeof TRADE_PAIRS)[number];
