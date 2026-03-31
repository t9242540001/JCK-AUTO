/**
 * @file rssParser.ts
 * @description Универсальный парсер RSS/Atom фидов для сбора автоновостей
 * @runs VDS напрямую
 * @input URL RSS-фида, имя источника, язык
 * @output массив RawNewsItem[]
 * @next src/services/news/collector.ts (этап 2.2)
 * @rule Таймаут 15 секунд на фид (AbortController)
 * @rule При ошибке — логировать warning, вернуть пустой массив, НЕ бросать исключение
 * @rule Google News ссылки идут через редирект — сохранять оригинальный URL, не резолвить
 * @lastModified 2026-03-31
 */

import { XMLParser } from 'fast-xml-parser';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface RawNewsItem {
  title: string;
  link: string;
  pubDate: string;           // ISO 8601
  source: string;            // имя источника из аргумента
  language: 'ru' | 'en' | 'zh';
  snippet: string;           // ≤300 символов, без HTML
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;

// ─── ENCODING ─────────────────────────────────────────────────────────────

/**
 * Определить кодировку из XML-декларации и декодировать ArrayBuffer в строку
 * @rule Поддержка: windows-1251, koi8-r, iso-8859-1, gb2312, gbk. Fallback — UTF-8
 */
function decodeXml(buffer: ArrayBuffer): string {
  // Читаем первые 200 байт как latin1 для безопасного извлечения encoding
  const header = new TextDecoder('latin1').decode(buffer.slice(0, 200));
  const match = header.match(/<\?xml[^?]*encoding=["']([^"']+)["']/i);
  const encoding = match?.[1]?.toLowerCase() ?? 'utf-8';

  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    // Неизвестная кодировка — fallback на UTF-8
    return new TextDecoder('utf-8').decode(buffer);
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

/** Удалить HTML-теги и декодировать базовые entities */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Обрезать текст до ~300 символов по границе слова */
function truncate(text: string, max: number = 300): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** Нормализовать дату в ISO 8601 */
function normalizeDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/** Извлечь строку — может быть строкой или объектом с #text */
function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)['#text']);
  }
  return String(value ?? '');
}

/** Извлечь link — в Atom может быть объект с @_href */
function extractLink(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const alternate = value.find(
      (v) => typeof v === 'object' && v && (v as Record<string, unknown>)['@_rel'] === 'alternate',
    );
    const target = alternate ?? value[0];
    if (target && typeof target === 'object') {
      return String((target as Record<string, unknown>)['@_href'] ?? '');
    }
    return String(target ?? '');
  }
  if (value && typeof value === 'object') {
    return String((value as Record<string, unknown>)['@_href'] ?? '');
  }
  return String(value ?? '');
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

/**
 * Скачивает и парсит RSS/Atom фид, возвращает массив RawNewsItem
 * @rule При любой ошибке — console.warn + return [] (никогда не бросает)
 */
export async function parseRSSFeed(
  url: string,
  sourceName: string,
  language: 'ru' | 'en' | 'zh',
): Promise<RawNewsItem[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let xml: string;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'JCK-AUTO-NewsBot/1.0' },
      });
      if (!response.ok) {
        console.warn(`[RSS] HTTP ${response.status} при загрузке ${url}`);
        return [];
      }
      const buffer = await response.arrayBuffer();
      xml = decodeXml(buffer);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!xml.trim()) {
      console.warn(`[RSS] Пустой ответ от ${url}`);
      return [];
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const parsed = parser.parse(xml);

    // RSS 2.0: rss.channel.item
    // Atom: feed.entry
    let rawItems: unknown[];

    if (parsed.rss?.channel?.item) {
      const items = parsed.rss.channel.item;
      rawItems = Array.isArray(items) ? items : [items];
    } else if (parsed.feed?.entry) {
      const entries = parsed.feed.entry;
      rawItems = Array.isArray(entries) ? entries : [entries];
    } else {
      console.warn(`[RSS] Не найдены элементы (ни RSS, ни Atom) в ${url}`);
      return [];
    }

    const results: RawNewsItem[] = [];

    for (const raw of rawItems) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;

      const title = stripHtml(extractText(item.title));
      if (!title) continue;

      // RSS: link, Atom: link (объект/массив с @_href)
      const link = extractLink(item.link);
      if (!link) continue;

      // RSS: pubDate, Atom: published или updated
      const dateRaw = item.pubDate ?? item.published ?? item.updated;
      const pubDate = normalizeDate(typeof dateRaw === 'string' ? dateRaw : String(dateRaw ?? ''));

      // RSS: description, Atom: summary или content
      const descRaw = item.description ?? item.summary ?? item.content;
      const snippet = truncate(stripHtml(extractText(descRaw)));

      results.push({ title, link, pubDate, source: sourceName, language, snippet });
    }

    return results;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[RSS] Ошибка парсинга ${url}: ${message}`);
    return [];
  }
}
