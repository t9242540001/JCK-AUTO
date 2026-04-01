/**
 * @file transliterate.ts
 * @description Транслитерация кириллицы → латиницы для SEO-friendly URL slugs
 * @lastModified 2026-04-01
 */

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

/**
 * Генерация URL-slug из текста (кириллица → латиница)
 * @input text — заголовок или произвольный текст
 * @input maxWords — максимум слов в slug (по умолчанию 7)
 * @output lowercase slug: a-z, 0-9, дефисы
 */
export function generateSlug(text: string, maxWords: number = 7): string {
  const transliterated = text
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('');

  const slug = transliterated
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const words = slug.split('-').filter(Boolean).slice(0, maxWords);
  return words.join('-') || 'news';
}
