import crypto from 'crypto';

export type TradeSide = 'buy' | 'sell';

const DEFAULT_BASE = 'https://api.kraken.com';

/** Onze UI/signalen (BTC/USDT) → Kraken Spot pair (vaak XBT voor BTC). */
const TO_KRAKEN_PAIR: Record<string, string> = {
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

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Ontbrekende environment variable: ${name}`);
  }
  return value;
}

export function toKrakenPair(pair: string): string {
  const key = pair.replace('-', '/').toUpperCase().trim();
  const mapped = TO_KRAKEN_PAIR[key];
  if (mapped) return mapped;
  const [base, quote] = key.split('/');
  if (!base || !quote) {
    throw new Error(`Ongeldig pair-formaat: ${pair}. Verwacht bijvoorbeeld BTC/USDT.`);
  }
  const krakenBase = base === 'BTC' ? 'XBT' : base;
  return `${krakenBase}${quote}`;
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
  notionalUsd: number;
}): Promise<KrakenOrderResponse> {
  const apiKey = getEnv('KRAKEN_API_KEY');
  const apiSecret = getEnv('KRAKEN_API_SECRET');
  const base = (process.env.KRAKEN_API_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, '');

  const krakenPair = toKrakenPair(input.pair);
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
    throw new Error(`Kraken order mislukt: ${msg}`);
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
