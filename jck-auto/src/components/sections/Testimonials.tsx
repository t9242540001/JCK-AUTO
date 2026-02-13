"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { testimonials } from "@/data/testimonials";
import { CONTACTS } from "@/lib/constants";

const countryFlag: Record<string, string> = {
  china: "🇨🇳",
  korea: "🇰🇷",
  japan: "🇯🇵",
};

export default function Testimonials() {
  return (
    <section id="testimonials" className="bg-surface-alt py-20">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Отзывы
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-text md:text-4xl">
            Что говорят клиенты
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
            Реальные отзывы людей, которые уже привезли авто с нашей помощью
          </p>
        </motion.div>

        {/* Desktop grid */}
        <div className="mt-12 hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
          {testimonials.slice(0, 3).map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-border bg-white p-6"
            >
              <div className="flex gap-1">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star
                    key={j}
                    className="h-4 w-4 fill-secondary text-secondary"
                  />
                ))}
              </div>
              <p className="mt-4 text-sm text-text-muted">
                &laquo;{t.text}&raquo;
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-sm font-medium text-text">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.city}</p>
                </div>
                <span className="rounded-full bg-surface-alt px-3 py-1 text-xs font-medium text-text-muted">
                  {countryFlag[t.country]} {t.car}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile horizontal scroll */}
        <div className="mt-12 flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:hidden">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="min-w-[280px] shrink-0 rounded-2xl border border-border bg-white p-6"
            >
              <div className="flex gap-1">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star
                    key={j}
                    className="h-4 w-4 fill-secondary text-secondary"
                  />
                ))}
              </div>
              <p className="mt-4 text-sm text-text-muted">
                &laquo;{t.text}&raquo;
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-sm font-medium text-text">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.city}</p>
                </div>
                <span className="rounded-full bg-surface-alt px-3 py-1 text-xs font-medium text-text-muted">
                  {countryFlag[t.country]} {t.car}
                </span>
              </div>
            </div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <a
            href={CONTACTS.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Больше отзывов на YouTube &rarr;
          </a>
        </motion.div>
      </div>
    </section>
  );
}
