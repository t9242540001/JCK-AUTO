"use client";

import Link from "next/link";
import Image from "next/image";
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
    <section className="relative overflow-hidden">
      {/* Background image */}
      <Image
        src="/images/hero-bg.png"
        alt=""
        fill
        className="object-cover object-center"
        priority
        quality={85}
      />

      {/* Content over the background */}
      <div className="relative mx-auto max-w-7xl px-4 pt-28 pb-16 sm:pt-32 sm:pb-20">
        {/* Main card with semi-transparent background */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl rounded-2xl bg-white/85 p-6 backdrop-blur-sm sm:p-8 md:p-12"
        >
          <span className="inline-block rounded-full bg-surface-alt px-4 py-1.5 text-sm font-medium text-text-muted">
            🚗 Китай &bull; Корея &bull; Япония
          </span>

          <h1 className="mt-6 font-heading text-3xl font-bold leading-tight text-text sm:text-4xl md:text-5xl lg:text-6xl">
            Привезём автомобиль{" "}
            <span className="text-primary">вашей мечты из Азии</span>
          </h1>

          <p className="mt-5 max-w-xl text-base text-text-muted sm:text-lg">
            Полное сопровождение от подбора автомобиля до получения ключей.
            Прозрачные цены, проверка каждого авто, гарантия до 2 лет от
            Страхового Дома ВСК.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
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

        {/* Stats row — tight spacing under the card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 md:grid-cols-4"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/20 bg-white/80 p-4 text-center backdrop-blur-sm sm:p-6"
            >
              <p className="font-heading text-2xl font-bold text-primary sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-text-muted sm:text-sm">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
