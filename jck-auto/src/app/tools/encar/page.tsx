/**
 * @file page.tsx
 * @description Страница анализатора Encar — SEO, FAQ, CTA
 * @lastModified 2026-04-03
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Link2, Search, FileText } from "lucide-react";
import { BetaBadge, BetaBanner } from "@/components/BetaBadge";
import EncarClient from "./EncarClient";
import { CalculatorFAQ } from "../calculator/CalculatorFAQ";
import { CalculatorCTA } from "../calculator/CalculatorCTA";

export const metadata: Metadata = {
  title: { absolute: "Анализатор Encar.com на русском — перевод и расчёт стоимости | JCK AUTO" },
  description: "Вставьте ссылку на авто с Encar.com — получите характеристики на русском и расчёт стоимости доставки в Россию. Бесплатно, без регистрации.",
  keywords: "encar, encar на русском, encar перевод, анализатор encar, авто из кореи, расчёт стоимости",
  openGraph: {
    title: "Анализатор Encar.com — JCK AUTO",
    description: "Вставьте ссылку — получите характеристики на русском и расчёт стоимости",
    url: "https://jckauto.ru/tools/encar",
  },
  alternates: { canonical: "https://jckauto.ru/tools/encar" },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Анализатор Encar.com на русском — JCK AUTO",
  description: "Перевод характеристик авто с Encar.com на русский + расчёт стоимости доставки в Россию",
  url: "https://jckauto.ru/tools/encar",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "RUB" },
  provider: { "@type": "Organization", name: "JCK AUTO", url: "https://jckauto.ru" },
};

const faqItems = [
  { question: "Какие ссылки поддерживаются?", answer: "Ссылки с fem.encar.com/cars/detail/{id} и encar.com/dc/dc_cardetailview.do?carid={id}. Можно вставить просто номер объявления." },
  { question: "Откуда берутся данные?", answer: "Напрямую из открытого API Encar.com в реальном времени. Данные актуальны на момент запроса." },
  { question: "Зачем вводить мощность двигателя?", answer: "Encar не хранит мощность в л.с. Она нужна для расчёта утилизационного сбора и акциза при импорте в РФ. Без неё покажем только данные авто, без расчёта стоимости." },
  { question: "Сколько анализов можно сделать бесплатно?", answer: "3 в день. Для неограниченного доступа — бот @jckauto_help_bot в Telegram." },
  { question: "Можно ли скачать результат?", answer: "Да, кнопка «Скачать PDF» формирует отчёт с данными авто, расчётом стоимости и контактами JCK AUTO." },
  { question: "Насколько точен расчёт стоимости?", answer: "Калькулятор использует ориентировочный курс валют (с учётом средней банковской наценки за безналичный перевод), обновляется каждые 6 часов. Ставки пошлин и утильсбора актуальны на 2026 год. Точность ±5-10%, реальный курс фиксируется при оформлении заявки." },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

const steps = [
  { icon: Link2, title: "Вставьте ссылку", desc: "Скопируйте ссылку на авто с Encar.com" },
  { icon: Search, title: "Загружаем данные", desc: "Получаем характеристики напрямую из Encar" },
  { icon: FileText, title: "Результат на русском", desc: "Перевод + расчёт стоимости в РФ + PDF" },
];

export default function EncarPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="min-h-screen bg-white pb-20 pt-28">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">Анализатор Encar</p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            Авто с Encar.com на русском <BetaBadge />
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-text-muted sm:text-lg">
            Вставьте ссылку на автомобиль — получите характеристики на русском и расчёт стоимости доставки в Россию
          </p>
        </div>

        <BetaBanner />
        <EncarClient />

        {/* Как это работает */}
        <div className="mx-auto mt-16 max-w-4xl px-4">
          <h2 className="text-center font-heading text-xl font-bold text-text sm:text-2xl">Как это работает</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="mt-3 font-heading font-semibold text-text">{step.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* SEO-текст */}
        <section className="mx-auto mt-16 max-w-3xl px-4">
          <div className="prose prose-sm max-w-none text-text-muted">
            <h2 className="text-lg font-semibold text-text">Что такое Encar и зачем нужен анализатор</h2>
            <p>
              Encar.com — крупнейший корейский маркетплейс подержанных автомобилей. На нём продаётся более
              400 000 автомобилей одновременно: Hyundai, Kia, Genesis, Samsung, SsangYong и другие марки.
              Проблема для российского покупателя — сайт полностью на корейском языке.
            </p>
            <p>
              Наш анализатор загружает данные напрямую из API Encar и переводит на русский: марка, модель,
              год, пробег, объём двигателя, тип топлива, КПП, цвет, наличие ДТП. Если указать мощность —
              рассчитаем полную стоимость доставки в Россию с учётом пошлин, утильсбора и логистики.
            </p>
            <p>
              Для полного расчёта стоимости воспользуйтесь{" "}
              <Link href="/tools/calculator">калькулятором «под ключ»</Link>. Другие автомобили — в{" "}
              <Link href="/catalog">каталоге</Link>. Подробнее об импорте из Кореи — в{" "}
              <Link href="/blog">блоге</Link>.
            </p>
          </div>
        </section>
      </div>

      <CalculatorFAQ items={faqItems} />
      <CalculatorCTA />
    </>
  );
}
