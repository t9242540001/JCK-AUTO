/**
 * @file collector.ts
 * @description Сбор сырых новостей из всех RSS-источников с дедупликацией
 * @runs VDS, вызывается из cron-скрипта (этап 4, будет позже)
 * @input NEWS_SOURCES из sources.ts
 * @output CollectionResult с массивом дедуплицированных RawNewsItem[]
 * @next src/services/news/processor.ts (этап 3, будет позже)
 * @rule Promise.allSettled — один упавший фид не должен убить весь сбор
 * @rule Дедупликация: Jaccard similarity на словах заголовка, порог ≥0.7
 * @rule Фильтр: только новости за последние 48 часов
 * @rule Сортировка: по дате, новые первые
 * @lastModified 2026-03-31
 */

import { parseRSSFeed, type RawNewsItem } from '@/lib/rssParser';
import { NEWS_SOURCES } from './sources';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface CollectionResult {
  items: RawNewsItem[];
  stats: {
    sourcesTotal: number;
    sourcesSucceeded: number;
    sourcesFailed: string[];
    rawItemsCollected: number;
    duplicatesRemoved: number;
    finalItemsCount: number;
    collectedAt: string; // ISO 8601
  };
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 часов
const JACCARD_THRESHOLD = 0.7;

// ─── HELPERS ──────────────────────────────────────────────────────────────

/** Нормализовать заголовок в массив слов (lowercase, без пунктуации) */
function normalizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Jaccard similarity на множествах слов: |пересечение| / |объединение| */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Дедупликация: Jaccard ≥0.7 на заголовках — оставить более новый
 * @rule O(n²) по заголовкам — приемлемо для ~200-500 новостей
 */
function deduplicateItems(items: RawNewsItem[]): { unique: RawNewsItem[]; removedCount: number } {
  const normalized = items.map((item) => normalizeTitle(item.title));
  const removed = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < items.length; j++) {
      if (removed.has(j)) continue;
      if (jaccardSimilarity(normalized[i], normalized[j]) >= JACCARD_THRESHOLD) {
        // Оставить более новый
        const dateI = new Date(items[i].pubDate).getTime();
        const dateJ = new Date(items[j].pubDate).getTime();
        removed.add(dateI >= dateJ ? j : i);
      }
    }
  }

  const unique = items.filter((_, idx) => !removed.has(idx));
  return { unique, removedCount: removed.size };
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

/**
 * Собрать новости из всех включённых RSS-источников
 * @input NEWS_SOURCES (enabled: true)
 * @output CollectionResult с дедуплицированными новостями за 48 часов
 * @important Promise.allSettled — упавший фид не убивает весь сбор
 */
export async function collectNews(): Promise<CollectionResult> {
  const enabledSources = NEWS_SOURCES.filter((s) => s.enabled);
  const sourcesTotal = enabledSources.length;

  // Параллельный сбор из всех источников
  const results = await Promise.allSettled(
    enabledSources.map((source) =>
      parseRSSFeed(source.url, source.name, source.language),
    ),
  );

  const allItems: RawNewsItem[] = [];
  const sourcesFailed: string[] = [];
  let sourcesSucceeded = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      if (result.value.length > 0) {
        sourcesSucceeded++;
        allItems.push(...result.value);
      } else {
        // parseRSSFeed вернул [] — источник ответил, но без данных или с ошибкой
        sourcesFailed.push(enabledSources[i].name);
      }
    } else {
      sourcesFailed.push(enabledSources[i].name);
    }
  }

  const rawItemsCollected = allItems.length;

  // Фильтр: только новости за последние 48 часов
  const cutoff = Date.now() - MAX_AGE_MS;
  const recentItems = allItems.filter((item) => {
    const ts = new Date(item.pubDate).getTime();
    return !isNaN(ts) && ts >= cutoff;
  });

  // Дедупликация по заголовкам
  const { unique, removedCount } = deduplicateItems(recentItems);

  // Сортировка: новые первые
  unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return {
    items: unique,
    stats: {
      sourcesTotal,
      sourcesSucceeded,
      sourcesFailed,
      rawItemsCollected,
      duplicatesRemoved: removedCount,
      finalItemsCount: unique.length,
      collectedAt: new Date().toISOString(),
    },
  };
}
