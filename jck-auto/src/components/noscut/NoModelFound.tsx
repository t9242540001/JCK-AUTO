"use client";

import { CONTACTS } from "@/lib/constants";
import LeadForm from "@/components/LeadForm";

export default function NoModelFound() {
  return (
    <section className="mt-12 rounded-2xl border border-border bg-white p-6 text-center md:p-10">
      <h2 className="font-heading text-2xl font-bold text-text">
        Не нашли нужную модель?
      </h2>
      <p className="mt-2 text-text-muted">
        Свяжитесь с нами — подберём ноускат под любой автомобиль
      </p>

      <div className="mt-6 flex flex-col items-center gap-4">
        <a
          href={CONTACTS.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary/90"
        >
          Написать в Telegram
        </a>

        <div className="w-full max-w-md">
          <LeadForm compact subject="Подбор ноуската" ctaLabel="Оставить заявку" />
        </div>
      </div>
    </section>
  );
}
