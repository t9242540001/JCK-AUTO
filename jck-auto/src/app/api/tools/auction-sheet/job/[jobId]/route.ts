/**
 * @file route.ts
 * @description GET /api/tools/auction-sheet/job/[jobId] — поллинг статуса задачи.
 *              Возвращает позицию в очереди / ETA / результат / ошибку.
 *              Клиент вызывает раз в ~2s из UI для отслеживания прогресса.
 * @runs VDS (via Next.js App Router on PM2)
 * @input GET with URL path param `jobId` (UUID v4 string)
 * @output JSON response — see HANDLER DOC below
 * @rule jobId MUST match UUID v4 regex BEFORE being passed to auctionSheetQueue.getStatus().
 *       Unvalidated strings can pollute logs and may exploit future indexing bugs.
 *       Return 400 {error:'invalid_job_id'} on mismatch.
 * @rule Do NOT add auth or rate-limit here. GET is idempotent and safe to poll;
 *       clients poll every ~2s. Auth and rate-limit belong on the POST that creates the job.
 * @rule Return HTTP 200 with body {status:'failed', error:'...'} for business-logic failures
 *       (the job ran and its handler threw). Use 4xx ONLY for malformed requests (400)
 *       or unknown/expired jobIds (404). Do NOT return 500 for job failures —
 *       the job succeeded at the queue level even if the work inside it failed.
 */

import { NextResponse } from 'next/server';
import { auctionSheetQueue } from '@/lib/auctionSheetQueue';

// RFC 9562 UUID v4: 8-4-4-4-12 hex chars, version nibble = 4, variant nibble = 8/9/a/b
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * HANDLER DOC — response shapes
 *
 * 400 {error: 'invalid_job_id', message: 'Идентификатор задачи имеет неверный формат'}
 *   — jobId param doesn't match UUID v4.
 *
 * 404 {error: 'job_not_found', message: 'Задача не найдена или устарела'}
 *   — getStatus returned null (unknown OR TTL-expired after 15 min).
 *
 * 200 (queued)      {jobId, status:'queued', position, etaSec, enqueuedAt, ...}
 * 200 (processing)  {jobId, status:'processing', position:0, etaSec, startedAt, ...}
 * 200 (done)        {jobId, status:'done', result, completedAt, ...}
 * 200 (failed)      {jobId, status:'failed', error, completedAt, ...}
 *
 * All 200/400/404 responses include:
 *   Cache-Control: no-store
 *   Content-Type: application/json; charset=utf-8
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const resolved = await params;
  const jobId = resolved?.jobId;

  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (typeof jobId !== 'string') {
    console.warn('[job-status] malformed params', { params: resolved });
    return NextResponse.json(
      { error: 'invalid_job_id', message: 'Идентификатор задачи имеет неверный формат' },
      { status: 400, headers },
    );
  }

  if (!UUID_V4_RE.test(jobId)) {
    return NextResponse.json(
      { error: 'invalid_job_id', message: 'Идентификатор задачи имеет неверный формат' },
      { status: 400, headers },
    );
  }

  const snapshot = auctionSheetQueue.getStatus(jobId);
  if (snapshot === null) {
    return NextResponse.json(
      { error: 'job_not_found', message: 'Задача не найдена или устарела' },
      { status: 404, headers },
    );
  }

  return NextResponse.json(snapshot, { status: 200, headers });
}
