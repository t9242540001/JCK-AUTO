import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  Phone,
  Send,
  ShieldCheck,
  Car,
  Users,
  Eye,
  Camera,
  ScanSearch,
  Paintbrush,
  FileCheck,
} from "lucide-react";
import { CONTACTS } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    absolute:
      "О компании JCK AUTO — импорт авто из Китая, Кореи и Японии",
  },
  description:
    "JCK AUTO — импорт автомобилей из Китая, Кореи и Японии с полным сопровождением. Проверка перед покупкой, доставка, таможня, гарантия ВСК до 2 лет. Работаем под заказ.",
  keywords:
    "JCK AUTO, импорт авто из Китая Кореи Японии, компания по ввозу автомобилей, авто из Китая компания, гарантия ВСК автомобиль",
};

const values = [
  {
    icon: Eye,
    title: "Прозрачность",
    text: "Клиент видит каждый этап: от подбора до доставки. Никаких скрытых комиссий и неожиданных доплат.",
  },
  {
    icon: ShieldCheck,
    title: "Ответственность",
    text: "Берём на себя все риски логистики и таможенного оформления. Несём финансовую ответственность за результат.",
  },
  {
    icon: Users,
    title: "Экспертность",
    text: "Знаем рынки Китая, Кореи и Японии изнутри. Работаем с проверенными агентами и площадками в каждой стране.",
  },
  {
    icon: Car,
    title: "Гибкость",
    text: "Подбираем автомобиль под ваши задачи и бюджет. Каждый заказ индивидуален — нет шаблонных решений.",
  },
];

const countries = [
  {
    name: "Китай",
    description:
      "Работаем через дистрибьюторов с доступом к дилерским сетям. Не только китайские бренды — привозим автомобили любых мировых марок, доступных на китайском рынке: Toyota, BMW, Mercedes, Volkswagen и другие.",
  },
  {
    name: "Корея",
    description:
      "99% подбора через платформу Encar.com — крупнейший автомобильный маркетплейс Южной Кореи. Работаем через проверенных агентов-партнёров на месте.",
  },
  {
    name: "Япония",
    description:
      "Подбор через японские аукционы: USS, TAA, HAA и другие площадки. Работаем через проверенных агентов с прямым доступом к аукционным торгам.",
  },
];

const vskFeatures = [
  "Продлённая гарантия до 2 лет на новые автомобили",
  "Ремонт только в авторизованных СТО с оригинальными запчастями",
  "Действует на всей территории РФ",
  "Эксклюзивный продукт на рынке",
];

const psiSteps = [
  {
    icon: Camera,
    title: "Фото- и видеоотчёт",
    text: "Полный отчёт: кузов, салон, двигатель, пробег, VIN-номер.",
  },
  {
    icon: ScanSearch,
    title: "Диагностика сканером",
    text: "Компьютерная диагностика всех систем автомобиля.",
  },
  {
    icon: Paintbrush,
    title: "Толщина ЛКП",
    text: "Проверка лакокрасочного покрытия толщиномером для выявления ремонта.",
  },
  {
    icon: FileCheck,
    title: "Отчёт клиенту",
    text: "Результаты проверки отправляются вам до подтверждения сделки.",
  },
];

const miniStats = [
  { value: "3", label: "страны" },
  { value: "Любые", label: "модели авто и техники" },
  { value: "24/7", label: "на связи" },
  { value: "2 года", label: "гарантия" },
];

export default function AboutPage() {
  return (
    <>
      {/* Block 1 — Hero */}
      <section className="bg-white pb-10 pt-28 sm:pb-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            О компании
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl lg:text-5xl">
            Делаем импорт автомобилей простым и понятным
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-text-muted sm:text-lg">
            JCK AUTO — работаем под заказ клиента. Каждый автомобиль — новый или
            с пробегом — подбирается индивидуально под ваши задачи и бюджет.
          </p>
        </div>
      </section>

      {/* Block 2 — Mission & Values */}
      <section className="bg-surface-alt py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid items-start gap-12 md:grid-cols-2">
            <div>
              <h2 className="font-heading text-2xl font-bold text-text md:text-3xl">
                Наша миссия
              </h2>
              <p className="mt-4 text-lg font-medium text-text">
                Делать рынок доступных и качественных автомобилей из Китая,
                Кореи и Японии прозрачным и клиентоориентированным.
              </p>
              <p className="mt-4 text-text-muted">
                90% наших клиентов приходят по рекомендациям — это лучшее
                подтверждение того, что наш подход работает. Мы не гонимся за
                количеством сделок, а строим долгосрочные отношения.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                {miniStats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-border bg-white p-5 text-center"
                  >
                    <p className="font-heading text-2xl font-bold text-primary">
                      {s.value}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-heading text-2xl font-bold text-text md:text-3xl">
                Наши ценности
              </h2>
              <div className="mt-6 space-y-5">
                {values.map((v) => (
                  <div key={v.title} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <v.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading text-base font-bold text-text">
                        {v.title}
                      </h3>
                      <p className="mt-1 text-sm text-text-muted">{v.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Block 3 — Sources per country */}
      <section className="bg-white py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-secondary">
              Как мы работаем
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-text md:text-3xl">
              Источники подбора по странам
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-text-muted">
              Для каждой страны — своя модель подбора, проверенные партнёры и
              отлаженная логистика. Вопрос локализации интерфейса обсуждается
              индивидуально.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {countries.map((c) => (
              <div
                key={c.name}
                className="rounded-2xl border border-border bg-surface-alt p-6"
              >
                <h3 className="font-heading text-xl font-bold text-primary">
                  {c.name}
                </h3>
                <p className="mt-3 text-sm text-text-muted">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Block 4 — PSI */}
      <section className="bg-surface-alt py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-secondary">
              Контроль качества
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-text md:text-3xl">
              Предотгрузочная проверка (PSI)
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-text-muted">
              Каждый автомобиль проходит независимую проверку перед отправкой.
              Вы получаете полный отчёт до подтверждения сделки.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {psiSteps.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-border bg-white p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 font-heading text-base font-bold text-text">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-text-muted">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Block 5 — VSK */}
      <section className="bg-primary py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">
              Наш партнёр — Страховой Дом ВСК
            </h2>
            <p className="mt-4 text-white/70">
              На новые автомобили из Китая доступна продлённая гарантия до 2 лет.
              Защита от непредвиденных поломок двигателя, КПП и основных узлов.
            </p>
            <ul className="mt-8 space-y-3 text-left">
              {vskFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <span className="text-white/80">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Block 6 — Contact */}
      <section className="bg-white py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-lg">
            <div className="rounded-2xl border border-border bg-white p-6 text-center sm:p-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                JCK
              </div>
              <h3 className="mt-4 font-heading text-xl font-bold text-text">
                Свяжитесь с нами
              </h3>
              <p className="mt-2 text-sm text-text-muted">
                Ответим на все вопросы по импорту автомобилей
              </p>
              <a
                href={`tel:${CONTACTS.phoneRaw}`}
                className="mt-4 flex items-center justify-center gap-2 text-lg font-medium text-text transition-colors hover:text-primary"
              >
                <Phone className="h-5 w-5" />
                {CONTACTS.phone}
              </a>
              <div className="mt-4 flex gap-3">
                <a
                  href={CONTACTS.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#229ED9]"
                >
                  <Send className="h-4 w-4" />
                  Написать в Telegram
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Block 7 — CTA */}
      <section className="bg-surface-alt py-10 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-heading text-2xl font-bold text-text md:text-3xl">
            Готовы обсудить ваш автомобиль?
          </h2>
          <p className="mt-4 text-base text-text-muted sm:text-lg">
            Свяжитесь с нами или рассчитайте стоимость прямо сейчас
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-secondary px-8 py-4 font-medium text-white transition-colors hover:bg-secondary-hover"
            >
              <Send className="h-5 w-5" />
              Написать в Telegram
            </a>
            <Link
              href="/calculator"
              className="rounded-xl border-2 border-primary px-8 py-4 font-medium text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Калькулятор
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
