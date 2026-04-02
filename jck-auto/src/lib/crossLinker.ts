/**
 * @file crossLinker.ts
 * @description Модуль перелинковки между блогом, новостями, каталогом
 * @runs VDS (Next.js SSG/ISR)
 * @input блог (MDX), новости (JSON), каталог (catalog.json)
 * @output отсортированные по релевантности связанные материалы
 * @rule Read-only — не модифицирует никакие данные
 * @lastModified 2026-04-02
 */

import { getAllPosts, type BlogPost } from '@/lib/blog';
import { readCatalogJson } from '@/lib/blobStorage';
import { getAllNewsDays, getAllTags } from '@/services/news/reader';
import type { Car } from '@/types/car';
import type { Country } from '@/lib/constants';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface RelatedNewsItem {
  date: string;
  slug: string;
  title: string;
  tags: string[];
}

export interface InternalLink {
  url: string;
  title: string;
  type: 'blog' | 'news' | 'calculator' | 'catalog' | 'page';
}

// ─── RELATED ARTICLES ─────────────────────────────────────────────────────

/**
 * Найти связанные статьи блога по тегам и стране
 * @input country, tags, excludeSlug, limit
 * @output BlogPost[] отсортированные по релевантности
 */
export function getRelatedArticles(options: {
  country?: Country;
  tags?: string[];
  excludeSlug?: string;
  limit?: number;
}): BlogPost[] {
  const { country, tags = [], excludeSlug, limit = 3 } = options;
  const posts = getAllPosts().filter((p) => p.slug !== excludeSlug);

  const scored = posts.map((post) => {
    let score = 0;
    // Совпадение тегов
    for (const tag of tags) {
      if (post.tags.includes(tag)) score += 2;
    }
    // Совпадение страны
    if (country && post.country === country) score += 1;
    return { post, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || new Date(b.post.date).getTime() - new Date(a.post.date).getTime())
    .slice(0, limit)
    .map((s) => s.post);
}

// ─── RELATED NEWS ─────────────────────────────────────────────────────────

/**
 * Найти связанные новости по тегам
 * @input tags, limit, daysBack
 * @output RelatedNewsItem[] — свежие первые
 */
export function getRelatedNews(options: {
  tags?: string[];
  limit?: number;
  daysBack?: number;
}): RelatedNewsItem[] {
  const { tags = [], limit = 3, daysBack = 14 } = options;
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;

  const allDays = getAllNewsDays();

  const filtered = allDays
    .filter((day) => new Date(day.date).getTime() >= cutoff)
    .map((day) => {
      const overlap = tags.filter((t) => day.mainStoryTags.includes(t)).length;
      return {
        date: day.date,
        slug: day.slug,
        title: day.mainStoryTitle,
        tags: day.mainStoryTags,
        score: overlap,
      };
    })
    .filter((d) => tags.length === 0 || d.score > 0)
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));

  return filtered.slice(0, limit).map(({ date, slug, title, tags: t }) => ({
    date,
    slug,
    title,
    tags: t,
  }));
}

// ─── RELATED CARS ─────────────────────────────────────────────────────────

/**
 * Найти связанные автомобили по стране (случайная выборка)
 * @input country, limit
 * @output Car[]
 */
export async function getRelatedCars(options: {
  country?: Country;
  limit?: number;
}): Promise<Car[]> {
  const { country, limit = 3 } = options;

  let cars = await readCatalogJson();
  if (country) {
    cars = cars.filter((c) => c.country === country);
  }

  // Случайная выборка
  const shuffled = [...cars].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

// ─── ALL INTERNAL LINKS ───────────────────────────────────────────────────

/**
 * Собрать все внутренние URL для передачи в AI-промпт
 * @output InternalLink[] — все страницы сайта
 */
export function getAllInternalLinks(): InternalLink[] {
  const links: InternalLink[] = [];

  // Статические страницы
  links.push(
    { url: '/calculator', title: 'Калькулятор растаможки', type: 'calculator' },
    { url: '/catalog', title: 'Каталог автомобилей', type: 'catalog' },
    { url: '/about', title: 'О компании', type: 'page' },
    { url: '/blog', title: 'Блог', type: 'page' },
    { url: '/news', title: 'Новости', type: 'page' },
  );

  // Блог
  for (const post of getAllPosts()) {
    links.push({
      url: `/blog/${post.slug}`,
      title: post.title,
      type: 'blog',
    });
  }

  // Новости: страницы тегов
  for (const tag of getAllTags()) {
    links.push({
      url: `/news/tag/${tag}`,
      title: `Новости: ${tag}`,
      type: 'news',
    });
  }

  return links;
}
