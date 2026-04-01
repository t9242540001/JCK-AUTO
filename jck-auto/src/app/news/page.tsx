/**
 * @file page.tsx
 * @description Страница /news — каталог новостей (компактные карточки-превью)
 * @runs VDS (Next.js server-side, ISR revalidate=3600)
 * @lastModified 2026-04-01
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Send } from 'lucide-react';
import { getNewsDaysPaginated, getAllTags } from '@/services/news/reader';
import { getTagStyle } from '@/lib/newsTagColors';
import { CONTACTS } from '@/lib/constants';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: 'Автоновости — JCK AUTO' },
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
  alternates: { canonical: 'https://jckauto.ru/news' },
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface PageProps {
  searchParams: Promise<{ page?: string; tag?: string }>;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const tag = params.tag || undefined;

  const allTags = getAllTags();
  const result = getNewsDaysPaginated(page, 7, tag);

  return (
    <div className="min-h-screen bg-white pb-20 pt-28">
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
                    : `${getTagStyle(t)} hover:opacity-80`
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        {/* Лента карточек */}
        {result.items.length > 0 ? (
          <div className="mt-12 space-y-6">
            {result.items.map((preview) => (
              <Link
                key={preview.date}
                href={`/news/${preview.slug}`}
                className="group flex flex-col gap-6 rounded-2xl border border-border bg-white p-6 transition-all hover:shadow-md md:flex-row"
              >
                {preview.coverImagePath ? (
                  <div className="relative w-full shrink-0 overflow-hidden rounded-xl md:w-48">
                    <div className="aspect-[2/1] md:h-32 md:aspect-auto">
                      <Image
                        src={preview.coverImagePath}
                        alt={preview.mainStoryTitle}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-32 w-full shrink-0 items-center justify-center rounded-xl bg-border/50 text-4xl md:w-48">
                    📰
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <time>{formatDate(preview.date)}</time>
                    {preview.digestCount > 0 && (
                      <>
                        <span>&bull;</span>
                        <span>ещё {preview.digestCount} {preview.digestCount === 1 ? 'новость' : preview.digestCount < 5 ? 'новости' : 'новостей'}</span>
                      </>
                    )}
                  </div>
                  <h2 className="mt-2 font-heading text-lg font-bold text-text transition-colors group-hover:text-primary">
                    {preview.mainStoryTitle}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-text-muted">
                    {preview.mainStoryExcerpt}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {preview.mainStoryTags.map((t) => (
                      <span
                        key={t}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getTagStyle(t)}`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
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
