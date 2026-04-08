"use client";

import { motion } from "framer-motion";
import CalculatorCore from "@/components/calculator/CalculatorCore";

export default function Calculator() {
  return (
    <section id="calculator" className="bg-white py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Калькулятор
          </p>
          <h2 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            Узнайте стоимость вашего авто за 30 секунд
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-text-muted sm:text-lg">
            Калькулятор учитывает таможенные пошлины, утилизационный сбор,
            доставку и наши услуги. Без скрытых платежей
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-12 max-w-5xl rounded-2xl border border-border bg-surface p-6 md:p-8"
        >
          <CalculatorCore showDeepLink />
        </motion.div>
      </div>
    </section>
  );
}
