"use client";

import { motion } from "framer-motion";
import { Check, MessageCircle } from "lucide-react";
import { CONTACTS, type Country } from "@/lib/constants";
import { getWhatsAppLink, cn } from "@/lib/utils";

interface CountryData {
  country: Country;
  name: string;
  flag: string;
  description: string;
  features: string[];
  brands: string[];
  borderColor: string;
}

const countries: CountryData[] = [
  {
    country: "china",
    name: "Китай",
    flag: "🇨🇳",
    description:
      "Новые автомобили напрямую от дистрибьюторов. Лучшие цены, гарантия ВСК.",
    features: [
      "Новые авто с завода",
      "Гарантия до 2 лет от ВСК",
      "Доставка 30-45 дней",
      "Полная русификация",
    ],
    brands: ["Changan", "Haval", "Geely", "Chery"],
    borderColor: "hover:border-china",
  },
  {
    country: "korea",
    name: "Южная Корея",
    flag: "🇰🇷",
    description:
      "Автомобили с аукционов и от дилеров. Проверка PSI, гарантия пробега.",
    features: [
      "Аукционные авто с проверкой",
      "Гарантированный пробег",
      "Доставка 35-50 дней",
      "Страховка на перевозку",
    ],
    brands: ["Hyundai", "Kia", "Genesis"],
    borderColor: "hover:border-korea",
  },
  {
    country: "japan",
    name: "Япония",
    flag: "🇯🇵",
    description:
      "Легендарное японское качество. Авто с аукционов с оценкой состояния.",
    features: [
      "Аукционная оценка",
      "Минимальный пробег",
      "Доставка 35-55 дней",
      "Полный пакет документов",
    ],
    brands: ["Toyota", "Honda", "Mazda", "Subaru"],
    borderColor: "hover:border-japan",
  },
];

export default function Countries() {
  const getSpecialist = (country: Country) =>
    CONTACTS.team.find((m) => m.country === country)!;

  return (
    <section id="countries" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Направления
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-text md:text-4xl">
            Три страны — одна команда
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
            Работаем напрямую с проверенными поставщиками в каждой стране
          </p>
        </motion.div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {countries.map((c, i) => {
            const specialist = getSpecialist(c.country);
            return (
              <motion.div
                key={c.country}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "rounded-2xl border border-border bg-white p-6 transition-all hover:shadow-md",
                  c.borderColor
                )}
              >
                <div className="text-4xl">{c.flag}</div>
                <h3 className="mt-3 font-heading text-xl font-bold text-text">
                  {c.name}
                </h3>
                <p className="mt-2 text-sm text-text-muted">{c.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {c.brands.map((brand) => (
                    <span
                      key={brand}
                      className="rounded-full bg-surface-alt px-3 py-1 text-xs font-medium text-text-muted"
                    >
                      {brand}
                    </span>
                  ))}
                </div>

                <ul className="mt-4 space-y-2">
                  {c.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      <span className="text-text-muted">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-sm font-medium text-text">
                    {specialist.name}
                  </p>
                  <p className="text-xs text-text-muted">{specialist.role}</p>
                  <a
                    href={getWhatsAppLink(specialist.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#20BD5A]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Написать в WhatsApp
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
