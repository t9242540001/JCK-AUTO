/**
 * @file route.ts
 * @description POST endpoint for Japanese auction-sheet AI decode.
 *              Async-only contract: enqueues pipeline via auctionSheetQueue,
 *              returns 202 Accepted with jobId. Clients poll the result
 *              via GET /api/tools/auction-sheet/job/[jobId].
 * @runs VDS
 * @input POST multipart/form-data with image (jpg/png/webp/heic, up to 10 MB)
 * @output 202 Accepted {jobId, statusUrl, position, etaSec}.
 *         429/400/503 for rate-limited / malformed / queue-full.
 * @cost ~$0.004-0.006/request once job runs (3 OCR passes + 1 parse call).
 * @rule Rate limit: anonymous — 3 per IP lifetime; Telegram-auth — 10/day.
 * @rule Не логировать содержимое изображений.
 * @rule POST handler MUST route the pipeline through
 *       runAuctionSheetPipeline() only, and only via
 *       auctionSheetQueue.enqueue(). Direct DashScope or DeepSeek
 *       calls from this file are FORBIDDEN — they bypass the
 *       concurrency=1 lock and will cause upstream throttling.
 * @dependencies jose (jwtVerify), next/headers (cookies), JWT_SECRET,
 *               src/lib/auctionSheetService (runAuctionSheetPipeline),
 *               src/lib/rateLimiter (checkRateLimit — pre-enqueue gate),
 *               src/lib/auctionSheetQueue (queue with concurrency=1),
 *               sharp 0.34.5 (HEIC via libheif 1.20.2)
 * @lastModified 2026-04-21
 */

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import { checkRateLimit } from '@/lib/rateLimiter';
import { auctionSheetQueue, QueueFullError } from '@/lib/auctionSheetQueue';
import { runAuctionSheetPipeline } from '@/lib/auctionSheetService';

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 МБ
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// ─── HELPERS ──────────────────────────────────────────────────────────────

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
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

  // Rate limit (per-user quota — 3/lifetime anon, 10/day Telegram).
  const limit = checkRateLimit(ip, telegramId);
  if (!limit.allowed) {
    return NextResponse.json({
      error: 'rate_limit',
      message: limit.remaining > 0
        ? 'Подождите немного — запросы принимаются раз в 2 минуты.'
        : telegramId
          ? 'Дневной лимит запросов исчерпан (10 в день). Завтра лимит обновится.'
          : 'Лимит бесплатных расшифровок исчерпан. Войдите через Telegram для 10 запросов в день.',
      remaining: limit.remaining,
      isLifetimeLimit: limit.isLifetimeLimit ?? false,
      resetIn: limit.resetIn,
      alternatives: {
        telegram: 'https://t.me/jckauto_help_bot',
        manager: 'https://t.me/jck_auto_manager',
      },
    }, { status: 429 });
  }

  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Ожидается multipart/form-data' },
      { status: 400 },
    );
  }

  const file = formData.get('image') as File | null;

  if (!file) {
    return NextResponse.json(
      { error: 'no_file', message: 'Загрузите фото аукционного листа' },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'file_too_large', message: 'Файл слишком большой (максимум 10 МБ)' },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'invalid_type', message: 'Поддерживаемые форматы: JPG, PNG, WebP, HEIC' },
      { status: 400 },
    );
  }

  // @rule Sharp compression MUST run BEFORE enqueue, inside the POST handler.
  //       A corrupt or unreadable upload has to fail synchronously with 400,
  //       not asynchronously via a wasted queue slot.
  let compressedBuffer: Buffer;
  try {
    const bytes = await file.arrayBuffer();
    compressedBuffer = await sharp(Buffer.from(bytes))
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .sharpen({ sigma: 0.5 })
      .toBuffer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[auction-sheet] Sharp compression failed: ${msg.slice(0, 120)}`);
    return NextResponse.json(
      { error: 'invalid_image', message: 'Не удалось прочитать файл. Проверьте, что это валидное изображение.' },
      { status: 400 },
    );
  }

  // @rule POST returns 202 Accepted (NOT 200). The pipeline runs asynchronously
  //       in the queue worker; clients MUST poll GET /api/tools/auction-sheet/job/[jobId]
  //       to retrieve the final result or error.
  // @rule QueueFullError MUST map to HTTP 503 Service Unavailable + Retry-After: 300
  //       (NOT 429). 429 is reserved for per-user rate-limit exhaustion; 503
  //       signals transient server-capacity exhaustion that affects every user.
  let jobId: string;
  try {
    jobId = auctionSheetQueue.enqueue(() =>
      runAuctionSheetPipeline(compressedBuffer, {
        channel: 'web',
        ip,
        telegramId,
      }),
    );
  } catch (err) {
    if (err instanceof QueueFullError) {
      console.warn(`[auction-sheet] Queue full — rejecting request from ip=${ip}`);
      return NextResponse.json(
        {
          error: 'queue_full',
          message: 'Сервис временно перегружен. Попробуйте через 5 минут.',
        },
        {
          status: 503,
          headers: {
            'Retry-After': '300',
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json; charset=utf-8',
          },
        },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[auction-sheet] Enqueue failed unexpectedly: ${msg}`);
    return NextResponse.json(
      { error: 'enqueue_failed', message: 'Не удалось поставить задачу в очередь. Попробуйте позже.' },
      { status: 500 },
    );
  }

  const snapshot = auctionSheetQueue.getStatus(jobId);
  const statusUrl = `/api/tools/auction-sheet/job/${jobId}`;

  return NextResponse.json(
    {
      jobId,
      statusUrl,
      position: snapshot?.position ?? 0,
      etaSec: snapshot?.etaSec ?? 0,
    },
    {
      status: 202,
      headers: {
        Location: statusUrl,
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}
