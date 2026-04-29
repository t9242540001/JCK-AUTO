"use client";

import Link from "next/link";
import * as m from "framer-motion/m";
import { CONTACTS } from "@/lib/constants";
import LeadForm from "@/components/LeadForm";

export default function ContactCTA() {
  return (
    <section id="contact" className="bg-surface-alt py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <m.div
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

          {/* Inline form */}
          <div className="mt-8 mx-auto w-full max-w-sm text-left">
            <LeadForm
              subject="Заявка с главной страницы"
              ctaLabel="Подобрать автомобиль"
            />
          </div>

          {/* Secondary CTA */}
          <div className="mt-4">
            <Link
              href="/calculator"
              className="text-sm font-medium text-text-muted underline-offset-4
                         transition-colors hover:text-primary hover:underline"
            >
              Или рассчитайте стоимость самостоятельно →
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
        </m.div>
      </div>
    </section>
  );
}
