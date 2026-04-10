"use client";

import LeadFormTrigger from "@/components/LeadFormTrigger";

export default function NoModelFound() {
  return (
    <section className="mt-12 rounded-2xl border border-border bg-white p-6 text-center md:p-10">
      <h2 className="font-heading text-2xl font-bold text-text">
        Не нашли нужную модель?
      </h2>
      <p className="mt-2 text-text-muted">
        Свяжитесь с нами — подберём ноускат под любой автомобиль
      </p>

      <div className="mt-6 flex justify-center">
        <div className="w-full max-w-sm">
          <LeadFormTrigger
            subject="Подбор ноуската"
            triggerLabel="Оставить заявку"
            ctaLabel="Отправить заявку"
            modalTitle="Подбор ноуската"
            triggerVariant="primary"
          />
        </div>
      </div>
    </section>
  );
}
