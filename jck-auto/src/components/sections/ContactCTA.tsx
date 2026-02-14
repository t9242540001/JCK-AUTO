"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

export default function ContactCTA() {
  return (
    <section id="contact" className="bg-surface-alt py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Начните сейчас
          </p>
          <h2 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            Расскажите, какой автомобиль ищете — мы подберём лучший вариант
          </h2>
          <p className="mt-4 text-base text-text-muted sm:text-lg">
            Бесплатная консультация. Ответим в течение 15 минут
          </p>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-secondary px-8 py-4 font-medium text-white transition-colors hover:bg-secondary-hover"
            >
              <Send className="h-5 w-5" />
              Написать в Telegram
            </a>
            <Link
              href="/calculator"
              className="rounded-xl border-2 border-primary px-8 py-4 text-center font-medium text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Рассчитать стоимость
            </Link>
          </div>

          <p className="mt-6 text-sm text-text-muted">
            Или позвоните:{" "}
            <a
              href={`tel:${CONTACTS.phoneRaw}`}
              className="font-medium text-text transition-colors hover:text-primary"
            >
              {CONTACTS.phone}
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
