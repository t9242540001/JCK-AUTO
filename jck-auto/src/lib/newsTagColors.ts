/**
 * @file newsTagColors.ts
 * @description Маппинг тег→цвет для новостных бейджей (единый источник)
 * @lastModified 2026-04-01
 */

const TAG_STYLES: Record<string, string> = {
  'китайские_авто': 'bg-china/10 text-china',
  'рынок_РФ': 'bg-china/10 text-china',
  'корейские_авто': 'bg-korea/10 text-korea',
  'японские_авто': 'bg-japan/10 text-japan',
  'электромобили': 'bg-primary/10 text-primary',
  'технологии': 'bg-primary/10 text-primary',
};

export function getTagStyle(tag: string): string {
  return TAG_STYLES[tag] ?? 'bg-surface-alt text-text-muted';
}
