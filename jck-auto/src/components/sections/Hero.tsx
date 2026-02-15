"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

const stats = [
  { value: "3", label: "страны" },
  { value: "Любые", label: "модели авто и техники" },
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
      <div className="relative mx-auto max-w-7xl px-4 pt-28 pb-8 sm:pt-32 sm:pb-10">
        {/* Main card with semi-transparent background */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl rounded-2xl bg-white/75 p-6 backdrop-blur-sm sm:p-8 md:p-12"
        >
          <span className="inline-block rounded-full bg-surface-alt px-4 py-1.5 text-sm font-medium text-text-muted">
            🚗 Китай &bull; Корея &bull; Япония
          </span>

          <h1 className="mt-6 font-heading text-2xl font-bold leading-tight text-text sm:text-3xl md:text-4xl lg:text-5xl">
            Автомобиль из Китая, Кореи или Японии{" "}
            <span className="text-primary">без посредников</span>
          </h1>

          <p className="mt-5 max-w-xl text-base text-text-muted sm:text-lg">
            Подберём, проверим и доставим автомобиль из Китая, Кореи или Японии.
            Полный фотоотчёт на каждом этапе. Вы платите только после проверки.
            Гарантия до 2 лет от Страхового Дома ВСК.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
            <Link
              href="/calculator"
              className="rounded-xl bg-secondary px-6 py-3.5 text-center font-medium text-white transition-colors hover:bg-secondary-hover sm:px-8 sm:py-4"
            >
              Рассчитать стоимость
            </Link>
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-6 py-3.5 text-center font-medium text-white transition-colors hover:bg-[#229ED9] sm:px-8 sm:py-4"
            >
              <Send className="h-5 w-5" />
              Написать в Telegram
            </a>
          </div>
        </motion.div>

        {/* Stats row — tight spacing under the card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 md:grid-cols-4"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/20 bg-white/70 p-4 text-center backdrop-blur-sm sm:p-6"
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
