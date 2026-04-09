import type { Metadata } from "next";
import Image from "next/image";
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
import SocialFollow from "@/components/sections/SocialFollow";

export const metadata: Metadata = {
  title: {
    absolute:
      "О компании JCK AUTO — надёжный импорт автомобилей из Азии",
  },
  description:
    "JCK AUTO — импорт автомобилей из Китая, Кореи и Японии с полным сопровождением. Проверка перед покупкой, доставка, таможня, гарантия ВСК до 2 лет. Работаем под заказ.",
  keywords:
    "JCK AUTO, импорт авто из Китая Кореи Японии, компания по ввозу автомобилей, авто из Китая компания, гарантия ВСК автомобиль",
  openGraph: {
    title: "О компании JCK AUTO — надёжный импорт автомобилей из Азии",
    description:
      "JCK AUTO — импорт автомобилей из Китая, Кореи и Японии с полным сопровождением.",
    url: "https://jckauto.ru/about",
  },
  alternates: {
    canonical: "https://jckauto.ru/about",
  },
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

const aboutPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "О компании JCK AUTO",
  description: "Импорт автомобилей из Китая, Кореи и Японии под ключ",
  url: "https://jckauto.ru/about",
  mainEntity: {
    "@type": "Organization",
    name: "JCK AUTO",
  },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }}
      />
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
                  aria-label="Telegram"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#229ED9]"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Telegram</span>
                </a>
                <a
                  href={CONTACTS.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
                <a
                  href={CONTACTS.max}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Max"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0077FF] px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
                >
                  <Image src="/images/max-icon.svg" alt="Max" width={16} height={16} className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Max</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SocialFollow />

      {/* Crosslink — Cars */}
      <section className="bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-surface p-8 text-center sm:flex-row sm:text-left md:p-10">
            <div className="flex-1">
              <p className="text-sm font-medium uppercase tracking-wider text-secondary">
                Каталог
              </p>
              <h2 className="mt-2 font-heading text-xl font-bold text-text sm:text-2xl">
                Автомобили в наличии
              </h2>
              <p className="mt-2 text-text-muted">
                Актуальные предложения из Китая, Кореи и Японии — с ценами под ключ в рублях
              </p>
            </div>
            <Link
              href="/catalog"
              className="shrink-0 rounded-xl bg-primary px-8 py-3 font-medium text-white transition-colors hover:bg-primary/90"
            >
              Смотреть каталог →
            </Link>
          </div>
        </div>
      </section>

      {/* Crosslink — Noscuts */}
      <section className="bg-surface-alt pb-16 pt-0 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-white p-8 text-center sm:flex-row sm:text-left md:p-10">
            <div className="flex-1">
              <p className="text-sm font-medium uppercase tracking-wider text-secondary">
                Запчасти
              </p>
              <h2 className="mt-2 font-heading text-xl font-bold text-text sm:text-2xl">
                Ноускаты из Китая
              </h2>
              <p className="mt-2 text-text-muted">
                Комплекты деталей передней части авто — бампер, оптика, радиатор. От 199 000 ₽
              </p>
            </div>
            <Link
              href="/catalog/noscut"
              className="shrink-0 rounded-xl border-2 border-primary px-8 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Смотреть ноускаты →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
