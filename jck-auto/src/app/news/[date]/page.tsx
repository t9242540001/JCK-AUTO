/**
 * @file page.tsx
 * @description Детальная страница новостей за один день /news/YYYY-MM-DD
 * @runs VDS (Next.js server-side, ISR revalidate=3600)
 * @lastModified 2026-04-01
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Send, ExternalLink } from 'lucide-react';
import { getNewsByDate } from '@/services/news/reader';
import { getTagStyle } from '@/lib/newsTagColors';
import { CONTACTS } from '@/lib/constants';

export const revalidate = 3600;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface NewsDatePageProps {
  params: Promise<{ date: string }>;
}

export async function generateMetadata({ params }: NewsDatePageProps): Promise<Metadata> {
  const { date } = await params;
  if (!DATE_RE.test(date)) return {};
  const day = getNewsByDate(date);
  if (!day) return {};

  const description = day.mainStory.body.slice(0, 155);
  return {
    title: { absolute: `${day.mainStory.title} — Новости JCK AUTO` },
    description,
    openGraph: {
      title: day.mainStory.title,
      description,
      type: 'article',
      publishedTime: day.date,
      url: `https://jckauto.ru/news/${day.date}`,
      ...(day.cover?.imagePath
        ? { images: [{ url: `https://jckauto.ru${day.cover.imagePath}` }] }
        : {}),
    },
    alternates: { canonical: `https://jckauto.ru/news/${day.date}` },
  };
}

function TagBadge({ tag }: { tag: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getTagStyle(tag)}`}>
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

export default async function NewsDatePage({ params }: NewsDatePageProps) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const day = getNewsByDate(date);
  if (!day) notFound();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: day.mainStory.title,
    datePublished: day.date,
    author: { '@type': 'Organization', name: 'JCK AUTO' },
    publisher: { '@type': 'Organization', name: 'JCK AUTO' },
    ...(day.cover?.imagePath
      ? { image: `https://jckauto.ru${day.cover.imagePath}` }
      : {}),
  };

  return (
    <div className="min-h-screen bg-white pb-20 pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article className="mx-auto max-w-3xl px-4">
        {/* Хлебная крошка */}
        <Link
          href="/news"
          className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к новостям
        </Link>

        {/* Мета */}
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <time>{formatDate(day.date)}</time>
          {day.mainStory.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>

        {/* Обложка */}
        {day.cover?.imagePath && (
          <div className="relative mt-8 aspect-[2/1] w-full overflow-hidden rounded-xl">
            <Image
              src={day.cover.imagePath}
              alt={day.mainStory.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Главная новость */}
        <section className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wider text-secondary">
            Главное
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            {day.mainStory.title}
          </h1>
          <div className="prose mt-6 max-w-none sm:prose-lg">
            <p className="whitespace-pre-line">{day.mainStory.body}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-muted">
            <span>Источник: {day.mainStory.source}</span>
            {day.mainStory.sourceUrl && (
              <a
                href={day.mainStory.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Оригинал
              </a>
            )}
          </div>
        </section>

        {/* Дайджест */}
        {day.digest.length > 0 && (
          <section className="mt-12 border-t border-border pt-10">
            <p className="text-xs font-medium uppercase tracking-wider text-secondary">
              Коротко
            </p>
            <div className="mt-6 space-y-8">
              {day.digest.map((item, i) => (
                <div key={i}>
                  {i > 0 && <div className="mb-8 border-t border-border/50" />}
                  <h2 className="font-heading text-xl font-bold text-text">
                    {item.title}
                  </h2>
                  <p className="mt-3 whitespace-pre-line text-text-muted">
                    {item.body}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-muted">
                    <span>{item.source}</span>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Оригинал
                      </a>
                    )}
                    {item.tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Маркировка */}
        <p className="mt-12 text-center text-xs text-text-muted/50">
          Подготовлено с использованием ИИ | JCK AUTO
        </p>

        {/* CTA-блок */}
        <div className="mt-12 rounded-2xl border border-border bg-surface-alt p-6 text-center sm:p-8">
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
      </article>
    </div>
  );
}
