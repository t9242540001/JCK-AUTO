"use client";

import { motion } from "framer-motion";
import LeadFormTrigger from "@/components/LeadFormTrigger";

export function CalculatorCTA() {
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
          <div className="w-full max-w-xs">
            <LeadFormTrigger
              subject="Заявка с раздела Калькулятор"
              triggerLabel="Оставить заявку"
              ctaLabel="Отправить заявку"
              modalTitle="Точный расчёт под вашу модель"
              triggerVariant="on-primary"
            />
          </div>
          <a
            href="tel:+79147321950"
            className="inline-flex items-center rounded-xl border-2 border-white
                       px-6 py-3 font-semibold text-white transition-opacity
                       hover:opacity-90"
          >
            Позвонить
          </a>
        </div>
      </motion.div>
    </section>
  );
}
