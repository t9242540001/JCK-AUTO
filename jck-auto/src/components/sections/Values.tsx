"use client";

import { motion } from "framer-motion";
import { Eye, ShieldCheck, GraduationCap, RefreshCw } from "lucide-react";

const values = [
  {
    icon: Eye,
    title: "Прозрачность",
    description:
      "Открытые цены без скрытых комиссий. Полный фото- и видеоотчёт на каждом этапе — от осмотра до погрузки.",
  },
  {
    icon: ShieldCheck,
    title: "Ответственность",
    description:
      "Берём на себя решение проблем. Если при проверке пропущен дефект — ремонт за наш счёт.",
  },
  {
    icon: GraduationCap,
    title: "Экспертность",
    description:
      "По каждой стране — свой специалист, который знает рынок, аукционы и особенности импорта изнутри.",
  },
  {
    icon: RefreshCw,
    title: "Гибкость",
    description:
      "Быстро адаптируемся к изменениям законодательства и находим лучшие решения для каждого клиента.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function Values() {
  return (
    <section id="values" className="py-20 md:py-28 bg-surface-alt">
      <motion.div
        className="text-center max-w-2xl mx-auto px-4"
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <p className="text-secondary uppercase tracking-wider text-sm font-medium">
          ПОЧЕМУ МЫ
        </p>
        <h2 className="mt-3 text-3xl md:text-4xl font-bold text-text font-heading">
          Ценности, на которых строится наш бизнес
        </h2>
      </motion.div>

      <motion.div
        className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 max-w-6xl mx-auto px-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {values.map((item) => (
          <motion.div
            key={item.title}
            variants={fadeInUp}
            className="group bg-white rounded-2xl border border-border p-6 lg:p-8 transition-all duration-300 hover:shadow-md hover:border-t-2 hover:border-t-secondary"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <item.icon size={24} />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-text">
              {item.title}
            </h3>
            <p className="mt-2 text-text-muted text-sm leading-relaxed">
              {item.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
