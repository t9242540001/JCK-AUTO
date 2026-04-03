/**
 * @file route.ts
 * @description API endpoint анализатора Encar: извлечение данных авто + расчёт стоимости в РФ.
 * @runs VDS
 * @input POST JSON { url: string, enginePower?: number }
 * @output JSON с данными авто, опционально costBreakdown
 * @rule Rate limit: 3 запроса/день с одного IP (общий лимит с аукционными листами)
 * @rule Encar API — без авторизации, напрямую с VDS
 * @lastModified 2026-04-03
 */

import { NextResponse } from 'next/server';
import { extractCarId, fetchVehicle, fetchInspection, mapToResult } from '@/lib/encarClient';
import { checkRateLimit, recordUsage } from '@/lib/rateLimiter';
import { calculateTotal, type CarAge } from '@/lib/calculator';
import { fetchCBRRates } from '@/lib/currencyRates';

// ─── HELPERS ──────────────────────────────────────────────────────────────

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function yearToCarAge(formYear: number): CarAge {
  const age = new Date().getFullYear() - formYear;
  if (age < 3) return 'under3';
  if (age <= 5) return '3to5';
  if (age <= 7) return '5to7';
  return 'over7';
}

// ─── ROUTE ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // Rate limit
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({
      error: 'rate_limit',
      message: 'Лимит бесплатных анализов исчерпан (3 в день)',
      resetIn: limit.resetIn,
      alternatives: {
        telegram: 'https://t.me/jckauto_help_bot',
        manager: 'https://t.me/jck_auto_manager',
      },
    }, { status: 429 });
  }

  // Parse body
  let body: { url?: string; enginePower?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Ожидается JSON с полем url' },
      { status: 400 },
    );
  }

  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json(
      { error: 'missing_url', message: 'Укажите ссылку на автомобиль с Encar.com' },
      { status: 400 },
    );
  }

  // Extract car ID
  const carid = extractCarId(body.url);
  if (!carid) {
    return NextResponse.json(
      { error: 'invalid_url', message: 'Не удалось распознать ссылку Encar. Поддерживаемые форматы: fem.encar.com/cars/detail/{id}, encar.com/dc/dc_cardetailview.do?carid={id}' },
      { status: 400 },
    );
  }

  // Fetch from Encar API
  let result;
  try {
    const [vehicle, inspection] = await Promise.all([
      fetchVehicle(carid),
      fetchInspection(carid),
    ]);
    result = mapToResult(vehicle, inspection, carid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('404') || msg.includes('Not Found')) {
      return NextResponse.json(
        { error: 'not_found', message: 'Автомобиль не найден на Encar. Проверьте ссылку.' },
        { status: 404 },
      );
    }
    console.error('[encar] API error:', msg);
    return NextResponse.json(
      { error: 'encar_unavailable', message: 'Encar API временно недоступен. Попробуйте позже.' },
      { status: 502 },
    );
  }

  // Optional: calculate cost in Russia
  let costBreakdown = null;
  if (body.enginePower && body.enginePower > 0 && result.displacement > 0 && result.priceKRW > 0) {
    try {
      const rates = await fetchCBRRates();
      costBreakdown = calculateTotal({
        priceInCurrency: result.priceKRW,
        currencyCode: 'KRW',
        engineVolume: result.displacement,
        enginePower: body.enginePower,
        carAge: yearToCarAge(result.year),
        buyerType: 'individual',
        personalUse: true,
        country: 'korea',
      }, rates);
    } catch (err) {
      console.warn('[encar] Cost calculation failed:', err instanceof Error ? err.message : err);
    }
  }

  // Record usage
  recordUsage(ip);
  const remaining = checkRateLimit(ip).remaining;

  return NextResponse.json({
    success: true,
    data: result,
    costBreakdown,
    meta: {
      remaining,
      source: 'encar-api',
    },
  });
}
