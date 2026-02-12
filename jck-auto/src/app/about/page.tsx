import type { Metadata } from "next";
import Link from "next/link";
import { Phone, Check } from "lucide-react";
import { CONTACTS } from "@/lib/constants";
import { formatPhone, getWhatsAppLink } from "@/lib/utils";

export const metadata: Metadata = {
  title: "О компании | JCK AUTO",
  description:
    "Команда экспертов по импорту автомобилей из Китая, Кореи и Японии. Прозрачный бизнес, проверенные партнёры, полное сопровождение сделки.",
};

const stats = [
  { value: "3", label: "страны поставок" },
  { value: "45+", label: "дней средняя доставка" },
  { value: "24/7", label: "на связи с клиентом" },
  { value: "2 года", label: "гарантия ВСК" },
];

const vskFeatures = [
  "Авторизованные СТО",
  "Оригинальные запчасти",
  "На территории всей РФ",
];

const countryAvatarStyles: Record<string, string> = {
  china: "bg-china/10 text-china",
  korea: "bg-korea/10 text-korea",
  japan: "bg-japan/10 text-japan",
};

export default function AboutPage() {
  return (
    <main>
      {/* Hero */}
      <section className="pt-28 pb-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-secondary uppercase tracking-wider text-sm font-medium">
            О КОМПАНИИ
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-bold text-text font-heading">
            Делаем импорт автомобилей прозрачным и понятным
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-text-muted leading-relaxed">
            JCK AUTO — команда специалистов, каждый из которых отвечает за свою
            страну. Мы не посредники между посредниками. Мы сами выстроили
            цепочку от аукциона до вашего гаража.
          </p>
        </div>
      </section>

      {/* Миссия и ценности */}
      <section className="py-16 bg-surface-alt">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-text font-heading">
                Наша миссия
              </h2>
              <p className="mt-4 text-text-muted leading-relaxed">
                Делать рынок доступных и качественных автомобилей из Азии
                прозрачным и клиентоориентированным. Мы верим, что каждый клиент
                заслуживает честной цены, полной информации и уверенности в своей
                покупке.
              </p>
              <p className="mt-4 text-text-muted leading-relaxed">
                Нашу миссию мы измеряем просто: сколько клиентов пришли по
                рекомендации друзей. Это главный показатель доверия.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white rounded-xl p-5 border border-border"
                >
                  <div className="text-2xl font-bold text-primary">
                    {stat.value}
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Команда */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-secondary uppercase tracking-wider text-sm font-medium">
            НАША КОМАНДА
          </p>
          <h2 className="mt-3 text-2xl md:text-3xl font-bold text-text font-heading">
            Специалист по каждой стране
          </h2>
          <p className="mt-4 max-w-2xl text-text-muted">
            Каждый член команды глубоко знает рынок своей страны: аукционы,
            дистрибьюторов, особенности логистики и таможни.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {CONTACTS.team.map((member) => (
              <div
                key={member.name}
                className="bg-surface rounded-2xl p-6 text-center border border-border"
              >
                <div
                  className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold ${countryAvatarStyles[member.country]}`}
                >
                  {member.name[0]}
                </div>
                <div className="mt-3 text-3xl">{member.flag}</div>
                <div className="mt-2 text-lg font-semibold text-text">
                  {member.name}
                </div>
                <div className="text-sm text-text-muted">{member.role}</div>
                <div className="border-t border-border mt-4 pt-4">
                  <a
                    href={`tel:${formatPhone(member.phone)}`}
                    className="flex items-center justify-center gap-2 text-sm text-primary"
                  >
                    <Phone size={14} />
                    {member.phone}
                  </a>
                  <a
                    href={getWhatsAppLink(
                      member.whatsapp,
                      "Здравствуйте! Интересует импорт авто."
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block w-full bg-[#25D366] text-white hover:bg-[#1da851] rounded-xl py-2.5 text-sm font-medium"
                  >
                    Написать в WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Артём Требов */}
          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <div className="md:col-start-2 bg-surface rounded-2xl p-6 text-center border border-border">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold bg-primary/10 text-primary">
                А
              </div>
              <div className="mt-2 text-lg font-semibold text-text">
                Артём Требов
              </div>
              <div className="text-sm text-text-muted">
                Представитель компании
              </div>
              <div className="border-t border-border mt-4 pt-4">
                <p className="text-sm text-text-muted italic">
                  Встретит вас при получении автомобиля и ответит на все вопросы
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Партнёр ВСК */}
      <section className="py-16 bg-primary">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white font-heading">
            Наш партнёр — Страховой Дом ВСК
          </h2>
          <p className="mt-4 text-white/80 text-lg leading-relaxed">
            Мы предлагаем эксклюзивный продукт на рынке — продлённую гарантию до
            2 лет на новые автомобили из Китая. Ремонт только в авторизованных
            СТО с использованием оригинальных запчастей.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-8">
            {vskFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-secondary text-white flex items-center justify-center">
                  <Check size={14} />
                </span>
                <span className="text-white/90">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-surface-alt">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-text font-heading">
            Готовы обсудить ваш автомобиль?
          </h2>
          <p className="mt-4 text-text-muted text-lg">
            Свяжитесь с нами любым удобным способом
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-secondary text-white hover:bg-secondary-hover rounded-xl px-8 py-3.5 font-medium"
            >
              Написать в Telegram
            </a>
            <Link
              href="/calculator"
              className="border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-xl px-8 py-3.5 font-medium"
            >
              Рассчитать стоимость
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
