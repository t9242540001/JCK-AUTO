import type { Metadata } from "next";
import Link from "next/link";
import { Check, Phone, Send } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "О компании",
  description:
    "Команда экспертов по импорту автомобилей из Китая, Кореи и Японии.",
};

const miniStats = [
  { value: "3", label: "страны" },
  { value: "45+", label: "дней" },
  { value: "24/7", label: "на связи" },
  { value: "2 года", label: "гарантия" },
];

const vskFeatures = [
  "Авторизованные СТО по всей стране",
  "Оригинальные запчасти",
  "На территории всей РФ",
];

export default function AboutPage() {
  return (
    <>
      {/* Block 1 — Hero */}
      <section className="bg-white pb-16 pt-28">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            О компании
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-text md:text-4xl lg:text-5xl">
            Делаем импорт автомобилей прозрачным и понятным
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted">
            JCK AUTO — команда специалистов, каждый из которых отвечает за свою
            страну. Мы не посредники между посредниками. Мы сами выстроили
            цепочку от аукциона до вашего гаража.
          </p>
        </div>
      </section>

      {/* Block 2 — Mission */}
      <section className="bg-surface-alt py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="font-heading text-2xl font-bold text-text md:text-3xl">
                Наша миссия
              </h2>
              <p className="mt-4 text-text-muted">
                Мы хотим сделать рынок импортных автомобилей честным и понятным.
                Каждый клиент должен знать, за что он платит, и быть уверен в
                качестве автомобиля ещё до его покупки.
              </p>
              <p className="mt-4 text-text-muted">
                90% наших клиентов приходят по рекомендациям — это лучшее
                подтверждение того, что наш подход работает. Мы не гонимся за
                количеством сделок, а строим долгосрочные отношения.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
        </div>
      </section>

      {/* Block 3 — Team & Contact */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-secondary">
              Наша команда
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-text md:text-3xl">
              Профессиональная команда экспертов
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-text-muted">
              Наши специалисты работают по каждому направлению: Китай, Корея и Япония.
              Свяжитесь с нами для консультации.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-lg">
            <div className="rounded-2xl border border-border bg-white p-8 text-center">
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
                  Telegram {CONTACTS.telegramHandle}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Block 4 — VSK */}
      <section className="bg-primary py-16">
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
                <li key={f} className="flex items-center gap-3">
                  <Check className="h-5 w-5 shrink-0 text-secondary" />
                  <span className="text-white/80">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Block 5 — CTA */}
      <section className="bg-surface-alt py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-heading text-2xl font-bold text-text md:text-3xl">
            Готовы обсудить ваш автомобиль?
          </h2>
          <p className="mt-4 text-lg text-text-muted">
            Свяжитесь с нами или рассчитайте стоимость прямо сейчас
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-secondary px-8 py-4 font-medium text-white transition-colors hover:bg-secondary-hover"
            >
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
