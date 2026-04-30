"use client";

import * as m from "framer-motion/m";
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
    <section id="how-it-works" className="bg-surface-alt py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Процесс
          </p>
          <h2 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            Как мы работаем
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-text-muted sm:text-lg">
            Пять шагов от заявки до получения автомобиля. Вы контролируете каждый
            этап — мы присылаем фото и видео на каждом шаге
          </p>
        </m.div>

        {/* Unified responsive timeline — single block for both breakpoints */}
        <div className="mt-12 grid gap-8 md:grid-cols-5 md:gap-4">
          {steps.map((step, i) => (
            <m.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative flex gap-4 md:flex-col md:items-center md:gap-0 md:text-center"
            >
              <div className="relative flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                  <step.icon className="h-6 w-6" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs font-bold text-white ring-2 ring-surface-alt">
                  {i + 1}
                </span>
              </div>
              {i < steps.length - 1 && (
                <>
                  {/* RULE: connector-line offsets depend on circle size (h-12 =
                      48px, radius 24px) and parent gap (mobile gap-8 = 2rem,
                      desktop md:gap-4 = 16px). Changing icon-circle size requires
                      updating left/top and width/height calc() accordingly. */}
                  <div
                    aria-hidden
                    className="absolute left-6 top-12 h-[calc(100%+2rem)] w-px bg-border md:hidden"
                  />
                  <div
                    aria-hidden
                    className="absolute top-6 left-[calc(50%+24px)] hidden h-px w-[calc(100%-48px)] bg-border md:block"
                  />
                </>
              )}
              <div className="md:mt-4">
                <h3 className="font-heading text-sm font-bold text-text">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-text-muted md:mt-2 md:text-xs">
                  {step.description}
                </p>
              </div>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
