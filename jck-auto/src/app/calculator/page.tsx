import type { Metadata } from "next";
import CalculatorClient from "./CalculatorClient";
import { CONTACTS } from "@/lib/constants";
import { HowToUse } from "./HowToUse";
import { PopularCars } from "./PopularCars";
import { CalculatorFAQ } from "./CalculatorFAQ";
import { CalculatorCTA } from "./CalculatorCTA";
import { SocialSubscribe } from "./SocialSubscribe";

export const metadata: Metadata = {
  title:
    "Калькулятор растаможки авто из Китая, Кореи и Японии — расчёт под ключ | JCK AUTO",
  description:
    "Бесплатный онлайн-калькулятор стоимости импорта автомобиля. Рассчитайте таможенные пошлины, утилизационный сбор, доставку и оформление за 30 секунд. Актуальные курсы ЦБ РФ.",
  keywords:
    "калькулятор растаможки авто, расчёт таможенных платежей, стоимость растаможки автомобиля из китая, калькулятор импорта авто, утилизационный сбор калькулятор, растаможка авто из кореи, растаможка авто из японии",
  openGraph: {
    title: "Калькулятор растаможки авто — JCK AUTO",
    description:
      "Рассчитайте полную стоимость автомобиля из Китая, Кореи или Японии под ключ. Таможня, утильсбор, доставка — всё в одном расчёте.",
    url: "https://jckauto.ru/calculator",
  },
  alternates: {
    canonical: "https://jckauto.ru/calculator",
  },
};

const faqItems = [
  {
    question: "Насколько точен калькулятор?",
    answer:
      "Калькулятор даёт ориентировочную стоимость с точностью ±5-10%. Итоговая цена зависит от фактического курса валюты на дату оформления и конкретных условий доставки. Для точного расчёта свяжитесь с менеджером.",
  },
  {
    question: "Что входит в стоимость «под ключ»?",
    answer:
      "Цена автомобиля, доставка до границы РФ со страховкой, таможенное оформление (пошлина + ЕТС), утилизационный сбор, расходы в России (СБКТС, ЭРА-ГЛОНАСС, СВХ, брокер, логистика до Уссурийска) и комиссия JCK AUTO.",
  },
  {
    question: "Почему утилизационный сбор так сильно влияет на цену?",
    answer:
      "С декабря 2025 года автомобили мощнее 160 л.с. облагаются коммерческим утильсбором от 1 млн руб. Автомобили до 160 л.с. попадают под льготный тариф — всего 3,400-5,200\u00A0₽. Поэтому мы рекомендуем выбирать модели до 160 л.с.",
  },
  {
    question: "Какой курс валюты используется?",
    answer:
      "Калькулятор загружает актуальный курс ЦБ РФ. Для расчёта стоимости автомобиля используется курс с наценкой 2% (приближение к банковскому безналичному курсу). Таможенные платежи в евро рассчитываются по курсу ЦБ.",
  },
  {
    question: "Можно ли рассчитать авто из Кореи и Японии?",
    answer:
      "Да, калькулятор поддерживает три страны: Китай (юани), Южная Корея (воны) и Япония (иены). Выберите нужную страну в первом поле — валюта переключится автоматически.",
  },
  {
    question: "Как получить точный расчёт под конкретную модель?",
    answer:
      "Напишите нашему менеджеру в Telegram — мы найдём конкретный автомобиль, проверим наличие и рассчитаем точную стоимость с учётом всех актуальных условий.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Калькулятор растаможки авто — JCK AUTO",
  description:
    "Онлайн-калькулятор полной стоимости импорта автомобиля из Китая, Кореи и Японии",
  url: "https://jckauto.ru/calculator",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "RUB",
  },
  provider: {
    "@type": "Organization",
    name: "JCK AUTO",
    url: "https://jckauto.ru",
  },
};

export default function CalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <CalculatorClient />

      <HowToUse />
      <PopularCars />
      <CalculatorFAQ items={faqItems} />
      <CalculatorCTA contacts={CONTACTS} />
      <SocialSubscribe contacts={CONTACTS} />
    </>
  );
}
