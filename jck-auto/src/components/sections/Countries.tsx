"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Check, Send } from "lucide-react";
import { CONTACTS, type Country } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CountryData {
  country: Country;
  name: string;
  flag: string;
  image: string;
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
    image: "/images/cars/china.jpg",
    description:
      "Новые автомобили напрямую от дистрибьюторов. Не только китайские бренды — Toyota, BMW, Mercedes с китайского рынка.",
    features: [
      "Новые авто от дистрибьюторов — без пробега",
      "Любые мировые марки с внутреннего рынка",
      "Гарантия до 2 лет от ВСК",
      "Доставка автовозом — от 25 дней",
    ],
    brands: ["Changan", "Haval", "Geely", "Toyota", "BMW", "Mercedes"],
    borderColor: "hover:border-china",
  },
  {
    country: "korea",
    name: "Южная Корея",
    flag: "🇰🇷",
    image: "/images/cars/korea.jpg",
    description:
      "Подбор через Encar.com — крупнейшую площадку Кореи. Проверенные б/у авто с прозрачной историей.",
    features: [
      "Подбор через Encar.com — крупнейшую площадку",
      "Проверенные б/у авто с прозрачной историей",
      "Возврат корейского НДС — дополнительная выгода",
      "Доставка морем — 35-50 дней",
    ],
    brands: ["Hyundai", "Kia", "Genesis"],
    borderColor: "hover:border-korea",
  },
  {
    country: "japan",
    name: "Япония",
    flag: "🇯🇵",
    image: "/images/cars/japan.jpg",
    description:
      "Аукционные авто с детальным отчётом состояния. Японское качество обслуживания — минимальный износ.",
    features: [
      "Аукционные авто с детальным отчётом состояния",
      "Японское качество обслуживания — минимальный износ",
      "Доставка морем через Владивосток",
      "Полный пакет документов для ГИБДД",
    ],
    brands: ["Toyota", "Honda", "Mazda", "Subaru"],
    borderColor: "hover:border-japan",
  },
];

export default function Countries() {
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
            Подберём автомобиль с рынка Китая, Кореи или Японии
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
            Для каждой страны — свои источники, проверенные партнёры и отлаженная
            логистика. Честная итоговая цена без скрытых платежей
          </p>
        </motion.div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {countries.map((c, i) => (
            <motion.div
              key={c.country}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "overflow-hidden rounded-2xl border border-border bg-white transition-all hover:shadow-md",
                c.borderColor
              )}
            >
              <div className="relative h-48 md:h-56">
                <Image
                  src={c.image}
                  alt={`Автомобиль из ${c.name}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>

              <div className="p-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{c.flag}</span>
                  <h3 className="font-heading text-xl font-bold text-text">
                    {c.name}
                  </h3>
                </div>
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
                  <a
                    href={CONTACTS.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#229ED9]"
                  >
                    <Send className="h-4 w-4" />
                    Написать в Telegram
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
