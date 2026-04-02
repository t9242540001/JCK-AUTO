/**
 * @file generate-article.ts
 * @description Cron-скрипт: полный pipeline генерации SEO-статьи для блога
 * @runs VDS
 * @triggers cron | manual: npx tsx -r dotenv/config scripts/generate-article.ts dotenv_config_path=.env.local
 * @input topicQueue → generator → coverGenerator → articlePublisher
 * @output content/blog/{slug}.mdx + public/images/blog/{slug}.jpg
 * @lastModified 2026-04-02
 */

import { join } from 'path';
import { getNextTopic, getTopicNewsContext, updateTopicStatus } from '../src/services/articles/topicQueue';
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

  // Шаг 1: Выбрать тему
  const topic = getNextTopic();
  if (!topic) {
    console.log('[Article] Все темы опубликованы. Нечего генерировать.');
    process.exit(0);
  }

  console.log(`[Article] Тема: ${topic.title} (id: ${topic.id}, priority: ${topic.basePriority}, wave: ${topic.wave})`);
  updateTopicStatus(topic.id, 'generating');

  // Шаг 2: Собрать контекст
  const newsContext = getTopicNewsContext(topic);
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
        tags: topic.newsKeywords.slice(0, 2),
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
    const result = await publishArticle(article, cover, topic.id);
    console.log(`[Article] Опубликовано: ${result.mdxPath}`);

    // Итог
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalCost = article.cost.estimatedCostUsd + (cover?.cost.estimatedUsd ?? 0);
    console.log(`\n[Article] Готово за ${elapsed}с | ${topic.title} | ${article.wordCount} слов | $${totalCost.toFixed(4)} | обложка: ${cover ? 'да' : 'нет'}`);
  } catch (err) {
    updateTopicStatus(topic.id, 'error');
    console.error('[Article] ОШИБКА:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Article] Unhandled error:', err);
  process.exit(1);
});
