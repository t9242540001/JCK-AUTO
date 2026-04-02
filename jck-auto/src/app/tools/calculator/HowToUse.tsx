"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: 1,
    title: "Выберите страну и введите цену",
    description:
      "Укажите страну покупки и цену автомобиля в местной валюте. Курс ЦБ РФ подставится автоматически.",
  },
  {
    number: 2,
    title: "Укажите характеристики",
    description:
      "Объём двигателя в литрах, мощность в лошадиных силах и возраст автомобиля. Это влияет на таможенные платежи.",
  },
  {
    number: 3,
    title: "Получите расчёт под ключ",
    description:
      "Калькулятор рассчитает все расходы: таможню, утильсбор, доставку до Уссурийска и оформление.",
  },
];

export function HowToUse() {
  return (
    <section className="bg-surface py-16">
      <div className="mx-auto max-w-5xl px-4">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 text-center text-2xl font-bold text-text sm:text-3xl"
        >
          Как пользоваться калькулятором
        </motion.h2>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {step.number}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-text">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-muted">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
