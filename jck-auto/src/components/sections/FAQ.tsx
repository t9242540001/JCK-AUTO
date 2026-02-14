"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqData } from "@/data/faq";

export default function FAQ() {
  return (
    <section id="faq" className="bg-white py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Вопросы
          </p>
          <h2 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            Частые вопросы
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-text-muted sm:text-lg">
            Ответы на самые популярные вопросы об импорте автомобилей
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-12 max-w-3xl"
        >
          <Accordion type="single" collapsible>
            {faqData.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="mb-3 rounded-xl border border-border px-4 data-[state=open]:border-l-2 data-[state=open]:border-l-secondary"
              >
                <AccordionTrigger className="text-left text-sm font-medium text-text hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-text-muted">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
