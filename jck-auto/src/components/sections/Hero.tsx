"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Calculator, Send } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

const stats = [
  { value: "3", label: "страны поставок" },
  { value: "от 45", label: "дней доставка" },
  { value: "100%", label: "прозрачность" },
  { value: "до 2 лет", label: "гарантия ВСК" },
];

const fadeInUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center bg-gradient-to-b from-background to-surface-alt">
      {/* TODO: Replace background with hero car image */}
      <div className="pointer-events-none absolute -right-32 -top-32 -z-10 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />

      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-32">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
            🚗 Китай &bull; Корея &bull; Япония
          </span>
        </motion.div>

        {/* H1 */}
        <motion.h1
          className="mt-6 font-heading text-4xl font-bold md:text-5xl lg:text-6xl"
          {...fadeInUp(0.1)}
          viewport={{ once: true }}
        >
          <span className="text-text">Привезём автомобиль</span>
          <br />
          <span className="text-primary">вашей мечты из Азии</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mt-6 max-w-xl text-lg text-text-muted"
          {...fadeInUp(0.2)}
          viewport={{ once: true }}
        >
          Полное сопровождение от подбора на аукционе до получения ключей.
          Прозрачные цены, проверка каждого авто, гарантия до 2 лет.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="mt-8 flex flex-col gap-4 sm:flex-row"
          {...fadeInUp(0.3)}
          viewport={{ once: true }}
        >
          <Link
            href="/calculator"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-8 py-3.5 text-lg font-medium text-white transition-colors hover:bg-secondary-hover"
          >
            <Calculator className="h-5 w-5" />
            Рассчитать стоимость
          </Link>
          <a
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary px-8 py-3.5 text-lg font-medium text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <Send className="h-5 w-5" />
            Написать в Telegram
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4"
          initial="hidden"
          animate="visible"
          viewport={{ once: true }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                delayChildren: 0.4,
                staggerChildren: 0.1,
              },
            },
          }}
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className={`${i < stats.length - 1 ? "md:border-r md:border-border" : ""} md:pr-6`}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
              }}
            >
              <div className="text-2xl font-bold text-primary md:text-3xl">
                {stat.value}
              </div>
              <div className="text-sm text-text-muted">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
