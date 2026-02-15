"use client";

import { motion } from "framer-motion";
import { Camera, ShieldCheck, FileText, Headphones } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: Camera,
    title: "Проверка перед покупкой",
    description:
      "Фото/видео отчёт, компьютерная диагностика, проверка ЛКП толщиномером",
  },
  {
    icon: ShieldCheck,
    title: "Гарантия ВСК до 2 лет",
    description:
      "Официальная гарантия от страховой компании ВСК на новые авто из Китая",
  },
  {
    icon: FileText,
    title: "Полное таможенное оформление",
    description: "ЭПТС, СБКТС, лаборатория — оформим все документы под ключ",
  },
  {
    icon: Headphones,
    title: "Сопровождение на каждом этапе",
    description:
      "Персональный менеджер на связи от подбора до постановки на учёт",
  },
];

export default function CarTrustBlock() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="font-heading text-xl font-bold text-text sm:text-2xl">
        Почему безопасно покупать через JCK AUTO
      </h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {TRUST_ITEMS.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="flex gap-3"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-text">{item.title}</p>
              <p className="mt-1 text-sm text-text-muted">
                {item.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
