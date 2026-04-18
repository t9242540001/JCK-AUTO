/**
 * @file route.ts
 * @description GET /api/tools/auction-sheet/stats — admin-only snapshot of queue stats.
 *              Returns aggregated metrics (peak, throughput, rejection count, avg times).
 *              Access: JWT cookie `tg_auth` whose `telegramId` is in ADMIN_TELEGRAM_IDS env (CSV).
 * @runs VDS (via Next.js App Router on PM2)
 * @env JWT_SECRET (JWT verification), ADMIN_TELEGRAM_IDS (CSV list of admin telegram IDs)
 * @rule Admin-only endpoint. Changes to auth logic require security review.
 * @rule Do NOT expose jobId list or individual result bodies here — only aggregated stats.
 *       Individual jobs have their own endpoint (/job/[jobId]).
 * @rule ADMIN_TELEGRAM_IDS is CSV list in env. Empty/missing → endpoint ALWAYS returns 403
 *       (fail-closed, not fail-open). Do NOT add a default admin list in code.
 * @rule Log unauthorized access ONLY when cookie is valid but telegramId is not admin
 *       (signal someone knows this endpoint exists). Do NOT log missing-cookie cases
 *       (noise that floods pm2 logs).
 */

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { auctionSheetQueue } from '@/lib/auctionSheetQueue';

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Extract telegramId from tg_auth JWT cookie.
 * Returns null on any error (missing, invalid, expired, missing env secret).
 */
async function getTelegramIdFromCookie(): Promise<string | null> {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return null;

    const cookieStore = await cookies();
    const token = cookieStore.get('tg_auth')?.value;
    if (!token) return null;

    const secretBytes = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secretBytes);
    const id = payload.telegramId;
    if (!id) return null;

    return String(id);
  } catch {
    return null;
  }
}

/**
 * Parse ADMIN_TELEGRAM_IDS env var into a Set of admin telegram IDs.
 * Returns empty Set if env is unset or empty (→ endpoint fail-closed 403).
 */
function getAdminIds(): Set<string> {
  const raw = process.env.ADMIN_TELEGRAM_IDS ?? '';
  return new Set(
    raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0),
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  };

  const telegramId = await getTelegramIdFromCookie();
  if (!telegramId) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Требуется авторизация через Telegram' },
      { status: 401, headers },
    );
  }

  const adminIds = getAdminIds();
  if (!adminIds.has(telegramId)) {
    // Valid cookie but not admin — log for security observability.
    // Do NOT log the telegramId itself (PII); IP is sufficient.
    console.warn(
      `[stats] unauthorized access attempt from ip=${getClientIp(request)}`,
    );
    return NextResponse.json(
      { error: 'forbidden', message: 'Недостаточно прав' },
      { status: 403, headers },
    );
  }

  const stats = auctionSheetQueue.getStats();
  return NextResponse.json(stats, { status: 200, headers });
}
