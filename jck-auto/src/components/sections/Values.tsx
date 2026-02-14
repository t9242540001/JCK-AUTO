"use client";

import { motion } from "framer-motion";
import { Eye, ShieldCheck, GraduationCap, RefreshCw } from "lucide-react";

const values = [
  {
    icon: Eye,
    title: "Прозрачность",
    description:
      "Полный фотоотчёт на каждом этапе — кузов, салон, двигатель, VIN. Вы видите всё до оплаты. Никаких скрытых платежей.",
  },
  {
    icon: ShieldCheck,
    title: "Ответственность",
    description:
      "Если обнаружен скрытый дефект — ремонт за наш счёт. Гарантия ВСК до 2 лет на новые авто из Китая.",
  },
  {
    icon: GraduationCap,
    title: "Экспертность",
    description:
      "Работаем с дистрибьюторами Китая, Encar.com в Корее и аукционами Японии. Знаем особенности каждого рынка.",
  },
  {
    icon: RefreshCw,
    title: "Гибкость",
    description:
      "Подберём любую марку и комплектацию — от бюджетного кроссовера до Mercedes с китайского рынка.",
  },
];

export default function Values() {
  return (
    <section id="values" className="bg-surface-alt py-20">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Наши ценности
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-text md:text-4xl">
            Почему выбирают нас
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
            Принципы, которыми мы руководствуемся в каждой сделке
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {values.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-border bg-white p-6 transition-all hover:border-t-2 hover:border-t-secondary hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <v.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-bold text-text">
                {v.title}
              </h3>
              <p className="mt-2 text-sm text-text-muted">{v.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
