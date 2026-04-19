/**
 * @file page.tsx
 * @description Страница AI-расшифровки аукционных листов — SEO, FAQ, CTA
 * @lastModified 2026-04-19
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Upload, Cpu, FileText } from "lucide-react";
import { BetaBadge, BetaBanner } from "@/components/BetaBadge";
import AuctionSheetClient from "./AuctionSheetClient";
import { CalculatorFAQ } from "../calculator/CalculatorFAQ";
import { CalculatorCTA } from "../calculator/CalculatorCTA";

export const metadata: Metadata = {
  title: { absolute: "AI расшифровка аукционного листа из Японии по фото — бесплатно | JCK AUTO" },
  description:
    "Бесплатная AI-расшифровка японских аукционных листов по фото. Перевод, оценка состояния, дефекты кузова, комплектация — обычно за 20–60 секунд.",
  keywords:
    "расшифровка аукционного листа, аукционный лист японский, AI расшифровка, перевод аукционного листа, USS, TAA, HAA",
  openGraph: {
    title: "AI расшифровка аукционного листа — JCK AUTO",
    description: "Загрузите фото — получите расшифровку на русском обычно за 20–60 секунд",
    url: "https://jckauto.ru/tools/auction-sheet",
  },
  alternates: { canonical: "https://jckauto.ru/tools/auction-sheet" },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AI расшифровка аукционного листа — JCK AUTO",
  description: "Загрузите фото аукционного листа — AI переведёт на русский и расшифрует все данные обычно за 20–60 секунд",
  url: "https://jckauto.ru/tools/auction-sheet",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "RUB" },
  provider: { "@type": "Organization", name: "JCK AUTO", url: "https://jckauto.ru" },
};

const faqItems = [
  {
    question: "Какие аукционные листы можно расшифровать?",
    answer: "Поддерживаются листы японских аукционов: USS, TAA, HAA, JU, CAA, AUCNET, JAA и другие. AI распознаёт стандартные форматы японских аукционных листов.",
  },
  {
    question: "Насколько точна AI-расшифровка?",
    answer: "Точность зависит от качества фото. При хорошем освещении и высоком разрешении точность составляет 85-95%. Рекомендуем фотографировать без бликов, с ровным освещением.",
  },
  {
    question: "Сколько расшифровок можно сделать бесплатно?",
    answer: "Без регистрации — 3 расшифровки (лимит не обновляется). Для продолжения — авторизация через Telegram-бот @jckauto_help_bot (10 расшифровок в сутки, пауза 2 минуты между запросами).",
  },
  {
    question: "Можно ли скачать результат?",
    answer: "Да, после расшифровки доступна кнопка «Скачать PDF». Отчёт содержит все распознанные данные в удобном формате с контактами JCK AUTO.",
  },
  {
    question: "Что если фото плохого качества?",
    answer: "AI попытается распознать максимум данных. Нераспознанные поля будут собраны в свёрнутом блоке «Дополнительный текст с листа» — разверните его, чтобы увидеть исходные фрагменты. Для лучшего результата используйте фото без бликов и смазывания.",
  },
  {
    question: "Как расшифровать коды дефектов?",
    answer: "AI автоматически переводит все коды: A — царапины, U — вмятины, W — ремонт/подкрас, S — ржавчина, X — замена детали, Y — трещины. Каждый дефект показан с расположением и степенью серьёзности.",
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

const steps = [
  { icon: Upload, title: "Загрузите фото", desc: "Перетащите или выберите фото аукционного листа" },
  { icon: Cpu, title: "AI анализирует", desc: "Qwen Vision распознаёт и переводит все данные" },
  { icon: FileText, title: "Получите результат", desc: "Расшифровка на русском + PDF-отчёт" },
];

export default function AuctionSheetPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="min-h-screen bg-white pb-20 pt-28">
        {/* Hero */}
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">Аукционные листы</p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            AI-расшифровка аукционных листов <BetaBadge />
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-text-muted sm:text-lg">
            Загрузите фото аукционного листа — AI переведёт на русский и расшифрует все данные. Обычно за 20–60 секунд.
          </p>
        </div>

        <BetaBanner />
        <AuctionSheetClient />

        {/* How it works */}
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

        {/* SEO text */}
        <section className="mx-auto mt-16 max-w-3xl px-4">
          <div className="prose prose-sm max-w-none text-text-muted">
            <h2 className="text-lg font-semibold text-text">Зачем нужна расшифровка аукционного листа</h2>
            <p>
              Аукционный лист — главный документ при покупке автомобиля с японского аукциона (USS, TAA, HAA и других).
              Он содержит оценку состояния кузова, салона, двигателя, пробег, комплектацию и замечания
              эксперта. Проблема в том, что вся информация на японском языке с использованием специфических
              кодов и сокращений.
            </p>
            <p>
              Наш AI-инструмент автоматически распознаёт фото аукционного листа и переводит все данные на
              русский язык. Система знает все коды дефектов (A — царапины, U — вмятины, W — ремонт,
              S — ржавчина), расшифровывает комплектацию и оценивает общее состояние автомобиля.
            </p>
            <p>
              Для полного расчёта стоимости доставки авто из Японии используйте{" "}
              <Link href="/tools/calculator">калькулятор «под ключ»</Link>. В{" "}
              <Link href="/catalog">каталоге</Link> можно посмотреть актуальные предложения, а в{" "}
              <Link href="/blog">блоге</Link> — подробные руководства по импорту.
            </p>
          </div>
        </section>
      </div>

      <CalculatorFAQ items={faqItems} heading="Аукционные листы. Частые вопросы" />
      <CalculatorCTA />
    </>
  );
}
