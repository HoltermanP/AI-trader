import crypto from 'crypto';
import { getKrakenQuoteFromEnv, type KrakenQuoteCurrency } from '@/lib/trading/kraken-quote';

export type TradeSide = 'buy' | 'sell';

const DEFAULT_BASE = 'https://api.kraken.com';

/** UI/signalen (quote USDT of EUR) → Kraken Spot pair, quote USDT. */
const TO_KRAKEN_PAIR_USDT_BASE: Record<string, string> = {
  'BTC/USDT': 'XBTUSDT',
  'ETH/USDT': 'ETHUSDT',
  'SOL/USDT': 'SOLUSDT',
  'BNB/USDT': 'BNBUSDT',
  'XRP/USDT': 'XRPUSDT',
  'ADA/USDT': 'ADAUSDT',
  'DOGE/USDT': 'DOGEUSDT',
  'AVAX/USDT': 'AVAXUSDT',
  'MATIC/USDT': 'MATICUSDT',
  'LINK/USDT': 'LINKUSDT',
};

/**
 * Zelfde bases, EUR-quote op Kraken (API-namen).
 * MATIC → POL (Kraken): signaal MATIC/EUR, order naar POLEUR.
 */
const TO_KRAKEN_PAIR_EUR_BASE: Record<string, string> = {
  'BTC/USDT': 'XXBTZEUR',
  'ETH/USDT': 'XETHZEUR',
  'SOL/USDT': 'SOLEUR',
  'BNB/USDT': 'BNBEUR',
  'XRP/USDT': 'XXRPZEUR',
  'ADA/USDT': 'ADAEUR',
  'DOGE/USDT': 'XDGEUR',
  'AVAX/USDT': 'AVAXEUR',
  'MATIC/USDT': 'POLEUR',
  'LINK/USDT': 'LINKEUR',
};

function withEurUiAliases(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...map };
  for (const [k, v] of Object.entries(map)) {
    if (k.includes('/USDT')) {
      out[k.replace('/USDT', '/EUR')] = v;
    }
  }
  return out;
}

const TO_KRAKEN_PAIR_USDT = withEurUiAliases(TO_KRAKEN_PAIR_USDT_BASE);
const TO_KRAKEN_PAIR_EUR = withEurUiAliases(TO_KRAKEN_PAIR_EUR_BASE);

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Ontbrekende environment variable: ${name}`);
  }
  return value;
}

function pairMapForQuote(quote: KrakenQuoteCurrency): Record<string, string> {
  return quote === 'EUR' ? TO_KRAKEN_PAIR_EUR : TO_KRAKEN_PAIR_USDT;
}

export function toKrakenPair(pair: string, quote?: KrakenQuoteCurrency): string {
  const q = quote ?? getKrakenQuoteFromEnv();
  const key = pair.replace('-', '/').toUpperCase().trim();
  const mapped = pairMapForQuote(q)[key];
  if (mapped) return mapped;
  const [base, rawQuote] = key.split('/');
  if (!base || !rawQuote) {
    throw new Error(`Ongeldig pair-formaat: ${pair}. Verwacht bijvoorbeeld BTC/EUR of BTC/USDT.`);
  }
  const krakenBase = base === 'BTC' ? 'XBT' : base;
  return `${krakenBase}${rawQuote}`;
}

type KrakenTickerResult = Record<
  string,
  {
    c: [string, string];
  }
>;

function firstTickerEntry(result: KrakenTickerResult): { c: [string, string] } {
  const first = Object.values(result)[0];
  if (!first?.c?.[0]) {
    throw new Error('Kraken ticker: geen prijs in antwoord.');
  }
  return first;
}

/** Laatste trade-prijs in de quote van het Kraken-paar (USDT of EUR). */
export async function getKrakenLastPriceUsdT(krakenPair: string): Promise<number> {
  const base = (process.env.KRAKEN_API_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, '');
  const url = `${base}/0/public/Ticker?pair=${encodeURIComponent(krakenPair)}`;
  const response = await fetch(url, { cache: 'no-store' });
  const data = (await response.json()) as { error?: string[]; result?: KrakenTickerResult };
  if (!response.ok || !data.result || (data.error && data.error.length > 0)) {
    const msg = data.error?.join(', ') ?? `HTTP ${response.status}`;
    throw new Error(`Kraken ticker mislukt: ${msg}`);
  }
  const last = Number(firstTickerEntry(data.result).c[0]);
  if (!Number.isFinite(last) || last <= 0) {
    throw new Error('Kraken ticker: ongeldige last price.');
  }
  return last;
}

/**
 * Kraken REST signing: SHA256(nonce + postBody) → HMAC-SHA512(secret, path + sha256digest).
 * @see https://docs.kraken.com/rest/#section/Authentication/Headers-and-Signature
 */
function signKrakenRequest(apiPath: string, nonce: string, postBody: string, secretB64: string): string {
  const secret = Buffer.from(secretB64, 'base64');
  const hash = crypto.createHash('sha256').update(nonce + postBody).digest();
  const message = Buffer.concat([Buffer.from(apiPath, 'utf8'), hash]);
  return crypto.createHmac('sha512', secret).update(message).digest('base64');
}

type KrakenAddOrderResult = {
  descr: { order: string };
  txid: string[];
};

export type KrakenOrderResponse = {
  pair: string;
  side: TradeSide;
  ordertype: 'market';
  volume: string;
  txid: string[];
  descr_order: string;
};

export async function placeKrakenMarketOrder(input: {
  pair: string;
  side: TradeSide;
  /** Bij USDT-quote: bedrag in USDT. Bij EUR-quote (`KRAKEN_QUOTE=EUR`): bedrag in EUR. */
  notionalUsd: number;
}): Promise<KrakenOrderResponse> {
  const apiKey = getEnv('KRAKEN_API_KEY');
  const apiSecret = getEnv('KRAKEN_API_SECRET');
  const base = (process.env.KRAKEN_API_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, '');
  const quoteCc = getKrakenQuoteFromEnv();

  const krakenPair = toKrakenPair(input.pair, quoteCc);
  const last = await getKrakenLastPriceUsdT(krakenPair);
  const volumeRaw = input.notionalUsd / last;
  const volumeStr = trimVolumeString(volumeRaw);

  const path = '/0/private/AddOrder';
  const nonce = Date.now().toString();
  const params = new URLSearchParams({
    nonce,
    pair: krakenPair,
    type: input.side,
    ordertype: 'market',
    volume: volumeStr,
  });
  const postBody = params.toString();
  const signature = signKrakenRequest(path, nonce, postBody, apiSecret);

  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'API-Key': apiKey,
      'API-Sign': signature,
    },
    body: postBody,
    cache: 'no-store',
  });

  const data = (await response.json()) as {
    error?: string[];
    result?: KrakenAddOrderResult;
  };

  if (!response.ok || (data.error && data.error.length > 0) || !data.result?.txid?.length) {
    const msg = data.error?.join(', ') ?? `HTTP ${response.status}`;
    const hint =
      /USDT trading restricted|Invalid permissions.*USDT/i.test(msg) && quoteCc === 'USDT'
        ? ' Voor Nederlandse Kraken-accounts is USDT-spot vaak uitgeschakeld. De app gebruikt standaard `KRAKEN_QUOTE=EUR`; laat die env leeg of zet expliciet EUR. Bij een USDT-poging: zet `KRAKEN_QUOTE=USDT` alleen als je account USDT-spot toestaat.'
        : '';
    throw new Error(`Kraken order mislukt: ${msg}.${hint}`);
  }

  return {
    pair: krakenPair,
    side: input.side,
    ordertype: 'market',
    volume: volumeStr,
    txid: data.result.txid,
    descr_order: data.result.descr.order,
  };
}

function trimVolumeString(v: number): string {
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error('Berekend ordervolume is ongeldig (prijs of bedrag).');
  }
  const s = v.toFixed(8).replace(/\.?0+$/, '');
  return s || '0';
}
