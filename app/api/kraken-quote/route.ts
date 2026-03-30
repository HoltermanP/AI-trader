import { NextResponse } from 'next/server';
import { getKrakenQuoteFromEnv } from '@/lib/trading/kraken-quote';

export const dynamic = 'force-dynamic';

/** Publieke quote (EUR/USDT) voor labels; moet matchen met `KRAKEN_QUOTE` op de server. */
export async function GET() {
  return NextResponse.json({ quote: getKrakenQuoteFromEnv() });
}
