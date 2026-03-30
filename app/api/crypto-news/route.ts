import { NextResponse } from 'next/server';
import { buildNewsDigest } from '@/lib/news/headlines';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const r = await buildNewsDigest();
    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      items: r.headlines,
      sourcesUsed: r.sourcesUsed,
      fetchedBeforeFilter: r.fetchedBeforeFilter,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onverwachte fout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
