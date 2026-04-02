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
 * @input maxWords — максимум слов в slug (по умолчанию 6)
 * @input maxLength — максимум символов в slug (по умолчанию 50)
 * @output lowercase slug: a-z, 0-9, дефисы, ≤maxLength символов
 */
export function generateSlug(text: string, maxWords: number = 6, maxLength: number = 50): string {
  const transliterated = text
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('');

  const slug = transliterated
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const allWords = slug.split('-').filter(Boolean);
  const words = allWords.slice(0, maxWords);
  // Убрать короткие хвосты только если слова были обрезаны
  if (allWords.length > maxWords) {
    while (words.length > 1 && words[words.length - 1].length <= 3) {
      words.pop();
    }
  }
  let result = words.join('-');

  // Обрезка по длине с учётом целых слов + удаление коротких хвостов
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
    const lastDash = result.lastIndexOf('-');
    if (lastDash > 0) {
      result = result.slice(0, lastDash);
    }

    // Убрать короткие хвосты (предлоги, частицы ≤3 символов) после обрезки
    const parts = result.split('-');
    while (parts.length > 1 && parts[parts.length - 1].length <= 3) {
      parts.pop();
    }
    result = parts.join('-');
  }

  return result || 'news';
}
