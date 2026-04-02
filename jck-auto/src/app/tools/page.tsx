/**
 * @file page.tsx
 * @description Хаб-страница раздела «Сервисы» — карточки инструментов
 * @runs browser
 * @rule Все 4 карточки должны присутствовать, даже если инструмент ещё не реализован
 * @lastModified 2026-04-02
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Calculator, Receipt, FileSearch, Car, Send } from 'lucide-react';
import { CONTACTS } from '@/lib/constants';

export const metadata: Metadata = {
  title: { absolute: 'Калькуляторы и сервисы для импорта авто — JCK AUTO' },
  description:
    'Бесплатные онлайн-инструменты для импорта автомобилей: калькулятор стоимости под ключ, расчёт таможенных пошлин, AI-расшифровка аукционных листов, анализатор Encar.',
  openGraph: {
    title: 'Калькуляторы и сервисы для импорта авто — JCK AUTO',
    description:
      'Бесплатные инструменты: калькулятор под ключ, расчёт пошлин, расшифровка аукционных листов, анализатор Encar.',
    url: 'https://jckauto.ru/tools',
  },
  alternates: { canonical: 'https://jckauto.ru/tools' },
};

const tools = [
  {
    icon: Calculator,
    title: 'Калькулятор «под ключ»',
    description: 'Полный расчёт стоимости авто с доставкой и растаможкой',
    href: '/tools/calculator',
    soon: false,
  },
  {
    icon: Receipt,
    title: 'Калькулятор пошлин',
    description: 'Расчёт таможенных платежей: пошлина, акциз, НДС, утильсбор',
    href: '/tools/customs',
    soon: true,
  },
  {
    icon: FileSearch,
    title: 'Аукционные листы',
    description: 'AI-расшифровка японских аукционных листов по фото',
    href: '/tools/auction-sheet',
    soon: true,
  },
  {
    icon: Car,
    title: 'Анализатор Encar',
    description: 'Перевод и расчёт стоимости авто с Encar.com',
    href: '/tools/encar',
    soon: true,
  },
];

const webAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Калькуляторы и сервисы для импорта авто — JCK AUTO',
  description:
    'Бесплатные онлайн-инструменты: калькулятор под ключ, расчёт пошлин, расшифровка аукционных листов, анализатор Encar',
  url: 'https://jckauto.ru/tools',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' },
  provider: { '@type': 'Organization', name: 'JCK AUTO', url: 'https://jckauto.ru' },
};

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-white pb-20 pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />

      {/* Hero */}
      <div className="mx-auto max-w-4xl px-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-secondary">
          Сервисы
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
          Сервисы и калькуляторы
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-text-muted sm:text-lg">
          Бесплатные инструменты для расчёта стоимости импорта авто из Китая, Кореи и Японии
        </p>
      </div>

      {/* Карточки */}
      <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 px-4 sm:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              {tool.soon && (
                <span className="absolute right-4 top-4 rounded-full bg-secondary/10 px-2 py-1 text-xs font-medium text-secondary">
                  Скоро
                </span>
              )}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mt-4 font-heading text-lg font-semibold text-text">
                {tool.title}
              </h2>
              <p className="mt-2 text-sm text-text-muted">{tool.description}</p>
            </Link>
          );
        })}
      </div>

      {/* SEO-текст */}
      <section className="mx-auto mt-16 max-w-3xl px-4">
        <div className="prose prose-sm max-w-none text-text-muted">
          <p>
            JCK AUTO предлагает набор бесплатных онлайн-инструментов для тех, кто планирует
            импорт автомобиля из Азии. <strong>Калькулятор «под ключ»</strong> рассчитает полную
            стоимость с учётом доставки, таможенных платежей и оформления.{' '}
            <strong>Калькулятор пошлин</strong> покажет детальный расчёт таможенной пошлины, акциза,
            НДС и утилизационного сбора.
          </p>
          <p>
            Для покупателей с японских аукционов — <strong>AI-расшифровка аукционных листов</strong>:
            загрузите фото листа и получите перевод на русский язык с расшифровкой оценок.{' '}
            <strong>Анализатор Encar</strong> поможет разобраться в корейском сайте: переведёт
            характеристики и рассчитает стоимость доставки в Россию.
          </p>
          <p>
            Все инструменты работают бесплатно. Для подбора конкретного автомобиля
            загляните в <Link href="/catalog">каталог</Link> или почитайте{' '}
            <Link href="/blog">полезные статьи</Link> об импорте.
          </p>
        </div>
      </section>

      {/* CTA */}
      <div className="mx-auto mt-16 max-w-4xl px-4">
        <div className="rounded-2xl bg-primary p-8 text-center text-white">
          <h2 className="font-heading text-xl font-bold sm:text-2xl">
            Хотите привезти авто? Оставьте заявку
          </h2>
          <p className="mt-2 text-white/70">
            Рассчитаем стоимость, найдём авто, сопроводим на всех этапах
          </p>
          <a
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#2AABEE] px-8 py-3 font-medium text-white transition-colors hover:bg-[#229ED9]"
          >
            <Send className="h-4 w-4" />
            Написать в Telegram
          </a>
        </div>
      </div>
    </div>
  );
}
