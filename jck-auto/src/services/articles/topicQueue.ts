/**
 * @file topicQueue.ts
 * @description Очередь тем для SEO-статей: выбор следующей темы по приоритету + новостной контекст
 * @runs VDS (Next.js server-side / cron-скрипт)
 * @input data/semantic-core.json + новости из storage/news/
 * @output Topic с максимальным гибридным скором (basePriority × newsBoost)
 * @rule Приоритет: basePriority × (1 + newsScore × 0.3)
 * @lastModified 2026-04-02
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getAllNewsDays, getNewsByDate } from '@/services/news/reader';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface Topic {
  id: string;
  title: string;
  slug: string;
  cluster: string;
  type: string;
  country: string | null;
  basePriority: number;
  keywords: string[];
  newsKeywords: string[];
  internalLinks: string[];
  status: string;
  generatedAt: string | null;
  wave: number;
}

export interface NewsContextItem {
  title: string;
  date: string;
  summary: string;
  source: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const SEMANTIC_CORE_PATH = join(process.cwd(), 'data', 'semantic-core.json');

// ─── HELPERS ──────────────────────────────────────────────────────────────

function readSemanticCore(): Topic[] {
  if (!existsSync(SEMANTIC_CORE_PATH)) return [];
  try {
    const raw = readFileSync(SEMANTIC_CORE_PATH, 'utf-8');
    return JSON.parse(raw) as Topic[];
  } catch {
    return [];
  }
}

function matchesKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

// ─── MAIN FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Получить следующую тему для генерации статьи
 * @output Topic с максимальным finalScore или null если нет pending тем
 * @rule finalScore = basePriority × (1 + newsScore × 0.3)
 */
export function getNextTopic(): Topic | null {
  const topics = readSemanticCore().filter((t) => t.status === 'pending');
  if (topics.length === 0) return null;

  // Новости за последние 7 дней
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentDays = getAllNewsDays().filter(
    (d) => new Date(d.date).getTime() >= cutoff,
  );

  let bestTopic: Topic | null = null;
  let bestScore = -1;

  for (const topic of topics) {
    let newsScore = 0;
    for (const day of recentDays) {
      const text = day.mainStoryTitle + ' ' + day.mainStoryTags.join(' ');
      for (const kw of topic.newsKeywords) {
        if (matchesKeyword(text, kw)) newsScore++;
      }
    }
    const finalScore = topic.basePriority * (1 + newsScore * 0.3);
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestTopic = topic;
    }
  }

  return bestTopic;
}

/**
 * Найти новостной контекст для темы (для передачи в AI)
 * @input topic — тема из semantic-core
 * @output NewsContextItem[] — до 5 самых свежих релевантных новостей за 14 дней
 */
export function getTopicNewsContext(topic: Topic): NewsContextItem[] {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentDays = getAllNewsDays().filter(
    (d) => new Date(d.date).getTime() >= cutoff,
  );

  const matches: NewsContextItem[] = [];

  for (const preview of recentDays) {
    const day = getNewsByDate(preview.date);
    if (!day) continue;

    // Проверить mainStory
    const mainText = day.mainStory.title + ' ' + day.mainStory.tags.join(' ');
    if (topic.newsKeywords.some((kw) => matchesKeyword(mainText, kw))) {
      matches.push({
        title: day.mainStory.title,
        date: day.date,
        summary: day.mainStory.body.slice(0, 200),
        source: day.mainStory.source,
      });
    }

    // Проверить digest
    for (const item of day.digest) {
      const digestText = item.title + ' ' + item.tags.join(' ');
      if (topic.newsKeywords.some((kw) => matchesKeyword(digestText, kw))) {
        matches.push({
          title: item.title,
          date: day.date,
          summary: item.body.slice(0, 200),
          source: item.source,
        });
      }
    }
  }

  return matches.slice(0, 5);
}

/**
 * Получить все темы из semantic-core
 * @output Topic[]
 */
export function getAllTopics(): Topic[] {
  return readSemanticCore();
}

/**
 * Обновить статус темы и перезаписать файл
 * @input id — идентификатор темы, status — новый статус, generatedAt — дата генерации
 */
export function updateTopicStatus(id: string, status: string, generatedAt?: string): void {
  const topics = readSemanticCore();
  const topic = topics.find((t) => t.id === id);
  if (!topic) return;

  topic.status = status;
  if (generatedAt) topic.generatedAt = generatedAt;

  writeFileSync(SEMANTIC_CORE_PATH, JSON.stringify(topics, null, 2), 'utf-8');
}
