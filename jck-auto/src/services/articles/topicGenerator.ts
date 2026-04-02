/**
 * @file topicGenerator.ts
 * @description Генератор тем для статей на основе свежих новостей через AI
 * @runs VDS (cron-скрипт)
 * @input новости за 3 дня + лог публикаций + существующие статьи блога
 * @output Topic + NewsContextItem[] для передачи в generator.ts
 * @rule Тема генерируется AI на основе актуальной новостной повестки
 * @rule Проверка на дубликаты: лог + существующие slug
 * @lastModified 2026-04-02
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { callQwenText } from '@/lib/dashscope';
import { getAllNewsDays, getNewsByDate } from '@/services/news/reader';
import { generateSlug } from '@/lib/transliterate';

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

export interface GeneratedTopic {
  topic: Topic;
  newsContext: NewsContextItem[];
}

export interface PublishedLogEntry {
  date: string;
  slug: string;
  title: string;
  keywords: string[];
  country: string | null;
  wordCount: number;
  cost: number;
  newsSource: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const STORAGE_PATH = process.env.STORAGE_PATH || '/var/www/jckauto/storage';
const PROJECT_ROOT = process.env.PROJECT_ROOT || '/var/www/jckauto/app/jck-auto';
const PUBLISHED_LOG_PATH = join(STORAGE_PATH, 'articles', 'published-log.json');
const NEWS_DAYS_BACK = 3;

const TOPIC_SYSTEM_PROMPT = `Ты — главный редактор автомобильного портала JCK AUTO (импорт авто из Китая, Кореи, Японии в Россию).

Задача: на основе свежих новостей предложи тему для экспертной статьи в блог.

Аудитория: мужчины 28-50 лет, предприниматели. Рассматривают покупку авто из-за рубежа.

Требования к теме:
- Тема должна быть актуальной (привязана к новостям) и полезной для аудитории
- Не пересказ новости, а экспертный разбор: что это значит для покупателя, как влияет на цены, выбор, процесс покупки
- Можно объединить несколько новостей в одну тему если они про одно направление
- Фокус на практической пользе: как сэкономить, что выбрать, на что обратить внимание

Формат ответа — строго JSON:
{
  "title": "Заголовок статьи (50-70 символов, SEO-оптимизированный)",
  "keywords": ["ключевое слово 1", "ключевое слово 2", "ключевое слово 3"],
  "country": "china" | "korea" | "japan" | null,
  "cluster": "customs" | "buying" | "models" | "myths" | "finance" | "ev" | "safety" | "market" | "tech",
  "type": "news-driven",
  "reasoning": "Одно предложение — почему эта тема актуальна"
}`;

// ─── HELPERS ──────────────────────────────────────────────────────────────

function parseJsonResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (match?.[1]) {
      return JSON.parse(match[1]);
    }
    throw new Error('Не удалось извлечь JSON из ответа AI');
  }
}

function readPublishedLog(): PublishedLogEntry[] {
  if (!existsSync(PUBLISHED_LOG_PATH)) return [];
  try {
    return JSON.parse(readFileSync(PUBLISHED_LOG_PATH, 'utf-8')) as PublishedLogEntry[];
  } catch {
    return [];
  }
}

function getExistingSlugs(): string[] {
  const blogDir = join(PROJECT_ROOT, 'content', 'blog');
  if (!existsSync(blogDir)) return [];
  return readdirSync(blogDir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/, ''));
}

// ─── MAIN FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Сгенерировать тему для статьи на основе свежих новостей
 * @output GeneratedTopic или null если новостей нет
 */
export async function generateTopic(): Promise<GeneratedTopic | null> {
  // Новости за последние N дней
  const cutoff = Date.now() - NEWS_DAYS_BACK * 24 * 60 * 60 * 1000;
  const recentPreviews = getAllNewsDays().filter(
    (d) => new Date(d.date).getTime() >= cutoff,
  );

  if (recentPreviews.length === 0) {
    console.log('[TopicGen] Нет новостей за последние 3 дня');
    return null;
  }

  // Собрать текст новостей для промпта
  const newsItems: NewsContextItem[] = [];
  const newsBlock: string[] = [];

  for (const preview of recentPreviews) {
    const day = getNewsByDate(preview.date);
    if (!day) continue;

    newsBlock.push(`[${day.date}] ГЛАВНАЯ: ${day.mainStory.title}\n${day.mainStory.body.slice(0, 300)}`);
    newsItems.push({
      title: day.mainStory.title,
      date: day.date,
      summary: day.mainStory.body.slice(0, 200),
      source: day.mainStory.source,
    });

    for (const item of day.digest) {
      newsBlock.push(`[${day.date}] ${item.title}\n${item.body.slice(0, 150)}`);
      newsItems.push({
        title: item.title,
        date: day.date,
        summary: item.body.slice(0, 200),
        source: item.source,
      });
    }
  }

  // Список уже написанных тем
  const publishedLog = readPublishedLog();
  const existingSlugs = getExistingSlugs();
  const writtenTopics = [
    ...publishedLog.map((e) => `${e.title} (${e.slug})`),
    ...existingSlugs.map((s) => s),
  ];

  const userPrompt = `Вот новости за последние 3 дня:\n\n${newsBlock.join('\n\n')}\n\nУже написанные темы (НЕ повторять):\n${writtenTopics.join('\n')}\n\nПредложи одну тему для экспертной статьи.`;

  console.log(`[TopicGen] Новостей: ${newsItems.length}, существующих тем: ${writtenTopics.length}`);

  const response = await callQwenText(userPrompt, {
    temperature: 0.7,
    maxTokens: 1024,
    systemPrompt: TOPIC_SYSTEM_PROMPT,
  });

  const data = parseJsonResponse(response.content) as {
    title?: string;
    keywords?: string[];
    country?: string | null;
    cluster?: string;
    type?: string;
    reasoning?: string;
  };

  if (!data.title) {
    throw new Error('AI не вернул title для темы');
  }

  console.log(`[TopicGen] Тема: ${data.title} | ${data.reasoning ?? ''}`);

  // Генерация slug с проверкой коллизий
  let slug = generateSlug(data.title);
  const allSlugs = new Set([...existingSlugs, ...publishedLog.map((e) => e.slug)]);
  if (allSlugs.has(slug)) {
    slug = `${slug}-${new Date().toISOString().slice(0, 10)}`;
  }

  const topic: Topic = {
    id: slug,
    title: data.title,
    slug,
    cluster: data.cluster ?? 'market',
    type: data.type ?? 'news-driven',
    country: data.country ?? null,
    basePriority: 8,
    keywords: data.keywords ?? [],
    newsKeywords: (data.keywords ?? []).map((k) => k.split(' ')[0]),
    internalLinks: ['/calculator'],
    status: 'pending',
    generatedAt: null,
    wave: 0,
  };

  // Отобрать 3-5 наиболее релевантных новостей
  const newsContext = newsItems.slice(0, 5);

  return { topic, newsContext };
}

/**
 * Добавить запись в лог публикаций
 * @writes /storage/articles/published-log.json
 */
export function addToPublishedLog(entry: PublishedLogEntry): void {
  const log = readPublishedLog();
  log.push(entry);
  mkdirSync(dirname(PUBLISHED_LOG_PATH), { recursive: true });
  writeFileSync(PUBLISHED_LOG_PATH, JSON.stringify(log, null, 2), 'utf-8');
  console.log(`[TopicGen] Лог обновлён: ${entry.slug}`);
}
