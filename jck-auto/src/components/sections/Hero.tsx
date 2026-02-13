"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CONTACTS } from "@/lib/constants";

const stats = [
  { value: "3", label: "страны" },
  { value: "от 45", label: "дней" },
  { value: "100%", label: "прозрачность" },
  { value: "до 2 лет", label: "гарантия" },
];

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-gradient-to-b from-white to-surface-alt overflow-hidden">
      <div className="absolute top-20 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-20 -left-32 h-72 w-72 rounded-full bg-secondary/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <span className="inline-block rounded-full bg-surface-alt px-4 py-1.5 text-sm font-medium text-text-muted">
            🚗 Китай &bull; Корея &bull; Япония
          </span>

          <h1 className="mt-6 font-heading text-4xl font-bold leading-tight text-text sm:text-5xl md:text-6xl">
            Привезём автомобиль{" "}
            <span className="text-primary">вашей мечты из Азии</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-text-muted">
            Полное сопровождение от подбора на аукционе до получения ключей.
            Прозрачные цены, проверка каждого авто, гарантия до 2 лет от
            Страхового Дома ВСК.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/calculator"
              className="rounded-xl bg-secondary px-8 py-4 text-center font-medium text-white transition-colors hover:bg-secondary-hover"
            >
              Рассчитать стоимость
            </Link>
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border-2 border-primary px-8 py-4 text-center font-medium text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Написать в Telegram
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-white p-6 text-center"
            >
              <p className="font-heading text-3xl font-bold text-primary">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-text-muted">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
