/**
 * @file generate-article.ts
 * @description Cron-скрипт: полный pipeline генерации SEO-статьи для блога
 * @runs VDS
 * @triggers cron | manual: npx tsx -r dotenv/config scripts/generate-article.ts dotenv_config_path=.env.local
 * @input topicGenerator → generator → coverGenerator → articlePublisher
 * @output content/blog/{slug}.mdx + public/images/blog/{slug}.jpg
 * @lastModified 2026-04-24
 */

import { join } from 'path';
import { readdirSync, statSync } from 'fs';
import { sendCronAlert } from '../src/lib/cronAlert';
import { generateTopic, addToPublishedLog } from '../src/services/articles/topicGenerator';
import { generateArticle } from '../src/services/articles/generator';
import { publishArticle } from '../src/services/articles/articlePublisher';
import { generateCover } from '../src/lib/coverGenerator';
import { getAllInternalLinks } from '../src/lib/crossLinker';

const PROJECT_ROOT = process.env.PROJECT_ROOT || '/var/www/jckauto/app/jck-auto';

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

  if (process.env.ARTICLES_CRON_ENABLED !== 'true') {
    console.log('[Article] Disabled via ARTICLES_CRON_ENABLED, exiting');
    process.exit(0);
  }

  console.log('[Article] Запуск генератора статей...');

  // @rule Sibling heartbeat: article cron checks that news cron is
  // alive. Silent news failure cannot self-report — articles cron is
  // the external observer. Threshold 36h = daily cadence + 50% jitter
  // buffer. See ADR [2026-04-24] Mutual heartbeat alerting.
  {
    const newsDir = `${process.env.STORAGE_PATH ?? '/var/www/jckauto/storage'}/news`;
    const newsMtime = newestMtime(newsDir, (n) => n.endsWith('.json'));
    const STALE_NEWS_MS = 36 * 3600 * 1000;
    if (!newsMtime || Date.now() - newsMtime.getTime() > STALE_NEWS_MS) {
      const ageHours = newsMtime
        ? ((Date.now() - newsMtime.getTime()) / 3600_000).toFixed(1)
        : 'no JSON found';
      const lastModStr = newsMtime ? newsMtime.toISOString() : '—';
      console.warn(`[Article] WARNING: news cron appears stale (age: ${ageHours}h)`);
      await sendCronAlert({
        title: 'News cron stale',
        body:
          `Latest news JSON: ${newsDir}\n` +
          `Last modified: ${lastModStr}\n` +
          `Age: ${ageHours}h (threshold: 36h)\n\n` +
          `Check /var/log/jckauto-news.log and cron status. Article cron continues normally.`,
        severity: 'warning',
      });
    }
  }

  // Шаг 1: AI анализирует новости и генерирует тему
  console.log('[Article] Анализ новостей за 3 дня...');
  const result = await generateTopic();
  if (!result) {
    console.log('[Article] Нет свежих новостей для генерации темы. Выход.');
    process.exit(0);
  }
  const { topic, newsContext } = result;

  console.log(`[Article] Тема: ${topic.title} (cluster: ${topic.cluster}, country: ${topic.country})`);

  // Шаг 2: Собрать контекст ссылок
  const internalLinks = getAllInternalLinks();
  console.log(`[Article] Контекст: ${newsContext.length} новостей, ${internalLinks.length} внутренних ссылок`);

  try {
    // Шаг 3: Сгенерировать текст
    console.log('\n[Article] Шаг 1/3: Генерация текста...');
    const article = await generateArticle(topic, newsContext, internalLinks);
    console.log(`[Article] Текст: ${article.wordCount} слов, $${article.cost.estimatedCostUsd}`);

    // Шаг 4: Сгенерировать обложку
    console.log('\n[Article] Шаг 2/3: Генерация обложки...');
    let cover = null;
    try {
      const coverPath = join(PROJECT_ROOT, 'public', 'images', 'blog', `${article.slug}.jpg`);
      cover = await generateCover({
        title: article.frontmatter.title,
        tags: topic.keywords.slice(0, 2),
        date: article.frontmatter.date,
        type: 'article',
        style: 'realistic',
        outputPath: coverPath,
      });
      console.log(`[Article] Обложка: ${cover.imageModel}, $${cover.cost.estimatedUsd}`);
    } catch (err) {
      console.warn(`[Article] Обложка не сгенерирована (нефатально): ${err instanceof Error ? err.message : err}`);
    }

    // Шаг 5: Опубликовать
    console.log('\n[Article] Шаг 3/3: Публикация...');
    const pubResult = await publishArticle(article, cover);
    console.log(`[Article] Опубликовано: ${pubResult.mdxPath}`);

    // Записать в лог
    addToPublishedLog({
      date: new Date().toISOString().slice(0, 10),
      slug: article.slug,
      title: article.frontmatter.title,
      keywords: topic.keywords,
      country: topic.country,
      wordCount: article.wordCount,
      cost: article.cost.estimatedCostUsd + (cover?.cost.estimatedUsd ?? 0),
      newsSource: newsContext.map((n) => n.date).join(','),
    });

    // @rule: NEVER run `npm run build` or any build command from this script.
    // A bare `npm run build` (without NEXT_DIST_DIR) creates `.next/` as a
    // regular directory, destroying the two-slot atomic symlink used by
    // deploy.yml. This caused production outages on 2026-04-09 and again
    // on 2026-04-15. A new article will appear on /blog/[slug] (SSG) only
    // after the next deploy. To force immediate appearance, push a trivial
    // commit to main — auto-deploy will rebuild with NEXT_DIST_DIR via
    // deploy.yml. Do NOT add execSync, spawn, or any process-spawning
    // mechanism to this file. Article generation publishes the MDX file
    // and that is its single responsibility.

    // Итог
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalCost = article.cost.estimatedCostUsd + (cover?.cost.estimatedUsd ?? 0);
    console.log(`\n[Article] Готово за ${elapsed}с | ${topic.title} | ${article.wordCount} слов | $${totalCost.toFixed(4)} | обложка: ${cover ? 'да' : 'нет'}`);
  } catch (err) {
    console.error('[Article] ОШИБКА:', err);
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error('[Article] Unhandled error:', err);
  // @rule Alert BEFORE exit. process.exit does not await pending
  // promises — sendCronAlert must finish (or time out) first.
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error && err.stack ? err.stack.slice(0, 2000) : '';
  await sendCronAlert({
    title: 'Article cron failed',
    body: stack ? `${msg}\n\nStack (first 2000 chars):\n${stack}` : msg,
    severity: 'error',
  });
  process.exit(1);
});
