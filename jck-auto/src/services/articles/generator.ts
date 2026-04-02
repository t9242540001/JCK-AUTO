/**
 * @file generator.ts
 * @description Генератор SEO-статей через Qwen3.5-Plus: тема + новости → MDX-статья ~2000 слов
 * @runs VDS (cron-скрипт)
 * @input Topic из topicQueue.ts, NewsContextItem[], InternalLink[]
 * @output GeneratedArticle с MDX-контентом, frontmatter, стоимостью
 * @cost Qwen3.5-Plus ~$0.01-0.02 за статью (2K+ слов)
 * @rule Системный промпт определяет стиль, формат и тон — менять только с согласования
 * @rule AI-маркировка обязательна в конце каждой статьи
 * @lastModified 2026-04-02
 */

import { callQwenText } from '@/lib/dashscope';
import type { Topic, NewsContextItem } from './topicQueue';

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
const MIN_WORD_COUNT = 1000;

/**
 * @rule Менять только с явного согласования — определяет стиль и формат всех статей
 */
const ARTICLE_SYSTEM_PROMPT = `Ты — главный редактор и SEO-копирайтер автомобильного портала JCK AUTO (импорт авто из Китая, Кореи, Японии в Россию).

ЗАДАЧА: написать экспертную SEO-статью для блога. Статья должна быть полезной, структурированной, оптимизированной для поиска.

АУДИТОРИЯ: мужчины 28-50 лет, предприниматели. Рассматривают покупку авто из-за рубежа. Ценят факты, цифры, конкретику. Не терпят воду и общие слова.

ТОН: экспертный, уверенный, но дружелюбный. Как разговор с опытным другом, который разбирается в теме. Без восклицательных знаков, без кликбейта, без канцелярита.

ФОРМАТ СТАТЬИ:
- Длина: 1500-2500 слов (минимум 1000)
- Структура: вступление (2-3 предложения, сразу к делу) → основные разделы (h2) → подразделы (h3) → заключение с CTA
- Заголовки h2: 4-6 штук, содержат ключевые слова, но читаются естественно
- Заголовки h3: по необходимости, для детализации сложных разделов
- Списки: маркированные и нумерованные — для пошаговых инструкций, сравнений, перечислений
- Таблицы: markdown-таблицы для сравнения цен, характеристик, ставок
- Жирный шрифт: **ключевые цифры**, **важные термины**, **названия моделей**
- Абзацы: короткие (2-4 предложения). Длинные абзацы разбивать.

SEO-ТРЕБОВАНИЯ:
- Основное ключевое слово — в h1 (title), в первом абзаце, в 1-2 h2, в заключении
- Дополнительные ключевые слова — естественно распределить по тексту
- Не переспамливать — максимум 2-3% плотность основного ключа
- Description: 140-160 символов, содержит основной ключ, побуждает к клику

ВНУТРЕННИЕ ССЫЛКИ (обязательно):
- Вставить 3-5 внутренних ссылок в формате [текст ссылки](/url)
- Ссылки должны быть контекстными — органично вписаны в текст
- Минимум 1 ссылка на /calculator (калькулятор растаможки)
- Ссылки на релевантные статьи блога и новости
- Все ссылки в статье — ТОЛЬКО внутренние. Внешних ссылок быть не должно.

АКТУАЛЬНОСТЬ:
- Если предоставлен новостной контекст — упомянуть актуальные события
- Указывать год (2026) в контексте ставок, цен, правил
- Конкретные цифры предпочтительнее общих утверждений

ФОРМАТ ОТВЕТА — строго JSON (без markdown-обёрток):
{
  "title": "SEO-заголовок статьи (50-70 символов)",
  "description": "Meta description (140-160 символов с ключевым словом)",
  "tags": ["тег1", "тег2", "тег3"],
  "content": "Полный текст статьи в формате MDX/Markdown (h2, h3, списки, таблицы, жирный, ссылки)"
}

ЗАПРЕЩЕНО:
- Придумывать конкретные цены, курсы, ставки (если не уверен — напиши "уточняйте у менеджера")
- Упоминать конкурентов по имени (только "другие импортёры", "некоторые компании")
- Использовать ChatGPT-изм: "в заключение хочется отметить", "давайте разберёмся", "итак"
- Начинать статью с вопроса или с пересказа title
- Вставлять любые внешние ссылки (на другие сайты). Если нужно сослаться на закон, постановление, источник — упомяни название текстом без гиперссылки. Все ссылки в статье — только внутренние (/calculator, /catalog, /blog/..., /news/...)`;

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
      ? '\n\nВАЖНО: предыдущий ответ был слишком коротким. Напиши минимум 2000 слов. Раскрой каждый раздел подробнее, добавь примеры, таблицы, конкретные цифры. Ответ СТРОГО в формате JSON как указано в системном промпте. Без markdown-обёрток, без пояснений вне JSON.'
      : '';

    try {
      const response = await callQwenText(userPrompt + extraInstruction, {
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
