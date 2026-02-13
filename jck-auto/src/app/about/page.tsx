import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { CONTACTS, type Country } from "@/lib/constants";
import { getWhatsAppLink } from "@/lib/utils";

export const metadata: Metadata = {
  title: "О компании",
  description:
    "Команда экспертов по импорту автомобилей из Китая, Кореи и Японии.",
};

const countryColors: Record<Country, string> = {
  china: "bg-china",
  korea: "bg-korea",
  japan: "bg-japan",
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

      {/* Block 3 — Team */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-secondary">
              Наша команда
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-text md:text-3xl">
              Специалист по каждой стране
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {CONTACTS.team.map((member) => (
              <div
                key={member.whatsapp}
                className="rounded-2xl border border-border bg-white p-6 text-center"
              >
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white ${countryColors[member.country]}`}
                >
                  {member.name.charAt(0)}
                </div>
                <p className="mt-2 text-lg">{member.flag}</p>
                <h3 className="mt-2 font-heading font-bold text-text">
                  {member.name}
                </h3>
                <p className="text-sm text-text-muted">{member.role}</p>
                <a
                  href={`tel:${member.phone.replace(/\s|\(|\)|-/g, "")}`}
                  className="mt-2 block text-sm text-text-muted transition-colors hover:text-primary"
                >
                  {member.phone}
                </a>
                <a
                  href={getWhatsAppLink(member.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-xl bg-[#25D366] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#20BD5A]"
                >
                  WhatsApp
                </a>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-6 max-w-sm">
            <div className="rounded-2xl border border-border bg-white p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                А
              </div>
              <h3 className="mt-3 font-heading font-bold text-text">
                Артём Требов
              </h3>
              <p className="text-sm text-text-muted">
                Встреча и выдача автомобилей
              </p>
              <p className="mt-2 text-sm italic text-text-muted">
                Встретит вас при получении автомобиля
              </p>
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
