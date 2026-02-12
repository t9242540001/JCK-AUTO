"use client";

import { motion } from "framer-motion";
import {
  MessageCircle,
  Search,
  Ship,
  FileCheck,
  Key,
  type LucideIcon,
} from "lucide-react";

interface Step {
  icon: LucideIcon;
  title: string;
  duration: string;
  description: string;
}

const steps: Step[] = [
  {
    icon: MessageCircle,
    title: "Заявка и подбор",
    duration: "1-3 дня",
    description:
      "Обсуждаем ваши пожелания: марка, модель, бюджет, комплектация. Подбираем 2-3 лучших варианта из доступных у проверенных дистрибьюторов.",
  },
  {
    icon: Search,
    title: "Проверка PSI",
    duration: "2-5 дней",
    description:
      "Агент на месте проводит полную проверку: фото/видео кузова и салона, диагностика сканером, замер толщины ЛКП, проверка VIN. Отчёт — вам до оплаты.",
  },
  {
    icon: Ship,
    title: "Выкуп и логистика",
    duration: "20-40 дней",
    description:
      "Выкупаем автомобиль, страхуем на весь период перевозки. Доставка морем из Кореи/Японии или автовозом из Китая до склада в России.",
  },
  {
    icon: FileCheck,
    title: "Таможня и СБКТС",
    duration: "5-10 дней",
    description:
      "Профессиональный брокер оформляет все документы: таможенная пошлина, утильсбор, акциз, НДС. Получаем СБКТС и электронный ПТС.",
  },
  {
    icon: Key,
    title: "Получение",
    duration: "1 день",
    description:
      "Передаём автомобиль с полным пакетом документов. Вы готовы к регистрации в ГИБДД. При желании — оформляем продлённую гарантию ВСК.",
  },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface-alt py-20 md:py-28">
      {/* Header */}
      <motion.div
        className="mx-auto max-w-2xl px-4 text-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
      >
        <p className="text-sm font-medium uppercase tracking-wider text-secondary">
          ПРОЦЕСС РАБОТЫ
        </p>
        <h2 className="mt-3 font-heading text-3xl font-bold text-text md:text-4xl">
          От заявки до ключей за 5 шагов
        </h2>
        <p className="mt-4 text-lg text-text-muted">
          Полное сопровождение на каждом этапе. Вы всегда знаете, что происходит
          с вашим автомобилем.
        </p>
      </motion.div>

      {/* Desktop layout */}
      <motion.div
        className="mx-auto mt-16 hidden max-w-6xl grid-cols-5 gap-0 px-4 md:grid"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerContainer}
      >
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={index}
              className="relative flex flex-col items-center text-center"
              variants={fadeInUp}
            >
              {/* Connecting line */}
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-6 h-0.5 w-full bg-border" />
              )}

              {/* Step number circle */}
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-white">
                {index + 1}
              </div>

              {/* Icon */}
              <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <Icon className="h-6 w-6" />
              </div>

              {/* Title */}
              <h3 className="mt-3 font-semibold text-text">{step.title}</h3>

              {/* Duration badge */}
              <span className="mt-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {step.duration}
              </span>

              {/* Description */}
              <p className="mx-auto mt-2 max-w-[200px] text-sm text-text-muted">
                {step.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Mobile layout */}
      <motion.div
        className="mx-auto mt-12 max-w-lg px-4 md:hidden"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerContainer}
      >
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          return (
            <motion.div
              key={index}
              className={`flex gap-4 ${!isLast ? "pb-10" : ""}`}
              variants={fadeInUp}
            >
              {/* Left: timeline line + circle */}
              <div className="relative flex flex-shrink-0 flex-col items-center">
                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary font-heading text-base font-bold text-white">
                  {index + 1}
                </div>
                {!isLast && (
                  <div className="absolute top-10 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-border" />
                )}
              </div>

              {/* Right: content */}
              <div className="pb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-2 font-semibold text-text">{step.title}</h3>
                <span className="mt-1 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {step.duration}
                </span>
                <p className="mt-2 text-sm text-text-muted">
                  {step.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
