/**
 * @file route.ts
 * @description Server-side endpoint exposing operational exchange rates. Client components fetch from here instead of importing fetchCBRRates directly (which would hit CORS when calling sravni.ru from the browser).
 * @runs VDS (Next.js server)
 * @output JSON CBRRates object
 * @rule This endpoint is the ONLY way client components should obtain exchange rates. Direct client-side imports of fetchCBRRates bypass CORS protection.
 * @lastModified 2026-04-07
 */

import { NextResponse } from 'next/server';
import { fetchCBRRates } from '@/lib/currencyRates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const rates = await fetchCBRRates();
    return NextResponse.json(rates, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[api/exchange-rates] failed:', message);
    return NextResponse.json({ error: 'rates_unavailable' }, { status: 503 });
  }
}
