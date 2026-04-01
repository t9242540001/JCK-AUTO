/**
 * @file processor.ts
 * @description AI-обработка новостей: отбор, ранжирование, пересказ через DeepSeek
 * @input RawNewsItem[] от collector.ts
 * @output ProcessedNews — структурированный дайджест (1 главная + 4-5 кратких)
 * @cost ~3500 prompt + ~2100 completion tokens ≈ $0.002 за вызов
 * @rule Системный промпт менять только с явного согласования — он определяет тон и формат всего контента
 * @rule DeepSeek должен возвращать строго JSON, без markdown-обёрток
 * @lastModified 2026-03-31
 */

import { callDeepSeek } from '@/lib/deepseek';
import type { RawNewsItem } from '@/lib/rssParser';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface StoryItem {
  title: string;
  body: string;
  source: string;
  sourceUrl: string;
  tags: string[];
}

export interface ProcessedNews {
  date: string;                    // "2026-03-31"
  model: string;                   // "deepseek-chat"
  cost: {
    promptTokens: number;
    completionTokens: number;
    estimatedUsd: number;
  };
  mainStory: StoryItem;
  digest: StoryItem[];
  sourcesProcessed: number;
  rawItemsCollected: number;
  duplicatesRemoved: number;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const MAX_INPUT_ITEMS = 80;
const MAX_RETRIES = 2;

/** Фиксированный список тегов — DeepSeek выбирает только из них */
const ALLOWED_TAGS = [
  'китайские_авто', 'корейские_авто', 'японские_авто',
  'электромобили', 'гибриды', 'импорт', 'утильсбор',
  'таможня', 'законодательство', 'рынок_РФ',
  'технологии', 'безопасность', 'автоспорт', 'глобальный_рынок',
] as const;

/**
 * @rule Менять только с явного согласования — определяет тон и формат всего контента
 */
const SYSTEM_PROMPT = `Ты — главный редактор новостного раздела сайта JCK AUTO (импорт авто из Китая, Кореи, Японии в Россию).
Целевая аудитория: мужчины 28-50, предприниматели, рассматривают покупку авто из-за рубежа.
Тон: экспертный, спокойный, без восклицательных знаков и кликбейта. Факты важнее эмоций.

Задача: из списка новостей отбери 5-6 самых значимых для аудитории JCK AUTO.
Приоритеты при отборе:
- Импорт авто в Россию, утильсбор, таможенные правила
- Китайские бренды (BYD, Chery, Geely, Changan, Haval и др.)
- Электромобили, гибриды
- Корейские и японские бренды
- Общие автоновости — только если реально значимые

Формат ответа — строго JSON (без markdown-обёрток, без \`\`\`):
{
  "mainStory": {
    "title": "Заголовок главной новости на русском",
    "body": "Развёрнутый пересказ 300-500 слов. Экспертный анализ: что это значит для покупателей авто из-за рубежа. Конкретные цифры, факты, последствия.",
    "sourceIndex": <номер из списка>,
    "tags": ["тег1", "тег2"]
  },
  "digest": [
    {
      "title": "Заголовок на русском",
      "body": "Краткий пересказ 100-150 слов. Суть + почему это важно для аудитории.",
      "sourceIndex": <номер>,
      "tags": ["тег1"]
    }
  ]
}

Правила:
- mainStory: 1 новость, самая значимая. Пересказ 300-500 слов с экспертным комментарием.
- digest: 4-5 новостей. Каждая — 100-150 слов.
- Все тексты на русском языке (даже если источник на EN или ZH).
- tags — только из списка: ${ALLOWED_TAGS.join(', ')}
- sourceIndex — номер новости из входного списка (начиная с 1)
ПРАВИЛО РАЗНООБРАЗИЯ (обязательно):
- Новости разделены на секции с квотами — выбирай строго по квотам каждой секции
- Итого должно быть 5-6 новостей из разных секций
- Это правило приоритетнее релевантности отдельной новости
- Не придумывай факты. Если информации мало — скажи что известно.
- Ответ — ТОЛЬКО валидный JSON, без пояснений до или после.`;

// ─── HELPERS ──────────────────────────────────────────────────────────────

/** Отформатировать элементы корзины со сквозной нумерацией */
function formatBucket(items: RawNewsItem[], allItems: RawNewsItem[]): string {
  return items
    .map((item) => {
      const idx = allItems.indexOf(item) + 1;
      const date = new Date(item.pubDate).toLocaleDateString('ru-RU');
      return `${idx}. [${item.source}] [${item.language}] ${date}\n   ${item.title}\n   ${item.snippet}`;
    })
    .join('\n\n');
}

/** Подготовить секционный промпт из корзин */
function formatSectionedPrompt(buckets: BalancedBuckets): string {
  const sections: string[] = [];

  if (buckets.china.length > 0) {
    sections.push(
      `=== СЕКЦИЯ 1: КИТАЙСКИЕ АВТО (выбери из этой секции 1-2 лучших) ===\n${formatBucket(buckets.china, buckets.all)}`,
    );
  }
  if (buckets.ev.length > 0) {
    sections.push(
      `=== СЕКЦИЯ 2: ЭЛЕКТРОМОБИЛИ И БАТАРЕИ (выбери из этой секции 1-2 лучших) ===\n${formatBucket(buckets.ev, buckets.all)}`,
    );
  }
  if (buckets.russia.length > 0) {
    sections.push(
      `=== СЕКЦИЯ 3: РОССИЯ, ЗАКОНОДАТЕЛЬСТВО, ТАМОЖНЯ (выбери из этой секции 1-2 лучших, если есть) ===\n${formatBucket(buckets.russia, buckets.all)}`,
    );
  }
  if (buckets.other.length > 0) {
    sections.push(
      `=== СЕКЦИЯ 4: ГЛОБАЛЬНЫЙ АВТОПРОМ, ТЕХНОЛОГИИ, АВТОСПОРТ, СУПЕРКАРЫ (выбери из этой секции 2-3 лучших) ===\n${formatBucket(buckets.other, buckets.all)}`,
    );
  }

  return sections.join('\n\n');
}

/** Попробовать распарсить JSON, включая извлечение из markdown-блока */
function parseJsonResponse(text: string): unknown {
  // Попытка 1: прямой JSON.parse
  try {
    return JSON.parse(text);
  } catch {
    // Попытка 2: извлечь из ```json...```
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (match?.[1]) {
      return JSON.parse(match[1]);
    }
    throw new Error('Не удалось извлечь JSON из ответа DeepSeek');
  }
}

/** Отфильтровать теги — оставить только из ALLOWED_TAGS */
function filterTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string =>
    typeof t === 'string' && (ALLOWED_TAGS as readonly string[]).includes(t),
  );
}

// ─── BALANCER ─────────────────────────────────────────────────────────────

const CHINA_RE = /china|chinese|chery|byd|geely|changan|nio|xpeng|li auto|zeekr|haval|tank|dongfeng|gac|great wall|wey|jac|faw|saic|中国|汽车|新能源|比亚迪|吉利|长安|蔚来/i;
const EV_RE = /electric|ev\b|battery|charging|tesla|электромобил|электрокар|аккумулятор|зарядк/i;
const RUSSIA_RE = /россия|российск|утильсбор|растаможк|таможен|пошлин|\bрф\b|автоваз|лада|moscow|russia/i;

const QUOTA_CHINA = 20;
const QUOTA_EV = 15;
const QUOTA_RUSSIA = 15;

interface BalancedBuckets {
  china: RawNewsItem[];
  ev: RawNewsItem[];
  russia: RawNewsItem[];
  other: RawNewsItem[];
  all: RawNewsItem[]; // сквозной список для sourceIndex
}

/** Программная балансировка входного списка по тематическим корзинам */
function balanceItems(items: RawNewsItem[]): BalancedBuckets {
  const china: RawNewsItem[] = [];
  const ev: RawNewsItem[] = [];
  const russia: RawNewsItem[] = [];
  const other: RawNewsItem[] = [];

  for (const item of items) {
    const t = item.title + ' ' + item.snippet;
    if (CHINA_RE.test(t)) {
      china.push(item);
    } else if (EV_RE.test(t)) {
      ev.push(item);
    } else if (RUSSIA_RE.test(t)) {
      russia.push(item);
    } else {
      other.push(item);
    }
  }

  // Применить квоты — внутри каждой корзины уже отсортированы по дате (от collector)
  const pickedChina = china.slice(0, QUOTA_CHINA);
  const pickedEv = ev.slice(0, QUOTA_EV);
  const pickedRussia = russia.slice(0, QUOTA_RUSSIA);

  const usedSlots = pickedChina.length + pickedEv.length + pickedRussia.length;
  const otherSlots = MAX_INPUT_ITEMS - usedSlots;

  // Если other мало — добить из оставшихся по корзинам
  let pickedOther: RawNewsItem[];
  if (other.length >= otherSlots) {
    pickedOther = other.slice(0, otherSlots);
  } else {
    pickedOther = [...other];
    const overflow = [
      ...china.slice(QUOTA_CHINA),
      ...ev.slice(QUOTA_EV),
      ...russia.slice(QUOTA_RUSSIA),
    ].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    pickedOther.push(...overflow.slice(0, otherSlots - pickedOther.length));
  }

  console.log(
    `[Processor] Баланс: china=${pickedChina.length}, ev=${pickedEv.length}, russia=${pickedRussia.length}, other=${pickedOther.length}`,
  );

  // Сквозной список для sourceIndex (порядок: china → ev → russia → other)
  const all = [...pickedChina, ...pickedEv, ...pickedRussia, ...pickedOther];

  return { china: pickedChina, ev: pickedEv, russia: pickedRussia, other: pickedOther, all };
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

/**
 * Обработать массив новостей через DeepSeek: отбор, ранжирование, пересказ
 * @input items — RawNewsItem[] от collector.ts
 * @output ProcessedNews — структурированный дайджест
 * @important Ограничение: макс 80 новостей на входе (обрезка по свежести)
 */
export async function processNews(
  items: RawNewsItem[],
  stats?: { sourcesProcessed?: number; rawItemsCollected?: number; duplicatesRemoved?: number },
): Promise<ProcessedNews> {
  if (items.length === 0) {
    throw new Error('Нет новостей для обработки');
  }

  // Ограничить входной список и сбалансировать по тематикам
  const buckets = balanceItems(items.slice(0, MAX_INPUT_ITEMS));
  const trimmedItems = buckets.all;

  console.log(`[Processor] Новостей на входе: ${items.length}, отправляем в DeepSeek: ${trimmedItems.length}`);

  const userPrompt = `Вот ${trimmedItems.length} свежих новостей из автомобильной индустрии, разделённых на тематические секции с квотами. Выбери по квотам из каждой секции и подготовь дайджест.\n\n${formatSectionedPrompt(buckets)}`;

  // Retry: до MAX_RETRIES попыток при ошибке парсинга JSON
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[Processor] Повторная попытка ${attempt + 1}/${MAX_RETRIES} (ошибка парсинга JSON)`);
    }

    const response = await callDeepSeek(userPrompt, {
      temperature: 0.3,
      maxTokens: 4096,
      systemPrompt: SYSTEM_PROMPT,
    });

    try {
      const data = parseJsonResponse(response.content) as {
        mainStory: { title: string; body: string; sourceIndex: number; tags: unknown };
        digest: Array<{ title: string; body: string; sourceIndex: number; tags: unknown }>;
      };

      // Валидация базовой структуры
      if (!data.mainStory?.title || !data.mainStory?.body) {
        throw new Error('mainStory отсутствует или не содержит title/body');
      }
      if (!Array.isArray(data.digest) || data.digest.length === 0) {
        throw new Error('digest пуст или не является массивом');
      }

      // Собрать mainStory
      const mainIdx = (data.mainStory.sourceIndex ?? 1) - 1;
      const mainSource = trimmedItems[mainIdx];
      const mainStory: StoryItem = {
        title: data.mainStory.title,
        body: data.mainStory.body,
        source: mainSource?.source ?? 'unknown',
        sourceUrl: mainSource?.link ?? '',
        tags: filterTags(data.mainStory.tags),
      };

      // Собрать digest
      const digest: StoryItem[] = data.digest.map((d) => {
        const idx = (d.sourceIndex ?? 1) - 1;
        const src = trimmedItems[idx];
        return {
          title: d.title,
          body: d.body,
          source: src?.source ?? 'unknown',
          sourceUrl: src?.link ?? '',
          tags: filterTags(d.tags),
        };
      });

      console.log(
        `[Processor] Готово: 1 главная + ${digest.length} дайджест | ` +
        `tokens=${response.usage.totalTokens} cost=$${response.usage.estimatedCostUsd}`,
      );

      return {
        date: new Date().toISOString().slice(0, 10),
        model: 'deepseek-chat',
        cost: {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          estimatedUsd: response.usage.estimatedCostUsd,
        },
        mainStory,
        digest,
        sourcesProcessed: stats?.sourcesProcessed ?? 0,
        rawItemsCollected: stats?.rawItemsCollected ?? items.length,
        duplicatesRemoved: stats?.duplicatesRemoved ?? 0,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Processor] Ошибка парсинга ответа DeepSeek: ${lastError.message}`);
    }
  }

  throw new Error(
    `Не удалось получить валидный JSON от DeepSeek после ${MAX_RETRIES} попыток: ${lastError?.message}`,
  );
}
