"use client";

import { motion } from "framer-motion";
import { BetaBadge } from "@/components/BetaBadge";
import CalculatorCore from "@/components/calculator/CalculatorCore";

export default function CalculatorClient() {
  return (
    <div className="min-h-screen bg-white pb-20 pt-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl px-4 text-center"
      >
        <p className="text-sm font-medium uppercase tracking-wider text-secondary">Калькулятор стоимости</p>
        <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl lg:text-5xl">
          Сколько стоит привезти автомобиль? <BetaBadge />
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-text-muted sm:text-lg">
          Введите параметры и получите расчёт всех расходов &laquo;под ключ&raquo;: таможня, утильсбор, доставка, оформление
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-auto mt-12 max-w-5xl px-4"
      >
        <div className="rounded-2xl border border-border bg-surface p-6 md:p-10">
          <CalculatorCore />
        </div>
      </motion.div>
    </div>
  );
}
