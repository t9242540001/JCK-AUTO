/**
 * @file auctionSheetQueue.test.ts
 * @description Tests for AuctionSheetQueue. Uses Node 20's built-in node:test runner.
 *              Run via: `npx tsx --test src/lib/auctionSheetQueue.test.ts`
 *              (tsx required because of TypeScript; zero additional deps if tsx
 *              is already in devDependencies).
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuctionSheetQueue, QueueFullError } from './auctionSheetQueue';

let queue: AuctionSheetQueue;

beforeEach(() => {
  queue = new AuctionSheetQueue();
});

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await sleep(5);
  }
}

test('enqueue returns a UUID', () => {
  const jobId = queue.enqueue(async () => 'ok');
  assert.match(jobId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  queue.__resetForTests();
});

test('single job — status transitions queued → processing → done', async () => {
  let release: () => void = () => {};
  const blocker = new Promise<void>((r) => { release = r; });
  const jobId = queue.enqueue(async () => { await blocker; return 'x'; });

  const s1 = queue.getStatus(jobId)!;
  assert.ok(s1.status === 'queued' || s1.status === 'processing');

  await waitFor(() => queue.getStatus(jobId)?.status === 'processing');
  release();

  await waitFor(() => queue.getStatus(jobId)?.status === 'done');
  const s3 = queue.getStatus(jobId)!;
  assert.equal(s3.status, 'done');
  assert.equal(s3.result, 'x');
  queue.__resetForTests();
});

test('result is propagated', async () => {
  const jobId = queue.enqueue(async () => 42);
  await waitFor(() => queue.getStatus(jobId)?.status === 'done');
  assert.equal(queue.getStatus(jobId)!.result, 42);
  queue.__resetForTests();
});

test('error is propagated', async () => {
  const jobId = queue.enqueue(async () => { throw new Error('boom'); });
  await waitFor(() => queue.getStatus(jobId)?.status === 'failed');
  const s = queue.getStatus(jobId)!;
  assert.equal(s.status, 'failed');
  assert.match(s.error ?? '', /boom/);
  queue.__resetForTests();
});

test('jobs run sequentially (concurrency=1)', async () => {
  const log: string[] = [];
  const mkJob = (label: string) => async () => {
    log.push(`${label}_start`);
    await sleep(20);
    log.push(`${label}_end`);
    return label;
  };
  const a = queue.enqueue(mkJob('A'));
  const b = queue.enqueue(mkJob('B'));
  const c = queue.enqueue(mkJob('C'));

  await waitFor(
    () => queue.getStatus(a)?.status === 'done'
       && queue.getStatus(b)?.status === 'done'
       && queue.getStatus(c)?.status === 'done',
    5000,
  );

  assert.deepEqual(log, ['A_start','A_end','B_start','B_end','C_start','C_end']);
  queue.__resetForTests();
});

test('queue full throws QueueFullError', () => {
  const slow = () => sleep(1000);
  const ids: string[] = [];
  for (let i = 0; i < queue.MAX_QUEUE_SIZE; i++) ids.push(queue.enqueue(slow));

  let thrown: unknown = null;
  try { queue.enqueue(slow); } catch (err) { thrown = err; }
  assert.ok(thrown instanceof QueueFullError);
  assert.equal((thrown as QueueFullError).code, 'queue_full');
  assert.equal(ids.length, queue.MAX_QUEUE_SIZE);
  queue.__resetForTests();
});

test('getStatus returns null for unknown jobId', () => {
  assert.equal(queue.getStatus('does-not-exist'), null);
  queue.__resetForTests();
});

test('position decreases as jobs complete', async () => {
  const mkJob = () => async () => { await sleep(20); };
  const a = queue.enqueue(mkJob());
  const b = queue.enqueue(mkJob());
  const c = queue.enqueue(mkJob());

  // c should start at position 2 (pending index 1 → position 2) — b is ahead of it.
  assert.equal(queue.getStatus(c)!.position, 2);

  await waitFor(() => queue.getStatus(a)?.status === 'done');
  // Now b should be active/done, c pending with position 1 (or already processing/done).
  await waitFor(() => {
    const s = queue.getStatus(c);
    return s != null && (s.position <= 1 || s.status !== 'queued');
  });
  void b;
  queue.__resetForTests();
});

test('stats update correctly', async () => {
  const ok = queue.enqueue(async () => 'ok');
  const bad = queue.enqueue(async () => { throw new Error('nope'); });

  await waitFor(
    () => queue.getStatus(ok)?.status === 'done'
       && queue.getStatus(bad)?.status === 'failed',
  );

  const stats = queue.getStats();
  assert.equal(stats.totalJobsEnqueued, 2);
  assert.equal(stats.totalJobsCompleted, 1);
  assert.equal(stats.totalJobsFailed, 1);
  queue.__resetForTests();
});
