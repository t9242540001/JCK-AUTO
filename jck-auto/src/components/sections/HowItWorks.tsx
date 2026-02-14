"use client";

import { motion } from "framer-motion";
import { MessageCircle, Search, Ship, FileCheck, Key } from "lucide-react";

const steps = [
  {
    icon: MessageCircle,
    title: "Заявка",
    description:
      "Бесплатная консультация: обсуждаем марку, бюджет, комплектацию и подбираем лучшие варианты",
  },
  {
    icon: Search,
    title: "Подбор и проверка",
    description:
      "Находим авто, проводим PSI-проверку с фото- и видеоотчётом. Вы одобряете автомобиль до оплаты",
  },
  {
    icon: Ship,
    title: "Покупка и доставка",
    description:
      "Выкупаем авто, организуем доставку морем или автовозом со страховкой на весь путь",
  },
  {
    icon: FileCheck,
    title: "Таможня и документы",
    description:
      "Берём на себя растаможку, СБКТС, оформление ЭПТС — полный пакет для регистрации в ГИБДД",
  },
  {
    icon: Key,
    title: "Получение",
    description:
      "Передаём ключи и все документы. Помогаем с регистрацией в ГИБДД",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface-alt py-20">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Процесс
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-text md:text-4xl">
            Как мы работаем
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
            Пять шагов от заявки до получения автомобиля. Вы контролируете каждый
            этап — мы присылаем фото и видео на каждом шаге
          </p>
        </motion.div>

        {/* Desktop timeline */}
        <div className="mt-12 hidden md:grid md:grid-cols-5 md:gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative text-center"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white">
                <step.icon className="h-6 w-6" />
              </div>
              {i < steps.length - 1 && (
                <div className="absolute top-7 left-[calc(50%+28px)] right-[calc(-50%+28px)] h-px bg-border" />
              )}
              <h3 className="mt-4 font-heading text-sm font-bold text-text">
                {step.title}
              </h3>
              <p className="mt-2 text-xs text-text-muted">{step.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Mobile vertical timeline */}
        <div className="mt-12 space-y-8 md:hidden">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative flex gap-4 pl-8"
            >
              <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="absolute left-[11px] top-8 h-full w-px bg-border" />
              )}
              <div>
                <h3 className="font-heading text-sm font-bold text-text">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
