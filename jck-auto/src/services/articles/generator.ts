/**
 * @file generator.ts
 * @description Генератор SEO-статей через DeepSeek: тема + новости → MDX-статья ~2000 слов
 * @runs VDS (cron-скрипт)
 * @input Topic из topicQueue.ts, NewsContextItem[], InternalLink[]
 * @output GeneratedArticle с MDX-контентом, frontmatter, стоимостью
 * @cost DeepSeek ~$0.001-0.003 за статью (2K+ слов) — ~10× дешевле Qwen3.5-Plus
 * @rule Системный промпт определяет стиль, формат и тон — менять только с согласования
 * @rule AI-маркировка обязательна в конце каждой статьи
 * @rule Article body generation uses DeepSeek only — DashScope text-generation is banned here (see ADR [2026-04-24])
 * @lastModified 2026-04-24
 */

// @rule Article body generation MUST use DeepSeek. DashScope text-generation
// is unreliable from VDS — large requests (8192 output tokens) systematically
// time out (see ADR [2026-04-24] in knowledge/decisions.md, incident Б-12 in
// knowledge/bugs.md). Switching back to callQwenText here will reintroduce
// the 2-week blog outage.
import { callDeepSeek } from '@/lib/deepseek';
import type { Topic, NewsContextItem } from './topicGenerator';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface GeneratedArticle {
  slug: string;
  frontmatter: {
    title: string;
    description: string;
    date: string;
    author: string;
    country: string | null;
    tags: string[];
    image: string;
  };
  content: string;
  wordCount: number;
  cost: {
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
  };
}

interface InternalLink {
  url: string;
  title: string;
  type: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const MIN_WORD_COUNT = 300;

/**
 * @rule Менять только с явного согласования — определяет стиль и формат всех статей
 */
const ARTICLE_SYSTEM_PROMPT = `Ты — автор журнала «Авторевю». Пишешь экспертную статью для блога компании JCK AUTO (импорт авто из Китая, Кореи, Японии в Россию).

Стиль — как в «Авторевю»: живой, экспертный, с уважением к читателю. Факты и цифры первыми, мнение — обосновано. Короткие абзацы, разговорный но не панибратский тон. Уместный юмор без натянутости. Ни слова воды — каждое предложение несёт смысл.

Аудитория: мужчины 28-50 лет, предприниматели. Ценят конкретику и прямой разговор.

Объём определяй по теме: 300-2000 слов. Короткая новостная аналитика — 300-600. Обзор модели или руководство — 1000-2000. Не лей воду ради объёма, каждое предложение должно нести смысл.

Структура: вступление сразу к делу (2-3 предложения) → разделы с h2 → подразделы h3 где нужно → заключение с призывом к действию. Заголовки h2 — 4-6 штук, содержат ключевые слова но читаются естественно.

Оформление: **жирный** для ключевых цифр и терминов. Списки для перечислений и пошаговых инструкций. Абзацы — 2-4 предложения максимум. НЕ использовать markdown-таблицы — вместо них оформлять сравнения текстом или списками.

SEO: основной ключ — в title, первом абзаце, 1-2 заголовках h2 и заключении. Без переспама. Description: 140-160 символов с основным ключом.

Ссылки: вставить 3-5 внутренних ссылок [текст](/url). Минимум одна на /calculator. Все ссылки — ТОЛЬКО внутренние. Внешних ссылок не вставлять. Если нужно сослаться на закон или источник — упомяни название текстом.

Формат ответа — строго JSON (без markdown-обёрток):
{
  "title": "SEO-заголовок (50-70 символов)",
  "description": "Meta description (140-160 символов)",
  "tags": ["тег1", "тег2", "тег3"],
  "content": "Полный текст в MDX/Markdown"
}

Запрещено: придумывать цены и ставки (если не уверен — "уточняйте у менеджера"), упоминать конкурентов по имени, использовать клише ("давайте разберёмся", "в заключение хочется отметить", "итак"), начинать с вопроса или пересказа заголовка, вставлять внешние ссылки, использовать markdown-таблицы.`;

// ─── HELPERS ──────────────────────────────────────────────────────────────

/** Попробовать распарсить JSON, включая извлечение из markdown-блока */
function parseJsonResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (match?.[1]) {
      return JSON.parse(match[1]);
    }
    throw new Error('Не удалось извлечь JSON из ответа Qwen');
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function truncateDescription(text: string, max: number = 160): string {
  const firstParagraph = text.split('\n\n')[0]?.replace(/[#*\[\]]/g, '').trim() ?? '';
  if (firstParagraph.length <= max) return firstParagraph;
  const cut = firstParagraph.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '...';
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

/**
 * Сгенерировать SEO-статью через Qwen3.5-Plus
 * @input topic — тема из semantic-core, newsContext — свежие новости, internalLinks — все URL сайта
 * @output GeneratedArticle с MDX-контентом, frontmatter, стоимостью
 */
export async function generateArticle(
  topic: Topic,
  newsContext: NewsContextItem[],
  internalLinks: InternalLink[],
): Promise<GeneratedArticle> {
  const today = new Date().toISOString().slice(0, 10);

  // Форматирование контекста для промпта
  const newsBlock = newsContext.length > 0
    ? `\n\nАКТУАЛЬНЫЕ НОВОСТИ ПО ТЕМЕ (используй как контекст):\n${newsContext.map((n, i) => `${i + 1}. [${n.date}] ${n.title}\n   ${n.summary}`).join('\n\n')}`
    : '';

  const linksBlock = internalLinks
    .slice(0, 30)
    .map((l) => `- [${l.title}](${l.url})`)
    .join('\n');

  const userPrompt = `Напиши статью для блога JCK AUTO.

ТЕМА: ${topic.title}
КЛЮЧЕВЫЕ СЛОВА: ${topic.keywords.join(', ')}
СТРАНА: ${topic.country ?? 'все страны'}
ТИП СТАТЬИ: ${topic.type}
${newsBlock}

ДОСТУПНЫЕ ВНУТРЕННИЕ ССЫЛКИ (вставь 3-5 релевантных):
${linksBlock}

ОБЯЗАТЕЛЬНЫЕ ССЫЛКИ ИЗ ТЕМЫ:
${topic.internalLinks.map((l) => `- ${l}`).join('\n')}`;

  let lastError: Error | null = null;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCost = 0;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const extraInstruction = attempt > 0
      ? '\n\nПредыдущий ответ был слишком коротким (менее 300 слов). Раскрой тему подробнее. Ответ СТРОГО в формате JSON как указано в системном промпте. Без markdown-обёрток, без пояснений вне JSON.'
      : '';

    try {
      const response = await callDeepSeek(userPrompt + extraInstruction, {
        temperature: 0.6,
        maxTokens: 8192,
        systemPrompt: ARTICLE_SYSTEM_PROMPT,
      });

      totalPromptTokens += response.usage.promptTokens;
      totalCompletionTokens += response.usage.completionTokens;
      totalCost += response.usage.estimatedCostUsd;

      const data = parseJsonResponse(response.content) as {
        title?: string;
        description?: string;
        tags?: string[];
        content?: string;
      };

      if (!data.content || !data.title) {
        throw new Error('Ответ не содержит title или content');
      }

      const wordCount = countWords(data.content);
      console.log(`[Generator] Попытка ${attempt + 1}: ${wordCount} слов, ${data.title}`);

      if (wordCount < MIN_WORD_COUNT && attempt < MAX_RETRIES - 1) {
        console.warn(`[Generator] Мало слов (${wordCount} < ${MIN_WORD_COUNT}), retry...`);
        continue;
      }

      // AI-маркировка
      const content = data.content.trim() + '\n\n*Подготовлено с использованием ИИ. Редакция JCK AUTO.*';

      // Description: из ответа модели или из первого абзаца
      const description = data.description && data.description.length >= 80
        ? data.description
        : truncateDescription(data.content);

      return {
        slug: topic.slug,
        frontmatter: {
          title: data.title,
          description,
          date: today,
          author: 'JCK AUTO',
          country: topic.country,
          tags: data.tags ?? topic.keywords.slice(0, 3),
          image: `/images/blog/${topic.slug}.jpg`,
        },
        content,
        wordCount,
        cost: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          estimatedCostUsd: parseFloat(totalCost.toFixed(6)),
        },
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Generator] Ошибка: ${lastError.message}`);
    }
  }

  throw new Error(
    `Не удалось сгенерировать статью после ${MAX_RETRIES} попыток: ${lastError?.message}`,
  );
}
