/**
 * @file generate-news.ts
 * @description Cron-скрипт: полный pipeline генерации новостного дайджеста
 * @runs VDS
 * @triggers cron (07:00 МСК) | manual: npx tsx -r dotenv/config scripts/generate-news.ts dotenv_config_path=.env.local
 * @input collector → processor → coverGenerator → publisher
 * @output /storage/news/YYYY-MM-DD.json + /storage/news/covers/YYYY-MM-DD.jpg
 * @rule Telegram-постинг не реализован — будет добавлен отдельным этапом
 * @lastModified 2026-04-24
 */

import { join } from 'path';
import { readdirSync, statSync } from 'fs';
import { sendCronAlert } from '../src/lib/cronAlert';
import { collectNews } from '../src/services/news/collector';
import { processNews } from '../src/services/news/processor';
import { generateCover } from '../src/lib/coverGenerator';
import { publishNews } from '../src/services/news/publisher';
import type { CoverMeta } from '../src/services/news/publisher';

const DRY_RUN = process.argv.includes('--dry-run');
const STORAGE_BASE = process.env.STORAGE_PATH || '/var/www/jckauto/storage';

/**
 * @section helpers
 * Returns mtime of the newest file in `dir` matching the predicate, or null
 * if no such file exists or dir is unreadable.
 */
function newestMtime(dir: string, predicate: (name: string) => boolean): Date | null {
  try {
    const entries = readdirSync(dir).filter(predicate);
    let newest: Date | null = null;
    for (const name of entries) {
      const stat = statSync(join(dir, name));
      if (!stat.isFile()) continue;
      if (!newest || stat.mtime > newest) newest = stat.mtime;
    }
    return newest;
  } catch {
    return null;
  }
}

async function main() {
  const startTime = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Проверка NEWS_CRON_ENABLED
  if (process.env.NEWS_CRON_ENABLED !== 'true') {
    console.log('[news-cron] Disabled via NEWS_CRON_ENABLED, exiting');
    process.exit(0);
  }

  console.log(`[news-cron] Starting news pipeline for ${today}${DRY_RUN ? ' (DRY RUN)' : ''}`);

  // @rule Sibling heartbeat: news cron checks that article cron is
  // alive. Silent article failure cannot self-report — news cron is
  // the external observer. Threshold 96h = 3-day cadence + 24h jitter
  // buffer. See ADR [2026-04-24] Mutual heartbeat alerting.
  {
    const blogDir = `${process.env.PROJECT_ROOT ?? '/var/www/jckauto/app/jck-auto'}/content/blog`;
    const blogMtime = newestMtime(blogDir, (n) => n.endsWith('.mdx'));
    const STALE_ARTICLE_MS = 96 * 3600 * 1000;
    if (!blogMtime || Date.now() - blogMtime.getTime() > STALE_ARTICLE_MS) {
      const ageHours = blogMtime
        ? ((Date.now() - blogMtime.getTime()) / 3600_000).toFixed(1)
        : 'no MDX found';
      const lastModStr = blogMtime ? blogMtime.toISOString() : '—';
      console.warn(`[news-cron] WARNING: article cron appears stale (age: ${ageHours}h)`);
      await sendCronAlert({
        title: 'Article cron stale',
        body:
          `Latest article MDX: ${blogDir}\n` +
          `Last modified: ${lastModStr}\n` +
          `Age: ${ageHours}h (threshold: 96h)\n\n` +
          `Check /var/log/jckauto-articles.log and cron status. News cron continues normally.`,
        severity: 'warning',
      });
    }
  }

  // ── Шаг 1: СБОР ──────────────────────────────────────────────────────

  let collection;
  try {
    console.log('\n[news-cron] Step 1/4: Collecting news...');
    collection = await collectNews();
    const { stats } = collection;
    console.log(`[news-cron] Collected: ${stats.finalItemsCount} items from ${stats.sourcesSucceeded}/${stats.sourcesTotal} sources (${stats.duplicatesRemoved} duplicates removed)`);

    if (stats.sourcesFailed.length > 0) {
      console.log(`[news-cron] Failed sources: ${stats.sourcesFailed.join(', ')}`);
    }

    if (collection.items.length === 0) {
      console.error('[news-cron] FATAL: No news items collected. Exiting.');
      process.exit(1);
    }
  } catch (err) {
    console.error('[news-cron] FATAL: Collection failed:', err);
    // @rule Alert BEFORE exit. process.exit does not await pending
    // promises — sendCronAlert must finish (or time out) first.
    const msg = err instanceof Error ? err.message : String(err);
    await sendCronAlert({
      title: 'News cron failed — Collection step',
      body: `Step 1/4: Collecting news\n\n${msg}`,
      severity: 'error',
    });
    process.exit(1);
  }

  // ── Шаг 2: AI-ОБРАБОТКА ──────────────────────────────────────────────

  let processed;
  try {
    console.log('\n[news-cron] Step 2/4: Processing with DeepSeek...');
    processed = await processNews(collection.items, {
      sourcesProcessed: collection.stats.sourcesSucceeded,
      rawItemsCollected: collection.stats.rawItemsCollected,
      duplicatesRemoved: collection.stats.duplicatesRemoved,
    });
    console.log(`[news-cron] Processed: 1 main + ${processed.digest.length} digest | cost: $${processed.cost.estimatedUsd}`);
  } catch (err) {
    console.error('[news-cron] FATAL: Processing failed:', err);
    // @rule Alert BEFORE exit. process.exit does not await pending
    // promises — sendCronAlert must finish (or time out) first.
    const msg = err instanceof Error ? err.message : String(err);
    await sendCronAlert({
      title: 'News cron failed — Processing step',
      body: `Step 2/4: Processing with DeepSeek\n\n${msg}`,
      severity: 'error',
    });
    process.exit(1);
  }

  // ── Шаг 3: ОБЛОЖКА ───────────────────────────────────────────────────

  let coverMeta: CoverMeta | null = null;
  try {
    console.log('\n[news-cron] Step 3/4: Generating cover...');
    const coverPath = join(STORAGE_BASE, 'news', 'covers', `${today}.jpg`);
    const coverResult = await generateCover({
      title: processed.mainStory.title,
      tags: processed.mainStory.tags,
      date: today,
      type: 'news',
      outputPath: coverPath,
    });
    coverMeta = {
      imagePrompt: coverResult.imagePrompt,
      imageModel: coverResult.imageModel,
      imagePath: `/storage/news/covers/${today}.jpg`,
      imageGeneratedAt: new Date().toISOString(),
    };
    console.log(`[news-cron] Cover: ${coverResult.imageModel} | cost: $${coverResult.cost.estimatedUsd}`);
  } catch (err) {
    console.warn('[news-cron] WARNING: Cover generation failed (non-fatal):', err instanceof Error ? err.message : err);
    console.warn('[news-cron] Continuing without cover.');
  }

  // ── Шаг 4: СОХРАНЕНИЕ ────────────────────────────────────────────────

  if (DRY_RUN) {
    console.log('\n[news-cron] DRY RUN — skipping save.');
    console.log(`[news-cron] Main story: ${processed.mainStory.title}`);
    for (const item of processed.digest) {
      console.log(`[news-cron]   - ${item.title}`);
    }
  } else {
    try {
      console.log('\n[news-cron] Step 4/4: Publishing...');
      const result = publishNews(processed, coverMeta);
      console.log(`[news-cron] Published: ${result.jsonPath}`);
    } catch (err) {
      console.error('[news-cron] FATAL: Publishing failed:', err);
      // @rule Alert BEFORE exit. process.exit does not await pending
      // promises — sendCronAlert must finish (or time out) first.
      const msg = err instanceof Error ? err.message : String(err);
      await sendCronAlert({
        title: 'News cron failed — Publishing step',
        body: `Step 4/4: Publishing\n\n${msg}`,
        severity: 'error',
      });
      process.exit(1);
    }
  }

  // ── ИТОГ ──────────────────────────────────────────────────────────────

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[news-cron] Pipeline completed in ${elapsed}s. Cover: ${coverMeta ? 'yes' : 'no'}.`);
}

main().catch(async (err) => {
  console.error('[news-cron] Unhandled error:', err);
  // @rule Alert BEFORE exit — see 2.4.
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error && err.stack ? err.stack.slice(0, 2000) : '';
  await sendCronAlert({
    title: 'News cron failed — unhandled',
    body: stack ? `${msg}\n\nStack (first 2000 chars):\n${stack}` : msg,
    severity: 'error',
  });
  process.exit(1);
});
