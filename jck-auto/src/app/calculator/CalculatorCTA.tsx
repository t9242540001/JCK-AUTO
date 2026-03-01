"use client";

import { motion } from "framer-motion";

interface CalculatorCTAProps {
  contacts: {
    telegram: string;
    phoneRaw: string;
  };
}

export function CalculatorCTA({ contacts }: CalculatorCTAProps) {
  return (
    <section className="bg-primary py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto max-w-3xl px-4 text-center"
      >
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Хотите точный расчёт под вашу модель?
        </h2>
        <p className="mt-3 text-white/80">
          Напишите менеджеру — найдём автомобиль, проверим наличие и рассчитаем
          точную стоимость
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={contacts.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl bg-white px-8 py-3 font-semibold text-primary transition-opacity hover:opacity-90"
          >
            Написать в Telegram
          </a>
          <a
            href={`tel:${contacts.phoneRaw}`}
            className="inline-flex items-center rounded-xl border-2 border-white px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          >
            Позвонить
          </a>
        </div>
      </motion.div>
    </section>
  );
}
