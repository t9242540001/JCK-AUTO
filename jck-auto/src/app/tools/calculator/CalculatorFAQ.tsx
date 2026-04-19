/**
 * @file CalculatorFAQ.tsx
 * @description Shared FAQ accordion used by /tools/* pages. Heading
 *              is per-tool to keep h2 aligned with the page's core
 *              keyword (SEO) and user expectations.
 * @lastModified 2026-04-19
 * @rule The `heading` prop is REQUIRED (not optional). Every consumer
 *       must pass a per-tool heading — calculator: "Расчёт. Частые
 *       вопросы", customs: "Растаможка. Частые вопросы", encar:
 *       "Encar. Частые вопросы", auction-sheet: "Аукционные листы.
 *       Частые вопросы". Making it optional with a default would
 *       silently regress the non-calculator pages.
 */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

function FAQAccordionItem({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="pr-4 font-medium text-text">{item.question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-text-muted">
          {item.answer}
        </p>
      )}
    </div>
  );
}

export function CalculatorFAQ({ items, heading }: { items: FAQItem[]; heading: string }) {
  return (
    <section className="bg-surface py-16">
      <div className="mx-auto max-w-3xl px-4">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 text-center text-2xl font-bold text-text sm:text-3xl"
        >
          {heading}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {items.map((item) => (
            <FAQAccordionItem key={item.question} item={item} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
