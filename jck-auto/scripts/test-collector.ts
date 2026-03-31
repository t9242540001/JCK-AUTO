/**
 * @file test-collector.ts
 * @description Тестовый скрипт для проверки сбора новостей (этап 2)
 * @runs npx tsx scripts/test-collector.ts
 */

import { collectNews } from '../src/services/news/collector';

async function main() {
  console.log('🔄 Запуск сбора новостей из всех источников...\n');

  const result = await collectNews();
  const { stats } = result;

  console.log('═══ Статистика сбора ═══');
  console.log(`Источников всего:     ${stats.sourcesTotal}`);
  console.log(`Источников успешных:  ${stats.sourcesSucceeded}`);
  console.log(`Собрано сырых:        ${stats.rawItemsCollected}`);
  console.log(`Дубликатов удалено:   ${stats.duplicatesRemoved}`);
  console.log(`Итого новостей:       ${stats.finalItemsCount}`);
  console.log(`Время сбора:          ${stats.collectedAt}`);

  if (stats.sourcesFailed.length > 0) {
    console.log(`\n⚠️  Упавшие источники (${stats.sourcesFailed.length}):`);
    for (const name of stats.sourcesFailed) {
      console.log(`  - ${name}`);
    }
  }

  console.log('\n═══ Первые 10 новостей ═══');
  for (const item of result.items.slice(0, 10)) {
    const date = new Date(item.pubDate).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    console.log(`[${item.source}] [${item.language}] ${date}`);
    console.log(`  ${item.title}`);
    console.log('');
  }

  // Вердикт
  const ok = stats.finalItemsCount >= 50 && stats.sourcesSucceeded >= 15;
  if (ok) {
    console.log(`✅ Тест пройден: ${stats.finalItemsCount} новостей из ${stats.sourcesSucceeded} источников`);
  } else {
    console.log(`❌ Менее 50 новостей или менее 15 источников (получено: ${stats.finalItemsCount} новостей, ${stats.sourcesSucceeded} источников)`);
  }
}

main().catch(console.error);
