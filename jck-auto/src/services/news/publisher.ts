/**
 * @file publisher.ts
 * @description Сохранение результатов новостного pipeline на диск (JSON + метаданные)
 * @runs VDS
 * @input ProcessedNews от processor.ts, путь обложки от coverGenerator.ts
 * @output /storage/news/YYYY-MM-DD.json
 * @rule Telegram-постинг не реализован — будет добавлен отдельным этапом
 * @rule Таймзона: Владивосток (+10) для generatedAt
 * @lastModified 2026-04-01
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ProcessedNews } from './processor';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface CoverMeta {
  imagePrompt: string;
  imageModel: string;
  imagePath: string;
  imageGeneratedAt: string;
}

export interface PublishResult {
  jsonPath: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const STORAGE_BASE = process.env.STORAGE_PATH || '/var/www/jckauto/storage';

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

/**
 * Сохранить результат pipeline на диск в формате JSON
 * @input processed — результат от processor.ts, coverPath — путь к обложке (или null)
 * @output PublishResult — путь к сохранённому JSON
 * @writes /storage/news/YYYY-MM-DD.json
 */
export function publishNews(
  processed: ProcessedNews,
  coverMeta: CoverMeta | null,
): PublishResult {
  const newsDir = join(STORAGE_BASE, 'news');
  const coversDir = join(STORAGE_BASE, 'news', 'covers');
  mkdirSync(newsDir, { recursive: true });
  mkdirSync(coversDir, { recursive: true });

  const date = processed.date;
  const jsonPath = join(newsDir, `${date}.json`);

  if (existsSync(jsonPath)) {
    console.log(`[publisher] Overwriting existing file for ${date}`);
  }

  // Таймзона Владивосток (+10)
  const generatedAt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Vladivostok' }).replace(' ', 'T') + '+10:00';

  const output = {
    date,
    generatedAt,
    model: processed.model,
    cost: processed.cost,
    cover: coverMeta ? {
      imagePrompt: coverMeta.imagePrompt,
      imageModel: coverMeta.imageModel,
      imagePath: coverMeta.imagePath,
      imageGeneratedAt: coverMeta.imageGeneratedAt,
    } : null,
    mainStory: processed.mainStory,
    digest: processed.digest,
    telegramMessageId: null,
    sourcesProcessed: processed.sourcesProcessed,
    rawItemsCollected: processed.rawItemsCollected,
    duplicatesRemoved: processed.duplicatesRemoved,
  };

  writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`[publisher] Saved: ${jsonPath}`);

  return { jsonPath };
}
