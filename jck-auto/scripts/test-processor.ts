/**
 * @file test-processor.ts
 * @description Тестовый скрипт: collector → processor → результат в /tmp
 * @runs npx tsx scripts/test-processor.ts
 */

import { writeFileSync } from 'fs';
import { collectNews } from '../src/services/news/collector';
import { processNews } from '../src/services/news/processor';

const OUTPUT_PATH = '/tmp/test-processor-result.json';

async function main() {
  console.log('═══ Этап 1: Сбор новостей ═══\n');

  const collection = await collectNews();
  const { stats } = collection;

  console.log(`Источников: ${stats.sourcesSucceeded}/${stats.sourcesTotal}`);
  console.log(`Собрано: ${stats.rawItemsCollected} → дедупликация → ${stats.finalItemsCount}`);

  if (stats.sourcesFailed.length > 0) {
    console.log(`Упавшие: ${stats.sourcesFailed.join(', ')}`);
  }

  if (collection.items.length === 0) {
    console.log('\n❌ Нет новостей для обработки');
    process.exit(1);
  }

  console.log('\n═══ Этап 2: AI-обработка через DeepSeek ═══\n');

  const result = await processNews(collection.items, {
    sourcesProcessed: stats.sourcesSucceeded,
    rawItemsCollected: stats.rawItemsCollected,
    duplicatesRemoved: stats.duplicatesRemoved,
  });

  console.log('\n═══ Результат ═══\n');
  console.log(`Дата: ${result.date}`);
  console.log(`Модель: ${result.model}`);
  console.log(`Стоимость: $${result.cost.estimatedUsd} (prompt: ${result.cost.promptTokens}, completion: ${result.cost.completionTokens})`);

  console.log(`\nГлавная новость:`);
  console.log(`  ${result.mainStory.title}`);
  console.log(`  [${result.mainStory.source}] теги: ${result.mainStory.tags.join(', ')}`);

  console.log(`\nДайджест (${result.digest.length}):`);
  for (const item of result.digest) {
    console.log(`  - ${item.title}`);
    console.log(`    [${item.source}] теги: ${item.tags.join(', ')}`);
  }

  // Сохранить полный результат
  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n✅ Полный результат сохранён: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
