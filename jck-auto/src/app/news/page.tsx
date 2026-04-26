/**
 * @file page.tsx
 * @description Страница /news — каталог всех новостей (компактные карточки-превью)
 * @runs VDS (Next.js server-side, Dynamic per-request — searchParams pagination overrides ISR)
 * @lastModified 2026-04-25
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getNewsDaysPaginated, getAllTags } from '@/services/news/reader';
import { getTagStyle } from '@/lib/newsTagColors';
import NewsDayCard from '@/components/news/NewsDayCard';
import LeadFormTrigger from '@/components/LeadFormTrigger';
import SocialFollow from '@/components/sections/SocialFollow';

// @rule Reading `searchParams` (page pagination) is a Dynamic API in
// Next.js 16 — it forces per-request rendering and OVERRIDES the
// `revalidate` export below. The export is kept as documentation of
// intent (cache pages where possible) but at runtime this route is
// Dynamic. To make /news truly ISR, pagination would need to move to
// a path-based form like `/news/page/N`. See ADR [2026-04-25] Б-14
// closed — /news ISR drift documented.
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

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  const allTags = getAllTags();
  const result = getNewsDaysPaginated(page, 7);

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
              className="rounded-full px-3 py-1 text-sm font-medium bg-primary text-white"
            >
              Все
            </Link>
            {allTags.map((t) => (
              <Link
                key={t}
                href={`/news/tag/${t}`}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${getTagStyle(t)} hover:opacity-80`}
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
            Новости скоро появятся. Мы готовим для вас ежедневные дайджесты автомобильного мира.
          </p>
        )}

        {/* Пагинация */}
        {result.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-4">
            {page > 1 && (
              <Link
                href={`/news?page=${page - 1}`}
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
                href={`/news?page=${page + 1}`}
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
            <LeadFormTrigger
              subject="Заявка с раздела Новости"
              triggerLabel="Оставить заявку"
              ctaLabel="Отправить заявку"
              modalTitle="Хотите привезти автомобиль?"
              triggerVariant="primary"
            />
          </div>
        </div>
      </div>
      <SocialFollow />
    </div>
  );
}
