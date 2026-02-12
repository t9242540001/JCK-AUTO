"use client";

import { motion } from "framer-motion";
import { Check, ShieldCheck } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

const checkpoints = [
  "Ремонт только в авторизованных СТО на территории РФ",
  "Использование исключительно оригинальных запчастей",
  "Развенчиваем миф о ненадёжности китайских автомобилей",
];

const stats = [
  { value: "2 года", label: "максимальный срок" },
  { value: "100%", label: "оригинальные запчасти" },
  { value: "РФ", label: "авторизованные СТО" },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function Warranty() {
  return (
    <section id="warranty" className="py-20 md:py-28 bg-primary">
      <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
        {/* Left column — text */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="inline-flex bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/90">
            🛡️ Эксклюзивный продукт
          </span>

          <h2 className="mt-4 text-3xl md:text-4xl font-bold text-white font-heading">
            Продлённая гарантия до 2 лет
          </h2>

          <p className="mt-4 text-lg text-white/80">
            Мы — партнёры Страхового Дома ВСК. Предлагаем уникальный продукт на
            рынке: продлённая гарантия на новые автомобили из Китая.
          </p>

          <ul className="mt-6 space-y-4">
            {checkpoints.map((text) => (
              <li key={text} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-secondary text-white flex items-center justify-center flex-shrink-0">
                  <Check size={14} />
                </span>
                <span className="text-white/80">{text}</span>
              </li>
            ))}
          </ul>

          <a
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-8 bg-secondary text-white hover:bg-secondary-hover rounded-xl px-8 py-3.5 font-medium transition-colors"
          >
            Узнать подробнее
          </a>
        </motion.div>

        {/* Right column — partner card */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 md:p-10 text-center">
            <div className="flex justify-center">
              <ShieldCheck size={64} className="text-secondary" />
            </div>

            <p className="mt-4 text-xl font-bold text-white">
              Страховой Дом ВСК
            </p>
            <p className="mt-2 text-white/60">Официальный партнёр</p>

            <div className="mt-6 flex justify-around">
              {stats.map((stat) => (
                <div key={stat.value}>
                  <p className="text-2xl font-bold text-secondary">
                    {stat.value}
                  </p>
                  <p className="text-xs text-white/60 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
