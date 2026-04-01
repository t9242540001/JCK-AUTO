/**
 * @file page.tsx
 * @description Страница /news — лента автомобильных новостей с фильтрацией и пагинацией
 * @runs VDS (Next.js server-side, ISR revalidate=3600)
 * @input storage/news/YYYY-MM-DD.json через reader.ts
 * @output HTML с лентой новостей, тегами, пагинацией, JSON-LD, CTA
 * @lastModified 2026-04-01
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Send } from 'lucide-react';
import {
  getNewsByDate,
  getNewsDaysPaginated,
  getAllTags,
} from '@/services/news/reader';
import type { NewsDay } from '@/services/news/reader';
import { CONTACTS } from '@/lib/constants';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute: 'Автоновости — JCK AUTO',
  },
  description:
    'Ежедневный дайджест автомобильных новостей: импорт авто в Россию, китайские автомобили, электромобили, законодательство, таможня. Экспертный анализ от JCK AUTO.',
  keywords:
    'автоновости, новости автопром, китайские авто новости, импорт авто Россия, электромобили, утильсбор',
  openGraph: {
    title: 'Автоновости — JCK AUTO',
    description:
      'Ежедневный дайджест автомобильных новостей: импорт, китайские авто, электромобили, законодательство.',
    url: 'https://jckauto.ru/news',
  },
  alternates: {
    canonical: 'https://jckauto.ru/news',
  },
};

// ─── TAG STYLES ───────────────────────────────────────────────────────────

const TAG_STYLES: Record<string, string> = {
  'китайские_авто': 'bg-china/10 text-china',
  'рынок_РФ': 'bg-china/10 text-china',
  'корейские_авто': 'bg-korea/10 text-korea',
  'японские_авто': 'bg-japan/10 text-japan',
  'электромобили': 'bg-primary/10 text-primary',
  'технологии': 'bg-primary/10 text-primary',
};

function tagStyle(tag: string): string {
  return TAG_STYLES[tag] ?? 'bg-surface-alt text-text-muted';
}

function TagBadge({ tag }: { tag: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tagStyle(tag)}`}>
      {tag}
    </span>
  );
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────

function newsArticleJsonLd(day: NewsDay) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: day.mainStory.title,
    datePublished: day.date,
    author: { '@type': 'Organization', name: 'JCK AUTO' },
    publisher: { '@type': 'Organization', name: 'JCK AUTO' },
    ...(day.cover?.imagePath ? { image: `https://jckauto.ru${day.cover.imagePath}` } : {}),
  };
}

// ─── NEWS DAY BLOCK ───────────────────────────────────────────────────────

function NewsDayBlock({ date }: { date: string }) {
  const day = getNewsByDate(date);
  if (!day) return null;

  return (
    <div className="space-y-6">
      {/* Дата */}
      <time className="text-sm font-medium text-text-muted">
        {formatDate(day.date)}
      </time>

      {/* Обложка */}
      {day.cover?.imagePath && (
        <div className="relative aspect-[2/1] w-full overflow-hidden rounded-xl">
          <Image
            src={day.cover.imagePath}
            alt={day.mainStory.title}
            fill
            className="object-cover"
          />
        </div>
      )}

      {/* Главная новость */}
      <div>
        <h2 className="font-heading text-xl font-bold text-text sm:text-2xl">
          {day.mainStory.title}
        </h2>
        <p className="mt-3 whitespace-pre-line text-text-muted">
          {day.mainStory.body}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">
            Источник: {day.mainStory.source}
          </span>
          {day.mainStory.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      </div>

      {/* Дайджест */}
      {day.digest.length > 0 && (
        <div className="space-y-4 pl-4 border-l-2 border-border">
          {day.digest.map((item, i) => (
            <div key={i}>
              <h3 className="font-heading text-base font-semibold text-text">
                {item.title}
              </h3>
              <p className="mt-1 line-clamp-3 text-sm text-text-muted">
                {item.body}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-muted">
                  {item.source}
                </span>
                {item.tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ page?: string; tag?: string }>;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const tag = params.tag || undefined;
  const limit = 7;

  const allTags = getAllTags();
  const result = getNewsDaysPaginated(page, limit, tag);

  // JSON-LD только для page=1, первые 3 дня
  const jsonLdDays: NewsDay[] = [];
  if (page === 1) {
    for (const preview of result.items.slice(0, 3)) {
      const day = getNewsByDate(preview.date);
      if (day) jsonLdDays.push(day);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-20 pt-28">
      {jsonLdDays.map((day) => (
        <script
          key={day.date}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(newsArticleJsonLd(day)),
          }}
        />
      ))}

      <div className="mx-auto max-w-4xl px-4">
        {/* Заголовок */}
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Новости
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            Автомобильные новости
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-text-muted sm:text-lg">
            Ежедневный дайджест: импорт, рынок, законодательство, технологии
          </p>
        </div>

        {/* Фильтр по тегам */}
        {allTags.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link
              href="/news"
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                !tag
                  ? 'bg-primary text-white'
                  : 'bg-surface-alt text-text-muted hover:bg-primary/10'
              }`}
            >
              Все
            </Link>
            {allTags.map((t) => (
              <Link
                key={t}
                href={`/news?tag=${encodeURIComponent(t)}`}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  tag === t
                    ? 'bg-primary text-white'
                    : `${tagStyle(t)} hover:opacity-80`
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        {/* Лента новостей */}
        {result.items.length > 0 ? (
          <div className="mt-12 space-y-12">
            {result.items.map((preview, i) => (
              <div key={preview.date}>
                {i > 0 && <div className="mb-12 border-t border-border" />}
                <NewsDayBlock date={preview.date} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-16 text-center text-text-muted">
            {tag
              ? `Новостей с тегом "${tag}" пока нет.`
              : 'Новости скоро появятся. Мы готовим для вас ежедневные дайджесты автомобильного мира.'}
          </p>
        )}

        {/* Пагинация */}
        {result.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-4">
            {page > 1 && (
              <Link
                href={`/news?page=${page - 1}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-primary hover:text-primary"
              >
                &larr; Новее
              </Link>
            )}
            <span className="text-sm text-text-muted">
              Страница {result.page} из {result.totalPages}
            </span>
            {page < result.totalPages && (
              <Link
                href={`/news?page=${page + 1}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-primary hover:text-primary"
              >
                Старее &rarr;
              </Link>
            )}
          </div>
        )}

        {/* CTA-блок */}
        <div className="mt-16 rounded-2xl border border-border bg-surface-alt p-6 text-center sm:p-8">
          <h2 className="font-heading text-xl font-bold text-text">
            Хотите привезти автомобиль?
          </h2>
          <p className="mt-2 text-text-muted">
            Рассчитайте стоимость или свяжитесь с нами
          </p>
          <div className="mt-6 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/calculator"
              className="rounded-xl bg-secondary px-8 py-3 font-medium text-white transition-colors hover:bg-secondary-hover"
            >
              Рассчитать стоимость
            </Link>
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-8 py-3 font-medium text-white transition-colors hover:bg-[#229ED9]"
            >
              <Send className="h-4 w-4" />
              Написать в Telegram
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
