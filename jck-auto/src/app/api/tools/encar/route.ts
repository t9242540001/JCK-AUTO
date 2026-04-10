/**
 * @file route.ts
 * @description API endpoint анализатора Encar: данные авто + AI-определение мощности + расчёт стоимости.
 *              Supports two-mode rate limiting: anonymous (3 lifetime) / Telegram-auth (10/day).
 * @runs VDS
 * @input POST JSON { url: string, enginePower?: number }
 * @output JSON с данными авто + AI-мощность + costBreakdown
 * @rule Rate limit: anonymous — 3 запроса lifetime с одного IP; auth — 10/day по telegram_id
 * @rule Приоритет мощности: пользователь > AI > null
 * @rule DeepSeek-вызов не считается отдельным запросом (часть обработки)
 * @dependencies jose (jwtVerify), next/headers (cookies), JWT_SECRET env var,
 *              src/lib/encarClient, src/lib/rateLimiter, src/lib/calculator
 * @lastModified 2026-04-10
 */

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { extractCarId, fetchVehicle, fetchInspection, mapToResult, estimateEnginePower, translateEncarFields } from '@/lib/encarClient';
import { checkRateLimit, recordUsage } from '@/lib/rateLimiter';
import { calculateTotal, type CarAge, type EngineType } from '@/lib/calculator';
import { fetchCBRRates } from '@/lib/currencyRates';

// ─── HELPERS ──────────────────────────────────────────────────────────────

const KW_TO_HP = 1.35962;

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

function fuelToEngineType(fuelType: string): EngineType {
  if (fuelType.includes('Дизель')) return 'diesel';
  if (fuelType.includes('Электро')) return 'electric';
  if (fuelType.includes('Гибрид')) return 'hybrid';
  return 'petrol';
}

/**
 * Extract telegramId from tg_auth JWT cookie.
 * Returns telegramId as string if cookie is valid and not expired.
 * Returns undefined on any error (missing cookie, invalid JWT, missing env var) —
 * caller falls back to anonymous mode silently.
 * @rule Never throw — all errors must be caught internally
 */
async function getTelegramIdFromCookie(): Promise<string | undefined> {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return undefined;

    const cookieStore = await cookies();
    const token = cookieStore.get('tg_auth')?.value;
    if (!token) return undefined;

    const secretBytes = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secretBytes);
    const id = payload.telegramId;
    if (!id) return undefined;

    return String(id);
  } catch {
    return undefined;
  }
}

// ─── ROUTE ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const telegramId = await getTelegramIdFromCookie();

  const limit = checkRateLimit(ip, telegramId);
  if (!limit.allowed) {
    return NextResponse.json({
      error: 'rate_limit',
      message: limit.remaining > 0
        ? 'Подождите немного — запросы принимаются раз в 2 минуты.'
        : telegramId
          ? 'Дневной лимит запросов исчерпан (10 в день). Завтра лимит обновится.'
          : 'Лимит бесплатных анализов исчерпан. Войдите через Telegram для 10 запросов в день.',
      resetIn: limit.resetIn,
      alternatives: { telegram: 'https://t.me/jckauto_help_bot', manager: 'https://t.me/jck_auto_manager' },
    }, { status: 429 });
  }

  let body: { url?: string; enginePower?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Ожидается JSON с полем url' }, { status: 400 });
  }

  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'missing_url', message: 'Укажите ссылку на автомобиль с Encar.com' }, { status: 400 });
  }

  const carid = extractCarId(body.url);
  if (!carid) {
    return NextResponse.json({ error: 'invalid_url', message: 'Не удалось распознать ссылку Encar.' }, { status: 400 });
  }

  // Fetch from Encar API
  let result;
  try {
    const [vehicle, inspection] = await Promise.all([fetchVehicle(carid), fetchInspection(carid)]);
    result = mapToResult(vehicle, inspection, carid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('404') || msg.includes('Not Found')) {
      return NextResponse.json({ error: 'not_found', message: 'Автомобиль не найден на Encar.' }, { status: 404 });
    }
    console.error('[encar] API error:', msg);
    return NextResponse.json({ error: 'encar_unavailable', message: 'Encar API временно недоступен.' }, { status: 502 });
  }

  // Run AI calls in parallel: power estimation + translation
  let enginePowerHp: number | undefined;

  const [powerEstimate, translation] = await Promise.all([
    body.enginePower && body.enginePower > 0
      ? Promise.resolve(null)
      : estimateEnginePower({
          make: result.make,
          model: result.model,
          grade: result.grade,
          year: result.year,
          displacement: result.displacement,
          fuelType: result.fuelType,
        }),
    translateEncarFields({
      carId: carid,
      description: result.description,
      dealerName: result.dealerName,
      dealerFirm: result.dealerFirm,
      address: result.region,
    }),
  ]);

  // Apply translation
  result.descriptionRu = translation.description;
  result.dealerName = translation.dealerName ?? result.dealerName;
  result.dealerFirm = translation.dealerFirm ?? result.dealerFirm;
  result.city = translation.city;
  if (translation.failed) result.translationFailed = true;

  // Determine engine power: user > AI > null
  if (body.enginePower && body.enginePower > 0) {
    enginePowerHp = body.enginePower;
    result.enginePower = enginePowerHp;
    result.enginePowerSource = 'user';
  } else if (powerEstimate) {
    const hp = powerEstimate.unit === 'kw' ? Math.round(powerEstimate.power * KW_TO_HP) : powerEstimate.power;
    result.enginePower = hp;
    result.enginePowerSource = 'ai';
    result.enginePowerConfidence = powerEstimate.confidence;
    enginePowerHp = hp;

    if (fuelToEngineType(result.fuelType) === 'electric') {
      result.enginePowerKw = powerEstimate.unit === 'kw' ? powerEstimate.power : Math.round(powerEstimate.power / KW_TO_HP);
    }
  }

  // Calculate cost if we have power
  let costBreakdown = null;
  if (enginePowerHp && result.priceKRW > 0) {
    try {
      const rates = await fetchCBRRates();
      const engineType = fuelToEngineType(result.fuelType);
      costBreakdown = calculateTotal({
        priceInCurrency: result.priceKRW,
        currencyCode: 'KRW',
        engineVolume: engineType === 'electric' ? 0 : result.displacement,
        enginePower: enginePowerHp,
        carAge: yearToCarAge(result.year),
        buyerType: 'individual',
        personalUse: true,
        country: 'korea',
        engineType,
      }, rates);
    } catch (err) {
      console.warn('[encar] Cost calculation failed:', err instanceof Error ? err.message : err);
    }
  }

  recordUsage(ip, telegramId);
  const remaining = checkRateLimit(ip, telegramId).remaining;

  return NextResponse.json({
    success: true,
    data: result,
    costBreakdown,
    meta: { remaining, source: 'encar-api' },
  });
}
