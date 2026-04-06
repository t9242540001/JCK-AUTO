/**
 * @file page.tsx
 * @description Страница калькулятора таможенных пошлин — SEO, FAQ, CTA
 * @lastModified 2026-04-02
 */

import type { Metadata } from "next";
import Link from "next/link";
import { CONTACTS } from "@/lib/constants";
import { BetaBadge, BetaBanner } from "@/components/BetaBadge";
import CustomsClient from "./CustomsClient";
import { CalculatorFAQ } from "../calculator/CalculatorFAQ";
import { CalculatorCTA } from "../calculator/CalculatorCTA";

export const metadata: Metadata = {
  title: { absolute: "Калькулятор растаможки авто 2026 — расчёт пошлин и утильсбора | JCK AUTO" },
  description:
    "Бесплатный онлайн-калькулятор таможенных платежей при импорте авто. Расчёт для физлиц и юрлиц: пошлина, акциз, НДС, утилизационный сбор. Актуальные ставки 2026 года.",
  keywords:
    "калькулятор растаможки, таможенные платежи авто, утилизационный сбор калькулятор, ЕТС калькулятор, растаможка авто 2026, пошлина на авто",
  openGraph: {
    title: "Калькулятор растаможки авто 2026 — JCK AUTO",
    description: "Рассчитайте таможенные платежи: пошлина, акциз, НДС, утильсбор. Сравнение физлицо и юрлицо.",
    url: "https://jckauto.ru/tools/customs",
  },
  alternates: { canonical: "https://jckauto.ru/tools/customs" },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Калькулятор таможенных пошлин на авто 2026 — JCK AUTO",
  description: "Онлайн-расчёт таможенных платежей при импорте автомобиля в РФ: ЕТС, пошлина, акциз, НДС, утильсбор",
  url: "https://jckauto.ru/tools/customs",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "RUB" },
  provider: { "@type": "Organization", name: "JCK AUTO", url: "https://jckauto.ru" },
};

const faqItems = [
  {
    question: "Чем отличается растаможка для физлиц и юрлиц?",
    answer:
      "Физические лица платят ЕТС (единую таможенную ставку) — это один платёж, заменяющий пошлину, акциз и НДС. Юридические лица платят три отдельных платежа: таможенную пошлину, акциз и НДС 20%. Утилизационный сбор у юрлиц всегда рассчитывается по коммерческой ставке.",
  },
  {
    question: "Что такое ЕТС (Единая таможенная ставка)?",
    answer:
      "ЕТС — упрощённый таможенный платёж для физических лиц. Зависит от объёма двигателя и возраста автомобиля. Для авто до 3 лет также учитывается стоимость в евро. Заменяет собой пошлину, акциз и НДС.",
  },
  {
    question: "Почему утильсбор так сильно отличается для авто до и после 160 л.с.?",
    answer:
      "Автомобили мощностью до 160 л.с. и объёмом до 3 литров попадают под льготный тариф утилизационного сбора: 3 400 ₽ (до 3 лет) или 5 200 ₽ (старше 3 лет). Свыше этих порогов действуют коммерческие ставки — от 662 000 до 4 155 000 ₽.",
  },
  {
    question: "Какой курс валюты используется?",
    answer:
      "Курс ЦБ РФ на дату расчёта. Для ЕТС и пошлин расчёт ведётся через курс евро. Для конвертации цены авто из валюты в рубли — курс соответствующей валюты (юань, вона, иена, евро, доллар).",
  },
  {
    question: "Что ещё нужно оплатить кроме таможенных платежей?",
    answer:
      "СБКТС (~25 000 ₽), ЭПТС (~1 200 ₽), услуги брокера, доставка до города в РФ. Для полного расчёта всех расходов используйте калькулятор «под ключ».",
  },
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

export default function CustomsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="min-h-screen bg-white pb-20 pt-28">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Калькулятор пошлин
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            Расчёт таможенных платежей <BetaBadge />
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-text-muted sm:text-lg">
            Сравните стоимость растаможки для физических и юридических лиц.
            Все ставки актуальны на 2026 год.
          </p>
        </div>

        <BetaBanner />
        <CustomsClient />

        {/* SEO-текст */}
        <section className="mx-auto mt-16 max-w-3xl px-4">
          <div className="prose prose-sm max-w-none text-text-muted">
            <h2 className="text-lg font-semibold text-text">Как устроены таможенные платежи при импорте авто в РФ</h2>
            <p>
              При ввозе автомобиля из-за рубежа оплачиваются несколько видов платежей. Для <strong>физических лиц</strong> основной
              платёж — Единая таможенная ставка (ЕТС), которая заменяет пошлину, акциз и НДС. Размер ЕТС зависит от объёма
              двигателя и возраста автомобиля (Решение ЕАЭС от 2017 года).
            </p>
            <p>
              <strong>Юридические лица</strong> платят три отдельных платежа: таможенную пошлину (15-20% стоимости),
              акциз (по мощности двигателя, НК РФ ст. 193) и НДС 20%. Кроме того, все категории покупателей
              оплачивают утилизационный сбор (ПП РФ №1713 от 2025 года с индексацией 2026) и сбор за таможенное
              оформление (ПП РФ №863).
            </p>
            <p>
              Для полного расчёта стоимости с учётом доставки, оформления и других расходов воспользуйтесь{" "}
              <Link href="/tools/calculator">калькулятором «под ключ»</Link>. В{" "}
              <Link href="/catalog">каталоге</Link> представлены автомобили с готовым расчётом цены.
              Подробнее о процессе импорта читайте в нашем <Link href="/blog">блоге</Link>.
            </p>
          </div>
        </section>
      </div>

      <CalculatorFAQ items={faqItems} />
      <CalculatorCTA contacts={CONTACTS} />
    </>
  );
}
