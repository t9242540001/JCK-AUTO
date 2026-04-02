/**
 * @file generate-article.ts
 * @description Cron-скрипт: полный pipeline генерации SEO-статьи для блога
 * @runs VDS
 * @triggers cron | manual: npx tsx -r dotenv/config scripts/generate-article.ts dotenv_config_path=.env.local
 * @input topicGenerator → generator → coverGenerator → articlePublisher
 * @output content/blog/{slug}.mdx + public/images/blog/{slug}.jpg
 * @lastModified 2026-04-03
 */

import { join } from 'path';
import { execSync } from 'child_process';
import { generateTopic, addToPublishedLog } from '../src/services/articles/topicGenerator';
import { generateArticle } from '../src/services/articles/generator';
import { publishArticle } from '../src/services/articles/articlePublisher';
import { generateCover } from '../src/lib/coverGenerator';
import { getAllInternalLinks } from '../src/lib/crossLinker';

const PROJECT_ROOT = process.env.PROJECT_ROOT || '/var/www/jckauto/app/jck-auto';

async function main() {
  const startTime = Date.now();

  if (process.env.ARTICLES_CRON_ENABLED !== 'true') {
    console.log('[Article] Disabled via ARTICLES_CRON_ENABLED, exiting');
    process.exit(0);
  }

  console.log('[Article] Запуск генератора статей...');

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
    console.log('\n[Article] Шаг 1/4: Генерация текста...');
    const article = await generateArticle(topic, newsContext, internalLinks);
    console.log(`[Article] Текст: ${article.wordCount} слов, $${article.cost.estimatedCostUsd}`);

    // Шаг 4: Сгенерировать обложку
    console.log('\n[Article] Шаг 2/4: Генерация обложки...');
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
    console.log('\n[Article] Шаг 3/4: Публикация...');
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

    // Шаг 6: Сборка и перезапуск
    console.log('\n[Article] Шаг 4/4: Сборка сайта...');
    try {
      execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 300000 });
      execSync('pm2 restart jckauto', { stdio: 'pipe', timeout: 30000 });
      console.log('[Article] Сайт пересобран и перезапущен');
    } catch (buildErr) {
      console.warn('[Article] Сборка не удалась (нефатально, статья сохранена):', buildErr instanceof Error ? buildErr.message : buildErr);
    }

    // Итог
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalCost = article.cost.estimatedCostUsd + (cover?.cost.estimatedUsd ?? 0);
    console.log(`\n[Article] Готово за ${elapsed}с | ${topic.title} | ${article.wordCount} слов | $${totalCost.toFixed(4)} | обложка: ${cover ? 'да' : 'нет'}`);
  } catch (err) {
    console.error('[Article] ОШИБКА:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Article] Unhandled error:', err);
  process.exit(1);
});
