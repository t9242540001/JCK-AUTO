/**
 * @file processor.ts
 * @description AI-обработка новостей: отбор, ранжирование, пересказ через DeepSeek
 * @input RawNewsItem[] от collector.ts
 * @output ProcessedNews — структурированный дайджест (1 главная + 4-5 кратких)
 * @cost ~4 вызова DeepSeek ≈ $0.004-0.008 за полный цикл
 * @rule Системный промпт менять только с явного согласования — он определяет тон и формат всего контента
 * @rule DeepSeek должен возвращать строго JSON, без markdown-обёрток
 * @lastModified 2026-04-01
 */

import { callDeepSeek } from '@/lib/deepseek';
import type { DeepSeekResponse } from '@/lib/deepseek';
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
 * Общий системный промпт для всех вызовов
 * @rule Менять только с явного согласования — определяет тон и формат всего контента
 */
const SYSTEM_PROMPT = `Ты — редактор автомобильного раздела «Коммерсанта». Пишешь новостной дайджест для портала JCK AUTO (импорт авто из Китая, Кореи, Японии в Россию).

Стиль — как в «Коммерсант-Авто»: сухая деловая подача, факт первым, без эмоций и восклицательных знаков. Источник назван в тексте. Экспертный комментарий отделён от факта. Читатель получает суть за 30 секунд.

Аудитория: автолюбители и покупатели авто в России, мужчины 28-50.

Все тексты на русском языке.
Теги — только из списка: ${ALLOWED_TAGS.join(', ')}
Ответь ТОЛЬКО валидным JSON, без markdown-обёрток и пояснений.`;

// ─── HELPERS ──────────────────────────────────────────────────────────────

/** Отформатировать список новостей для промпта */
function formatItemsList(items: RawNewsItem[]): string {
  return items
    .map((item, i) => {
      const date = new Date(item.pubDate).toLocaleDateString('ru-RU');
      return `${i + 1}. [${item.source}] ${date}\n   ${item.title}\n   ${item.snippet}`;
    })
    .join('\n\n');
}

/** Попробовать распарсить JSON, включая извлечение из markdown-блока */
function parseJsonResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
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

/** Вызов DeepSeek с retry на ошибку парсинга JSON */
async function callWithRetry(userPrompt: string): Promise<{ data: unknown; usage: DeepSeekResponse['usage'] }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await callDeepSeek(userPrompt, {
      temperature: 0.3,
      maxTokens: 4096,
      systemPrompt: SYSTEM_PROMPT,
    });
    try {
      const data = parseJsonResponse(response.content);
      return { data, usage: response.usage };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw new Error(`JSON parse failed after ${MAX_RETRIES} retries: ${lastError?.message}`);
}

/** Извлечь StoryItem из raw-объекта и списка новостей-источников */
function toStoryItem(raw: { title?: string; body?: string; tags?: unknown }, items: RawNewsItem[], sourceIdx?: number): StoryItem {
  const idx = (sourceIdx ?? 1) - 1;
  const src = items[idx];
  return {
    title: raw.title ?? '',
    body: raw.body ?? '',
    source: src?.source ?? 'unknown',
    sourceUrl: src?.link ?? '',
    tags: filterTags(raw.tags),
  };
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
}

/** Программная балансировка входного списка по тематическим корзинам */
function balanceItems(items: RawNewsItem[]): BalancedBuckets {
  const china: RawNewsItem[] = [];
  const ev: RawNewsItem[] = [];
  const russia: RawNewsItem[] = [];
  const other: RawNewsItem[] = [];

  for (const item of items) {
    const t = item.title + ' ' + item.snippet;
    if (CHINA_RE.test(t)) china.push(item);
    else if (EV_RE.test(t)) ev.push(item);
    else if (RUSSIA_RE.test(t)) russia.push(item);
    else other.push(item);
  }

  const pickedChina = china.slice(0, QUOTA_CHINA);
  const pickedEv = ev.slice(0, QUOTA_EV);
  const pickedRussia = russia.slice(0, QUOTA_RUSSIA);
  const usedSlots = pickedChina.length + pickedEv.length + pickedRussia.length;
  const otherSlots = MAX_INPUT_ITEMS - usedSlots;

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

  return { china: pickedChina, ev: pickedEv, russia: pickedRussia, other: pickedOther };
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

/**
 * Обработать массив новостей через DeepSeek: параллельные вызовы по корзинам
 * @input items — RawNewsItem[] от collector.ts
 * @output ProcessedNews — структурированный дайджест
 * @important 3-4 параллельных вызова DeepSeek (по одному на корзину)
 */
export async function processNews(
  items: RawNewsItem[],
  stats?: { sourcesProcessed?: number; rawItemsCollected?: number; duplicatesRemoved?: number },
): Promise<ProcessedNews> {
  if (items.length === 0) {
    throw new Error('Нет новостей для обработки');
  }

  const buckets = balanceItems(items.slice(0, MAX_INPUT_ITEMS));
  const totalItems = buckets.china.length + buckets.ev.length + buckets.russia.length + buckets.other.length;
  console.log(`[Processor] Новостей на входе: ${items.length}, в корзинах: ${totalItems}`);

  // Формируем промпты для каждой непустой корзины
  type BucketCall = { name: string; items: RawNewsItem[]; prompt: string; isMain: boolean };
  const calls: BucketCall[] = [];

  const mainBucket = buckets.china.length > 0 ? buckets.china : buckets.other;
  const mainName = buckets.china.length > 0 ? 'china' : 'other';

  calls.push({
    name: mainName,
    items: mainBucket,
    isMain: true,
    prompt: `Из списка новостей выбери 1 самую важную для аудитории JCK AUTO (импорт авто в Россию).
Напиши развёрнутый пересказ 300-500 слов с экспертным комментарием.
Формат JSON: { "title": "Заголовок на русском", "body": "Пересказ 300-500 слов", "sourceIndex": <номер из списка>, "tags": ["тег1", "тег2"] }

Новости:\n${formatItemsList(mainBucket)}`,
  });

  // Для остальных корзин — digest вызовы
  const digestBuckets: Array<{ name: string; items: RawNewsItem[]; count: string }> = [];
  if (buckets.china.length > 0 && buckets.ev.length > 0) {
    digestBuckets.push({ name: 'ev', items: buckets.ev, count: '1-2' });
  }
  if (buckets.russia.length > 0) {
    digestBuckets.push({ name: 'russia', items: buckets.russia, count: '1-2' });
  }
  // other — если china была mainStory, other идёт в digest; если china пуста, other уже использована для main
  if (buckets.china.length > 0 && buckets.other.length > 0) {
    digestBuckets.push({ name: 'other', items: buckets.other, count: '2-3' });
  } else if (buckets.china.length === 0) {
    // china пуста, other использована для main; ev и russia — digest
    if (buckets.ev.length > 0) {
      digestBuckets.push({ name: 'ev', items: buckets.ev, count: '1-2' });
    }
  }

  for (const db of digestBuckets) {
    calls.push({
      name: db.name,
      items: db.items,
      isMain: false,
      prompt: `Из списка новостей выбери ${db.count} самые важные для аудитории JCK AUTO.
Для каждой напиши краткий пересказ 100-150 слов.
Формат JSON: { "items": [{ "title": "Заголовок на русском", "body": "Пересказ 100-150 слов", "sourceIndex": <номер из списка>, "tags": ["тег1"] }] }

Новости:\n${formatItemsList(db.items)}`,
    });
  }

  // Параллельные вызовы DeepSeek
  console.log(`[Processor] Запуск ${calls.length} параллельных вызовов DeepSeek...`);
  const results = await Promise.allSettled(
    calls.map(async (call, i) => {
      console.log(`[Processor] Вызов ${i + 1}/${calls.length} (${call.name}): ${call.items.length} новостей`);
      const { data, usage } = await callWithRetry(call.prompt);
      return { call, data, usage };
    }),
  );

  // Собрать результаты
  let mainStory: StoryItem | null = null;
  const digest: StoryItem[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostUsd = 0;

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(`[Processor] Вызов упал: ${result.reason}`);
      continue;
    }
    const { call, data, usage } = result.value;
    totalPromptTokens += usage.promptTokens;
    totalCompletionTokens += usage.completionTokens;
    totalCostUsd += usage.estimatedCostUsd;

    if (call.isMain) {
      const raw = data as { title?: string; body?: string; sourceIndex?: number; tags?: unknown };
      mainStory = toStoryItem(raw, call.items, raw.sourceIndex);
    } else {
      const raw = data as { items?: Array<{ title?: string; body?: string; sourceIndex?: number; tags?: unknown }> };
      for (const item of raw.items ?? []) {
        digest.push(toStoryItem(item, call.items, item.sourceIndex));
      }
    }
  }

  if (!mainStory) {
    throw new Error('Не удалось получить mainStory ни из одного вызова DeepSeek');
  }

  const totalTokens = totalPromptTokens + totalCompletionTokens;
  console.log(
    `[Processor] Готово: 1 главная + ${digest.length} дайджест | ` +
    `tokens=${totalTokens} (in:${totalPromptTokens}/out:${totalCompletionTokens}) cost=$${totalCostUsd.toFixed(4)}`,
  );

  return {
    date: new Date().toISOString().slice(0, 10),
    model: 'deepseek-chat',
    cost: {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      estimatedUsd: parseFloat(totalCostUsd.toFixed(6)),
    },
    mainStory,
    digest,
    sourcesProcessed: stats?.sourcesProcessed ?? 0,
    rawItemsCollected: stats?.rawItemsCollected ?? items.length,
    duplicatesRemoved: stats?.duplicatesRemoved ?? 0,
  };
}
