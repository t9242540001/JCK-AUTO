/**
 * @file reader.ts
 * @description Чтение новостей из storage/news/ для отображения на сайте
 * @runs VDS (Next.js server-side)
 * @input /storage/news/YYYY-MM-DD.json файлы от publisher.ts
 * @output NewsDay, NewsDayPreview, пагинация, теги
 * @rule Типы mainStory/digest импортировать из processor.ts, не дублировать
 * @rule Если директория не существует — возвращать пустой массив, не throw
 * @lastModified 2026-04-01
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { StoryItem } from './processor';
import type { CoverMeta } from './publisher';

// ─── TYPES ────────────────────────────────────────────────────────────────

/** Полный день новостей — все поля из JSON-файла */
export interface NewsDay {
  date: string;
  generatedAt: string;
  model: string;
  cost: {
    promptTokens: number;
    completionTokens: number;
    estimatedUsd: number;
  };
  cover: CoverMeta | null;
  mainStory: StoryItem;
  digest: StoryItem[];
  telegramMessageId: number | null;
  sourcesProcessed: number;
  rawItemsCollected: number;
  duplicatesRemoved: number;
}

/** Облегчённая версия для списка/ленты */
export interface NewsDayPreview {
  date: string;
  mainStoryTitle: string;
  mainStoryTags: string[];
  mainStoryExcerpt: string;   // первые 200 символов mainStory.body + "..."
  digestCount: number;
  coverImagePath: string | null;
}

export interface PaginatedResult {
  items: NewsDayPreview[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const STORAGE_PATH = process.env.STORAGE_PATH || '/var/www/jckauto/storage';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── HELPERS ──────────────────────────────────────────────────────────────

function getNewsDir(): string {
  return join(STORAGE_PATH, 'news');
}

function readNewsFile(filePath: string): NewsDay | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as NewsDay;
  } catch {
    return null;
  }
}

function truncateText(text: string, max: number = 200): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '...';
}

function toPreview(day: NewsDay): NewsDayPreview {
  return {
    date: day.date,
    mainStoryTitle: day.mainStory.title,
    mainStoryTags: day.mainStory.tags,
    mainStoryExcerpt: truncateText(day.mainStory.body),
    digestCount: day.digest.length,
    coverImagePath: day.cover?.imagePath ?? null,
  };
}

/** Собрать все теги из одного дня */
function collectDayTags(day: NewsDay): string[] {
  const tags = [...day.mainStory.tags];
  for (const item of day.digest) {
    tags.push(...item.tags);
  }
  return tags;
}

/** Проверить, содержит ли день указанный тег */
function dayHasTag(day: NewsDay, tag: string): boolean {
  if (day.mainStory.tags.includes(tag)) return true;
  return day.digest.some((item) => item.tags.includes(tag));
}

// ─── MAIN FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Получить все дни новостей (превью, новые первые)
 * @output NewsDayPreview[] — пустой массив если storage пуст
 */
export function getAllNewsDays(): NewsDayPreview[] {
  const newsDir = getNewsDir();
  if (!existsSync(newsDir)) return [];

  const files = readdirSync(newsDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return [];

  const previews: NewsDayPreview[] = [];
  for (const file of files) {
    const day = readNewsFile(join(newsDir, file));
    if (day) previews.push(toPreview(day));
  }

  return previews.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Получить один день по дате
 * @input date — формат YYYY-MM-DD
 * @output NewsDay | null
 */
export function getNewsByDate(date: string): NewsDay | null {
  if (!DATE_RE.test(date)) return null;
  const filePath = join(getNewsDir(), `${date}.json`);
  if (!existsSync(filePath)) return null;
  return readNewsFile(filePath);
}

/**
 * Пагинация по дням с опциональной фильтрацией по тегу
 * @input page (с 1), limit (по умолч 7), tag (опционально)
 * @output PaginatedResult
 */
export function getNewsDaysPaginated(
  page: number = 1,
  limit: number = 7,
  tag?: string,
): PaginatedResult {
  const newsDir = getNewsDir();
  if (!existsSync(newsDir)) {
    return { items: [], total: 0, page, totalPages: 0 };
  }

  const files = readdirSync(newsDir)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a)); // новые первые

  // Читаем и фильтруем по тегу
  const filtered: NewsDayPreview[] = [];
  for (const file of files) {
    const day = readNewsFile(join(newsDir, file));
    if (!day) continue;
    if (tag && !dayHasTag(day, tag)) continue;
    filtered.push(toPreview(day));
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return { items, total, page, totalPages };
}

/**
 * Собрать все уникальные теги, отсортированные по частоте
 * @output string[] — популярные первые
 */
export function getAllTags(): string[] {
  const newsDir = getNewsDir();
  if (!existsSync(newsDir)) return [];

  const files = readdirSync(newsDir).filter((f) => f.endsWith('.json'));
  const counts = new Map<string, number>();

  for (const file of files) {
    const day = readNewsFile(join(newsDir, file));
    if (!day) continue;
    for (const tag of collectDayTags(day)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
}
