/**
 * @file sources.ts
 * @description Конфигурация RSS-источников для автоновостей (3 языка, 20+ фидов)
 * @rule Каждый источник: url, name, language, category, enabled
 * @rule enabled: true по умолчанию; выключать битые фиды без удаления
 * @rule Категории: 'market_ru' | 'legislation' | 'chinese_auto' | 'korean_auto' | 'japanese_auto' | 'ev' | 'global' | 'motorsport'
 * @lastModified 2026-03-31
 */

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface NewsSource {
  url: string;
  name: string;
  language: 'ru' | 'en' | 'zh';
  category: string;
  enabled: boolean;
}

// ─── SOURCES ──────────────────────────────────────────────────────────────

export const NEWS_SOURCES: NewsSource[] = [
  // ── Google News RSS: русский ──────────────────────────────────────────
  {
    url: 'https://news.google.com/rss/search?q=автомобили+импорт+Россия&hl=ru&gl=RU&ceid=RU:ru',
    name: 'Google News RU: импорт',
    language: 'ru',
    category: 'market_ru',
    enabled: true,
  },
  {
    url: 'https://news.google.com/rss/search?q=утилизационный+сбор+авто+2026&hl=ru&gl=RU&ceid=RU:ru',
    name: 'Google News RU: утильсбор',
    language: 'ru',
    category: 'legislation',
    enabled: true,
  },
  {
    url: 'https://news.google.com/rss/search?q=китайские+автомобили+Россия&hl=ru&gl=RU&ceid=RU:ru',
    name: 'Google News RU: китайские авто',
    language: 'ru',
    category: 'chinese_auto',
    enabled: true,
  },

  // ── Google News RSS: английский ───────────────────────────────────────
  {
    url: 'https://news.google.com/rss/search?q=automotive+industry+news&hl=en-US&gl=US&ceid=US:en',
    name: 'Google News EN: automotive',
    language: 'en',
    category: 'global',
    enabled: true,
  },
  {
    url: 'https://news.google.com/rss/search?q=electric+vehicle+EV+news&hl=en-US&gl=US&ceid=US:en',
    name: 'Google News EN: EV',
    language: 'en',
    category: 'ev',
    enabled: true,
  },
  {
    url: 'https://news.google.com/rss/search?q=Chinese+car+brand+BYD+Changan&hl=en-US&gl=US&ceid=US:en',
    name: 'Google News EN: Chinese brands',
    language: 'en',
    category: 'chinese_auto',
    enabled: true,
  },

  // ── Google News RSS: китайский ────────────────────────────────────────
  {
    url: 'https://news.google.com/rss/search?q=汽车+新能源&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
    name: 'Google News ZH: NEV',
    language: 'zh',
    category: 'ev',
    enabled: true,
  },
  {
    url: 'https://news.google.com/rss/search?q=中国汽车+出口&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
    name: 'Google News ZH: export',
    language: 'zh',
    category: 'chinese_auto',
    enabled: true,
  },

  // ── Прямые RSS: русский ───────────────────────────────────────────────
  {
    url: 'http://www.gazeta.ru/export/rss/autonews.xml',
    name: 'Газета.ру Авто',
    language: 'ru',
    category: 'market_ru',
    enabled: true,
  },

  // ── Прямые RSS: английский ────────────────────────────────────────────
  {
    url: 'https://electrek.co/feed/',
    name: 'Electrek',
    language: 'en',
    category: 'ev',
    enabled: true,
  },
  {
    url: 'https://cnevpost.com/feed/',
    name: 'CnEVPost',
    language: 'en',
    category: 'chinese_auto',
    enabled: true,
  },
  {
    url: 'https://carnewschina.com/feed/',
    name: 'CarNewsChina',
    language: 'en',
    category: 'chinese_auto',
    enabled: true,
  },
  {
    url: 'https://motor1.com/rss/news/all/',
    name: 'Motor1',
    language: 'en',
    category: 'global',
    enabled: true,
  },
  {
    url: 'https://insideevs.com/rss/news/all/',
    name: 'InsideEVs',
    language: 'en',
    category: 'ev',
    enabled: true,
  },
  {
    url: 'https://carscoops.com/feed/',
    name: 'Carscoops',
    language: 'en',
    category: 'global',
    enabled: true,
  },
  {
    url: 'https://autocar.co.uk/rss',
    name: 'Autocar',
    language: 'en',
    category: 'global',
    enabled: true,
  },
  {
    url: 'https://theverge.com/rss/cars/index.xml',
    name: 'The Verge Cars',
    language: 'en',
    category: 'global',
    enabled: true,
  },
  {
    url: 'https://motorsport.com/rss/all/news/',
    name: 'Motorsport.com',
    language: 'en',
    category: 'motorsport',
    enabled: true,
  },

  // ── Прямые RSS: китайский ─────────────────────────────────────────────
  {
    url: 'https://auto.ifeng.com/rss/headnews.xml',
    name: 'iFeng Auto Headlines',
    language: 'zh',
    category: 'chinese_auto',
    enabled: true,
  },
  {
    url: 'https://auto.ifeng.com/rss/newcar.xml',
    name: 'iFeng Auto New Cars',
    language: 'zh',
    category: 'chinese_auto',
    enabled: true,
  },
];
