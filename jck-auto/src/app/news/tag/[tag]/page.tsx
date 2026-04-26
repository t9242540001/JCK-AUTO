/**
 * @file page.tsx
 * @description Страница фильтрации новостей по тегу /news/tag/[tag]
 * @runs VDS (Next.js server-side, Dynamic per-request — searchParams pagination overrides ISR)
 * @lastModified 2026-04-25
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { getNewsDaysPaginated, getAllTags } from '@/services/news/reader';
import { getTagStyle } from '@/lib/newsTagColors';
import { CONTACTS } from '@/lib/constants';
import NewsDayCard from '@/components/news/NewsDayCard';

// @rule Same as /news: `searchParams` (page pagination) forces Dynamic
// rendering, overriding the `revalidate` export. Kept for intent
// documentation. See ADR [2026-04-25] Б-14 closed — /news ISR drift.
export const revalidate = 3600;

const TAG_DESCRIPTIONS: Record<string, string> = {
  'электромобили': 'Новости электромобилей: тренды, модели, батареи, зарядная инфраструктура, рынок EV в России и мире.',
  'китайские_авто': 'Новости китайского автопрома: BYD, Chery, Geely, Haval — модели, цены, импорт в Россию.',
  'корейские_авто': 'Новости корейских автопроизводителей: Hyundai, Kia, Genesis — модели и цены для России.',
  'японские_авто': 'Новости японского автопрома: Toyota, Honda, Mazda, Subaru — модели и импорт.',
  'рынок_РФ': 'Автомобильный рынок России: продажи, тренды, аналитика, прогнозы.',
  'законодательство': 'Автомобильное законодательство: утильсбор, таможенные пошлины, ГОСТ, техрегламент.',
  'технологии': 'Автомобильные технологии: автопилот, подключённые авто, новые двигатели.',
  'автоспорт': 'Новости автоспорта: Формула-1, WRC, гонки на выносливость.',
  'глобальный_рынок': 'Мировой автомобильный рынок: тренды, продажи, новые модели.',
  'импорт': 'Импорт автомобилей в Россию: правила, стоимость, логистика.',
  'утильсбор': 'Утилизационный сбор: ставки, изменения, влияние на цены авто.',
  'таможня': 'Таможенное оформление авто: пошлины, процедуры, документы.',
  'гибриды': 'Гибридные автомобили: модели, технологии, цены.',
  'безопасность': 'Безопасность автомобилей: краш-тесты, системы помощи водителю.',
};

interface TagPageProps {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  const description = TAG_DESCRIPTIONS[decodedTag]
    ?? `Новости автомобильного мира: ${decodedTag}. Ежедневный дайджест от JCK AUTO.`;

  return {
    title: { absolute: `${decodedTag} — новости автомобильного мира | JCK AUTO` },
    description,
    openGraph: {
      title: `${decodedTag} — новости | JCK AUTO`,
      description,
      url: `https://jckauto.ru/news/tag/${decodedTag}`,
    },
    alternates: { canonical: `https://jckauto.ru/news/tag/${decodedTag}` },
  };
}

export default async function NewsTagPage({ params, searchParams }: TagPageProps) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const allTags = getAllTags();
  const result = getNewsDaysPaginated(page, 7, decodedTag);

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Новости: ${decodedTag}`,
    url: `https://jckauto.ru/news/tag/${decodedTag}`,
  };

  return (
    <div className="min-h-screen bg-white pb-20 pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      <div className="mx-auto max-w-4xl px-4">
        {/* Хлебная крошка */}
        <Link
          href="/news"
          className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Все новости
        </Link>

        {/* Заголовок */}
        <div className="mt-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Новости
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            {decodedTag}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-text-muted sm:text-lg">
            Все новости с тегом &laquo;{decodedTag}&raquo;
          </p>
        </div>

        {/* Фильтр по тегам */}
        {allTags.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link
              href="/news"
              className="rounded-full px-3 py-1 text-sm font-medium bg-surface-alt text-text-muted hover:bg-primary/10 transition-colors"
            >
              Все
            </Link>
            {allTags.map((t) => (
              <Link
                key={t}
                href={`/news/tag/${t}`}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  decodedTag === t
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
              <NewsDayCard key={preview.date} preview={preview} />
            ))}
          </div>
        ) : (
          <p className="mt-16 text-center text-text-muted">
            Новостей с тегом &laquo;{decodedTag}&raquo; пока нет.
          </p>
        )}

        {/* Пагинация */}
        {result.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-4">
            {page > 1 && (
              <Link
                href={`/news/tag/${decodedTag}?page=${page - 1}`}
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
                href={`/news/tag/${decodedTag}?page=${page + 1}`}
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
