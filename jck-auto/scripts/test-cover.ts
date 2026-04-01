/**
 * @file test-cover.ts
 * @description Тестовый скрипт генерации обложки
 * @runs npx tsx scripts/test-cover.ts
 */

import { generateCover } from '../src/lib/coverGenerator';

const OUTPUT_PATH = '/tmp/test-cover.jpg';

async function main() {
  console.log('═══ Тест генерации обложки ═══\n');

  const result = await generateCover({
    title: 'Китай запускает национальную платформу отслеживания аккумуляторов',
    tags: ['электромобили', 'китайские_авто', 'технологии'],
    date: '2026-04-01',
    type: 'news',
    outputPath: OUTPUT_PATH,
  });

  console.log('\n═══ Результат ═══');
  console.log(`Путь: ${result.imagePath}`);
  console.log(`Модель: ${result.imageModel}`);
  console.log(`Промпт: ${result.imagePrompt}`);
  console.log(`Стоимость: $${result.cost.estimatedUsd} (prompt: ${result.cost.promptTokens}, completion: ${result.cost.completionTokens})`);
  console.log(`\n✅ Обложка сохранена: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
