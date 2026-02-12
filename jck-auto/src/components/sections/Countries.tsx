"use client";

import { motion } from "framer-motion";
import { Check, Phone } from "lucide-react";
import { countries, type CountryCard } from "@/data/countries";
import { getWhatsAppLink, formatPhone } from "@/lib/utils";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const accentBorderClass: Record<CountryCard["accentColor"], string> = {
  china: "hover:border-china",
  korea: "hover:border-korea",
  japan: "hover:border-japan",
};

export default function Countries() {
  return (
    <section id="countries" className="bg-white py-20 md:py-28">
      {/* Header */}
      <motion.div
        className="mx-auto max-w-2xl text-center"
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <p className="text-sm font-medium uppercase tracking-wider text-secondary">
          ГЕОГРАФИЯ ПОСТАВОК
        </p>
        <h2 className="mt-3 font-heading text-3xl font-bold text-text md:text-4xl">
          Привезём авто из любой страны Азии
        </h2>
        <p className="mt-4 text-lg text-text-muted">
          Каждая страна — свой специалист, который знает рынок изнутри
        </p>
      </motion.div>

      {/* Cards */}
      <motion.div
        className="mx-auto mt-12 grid max-w-6xl gap-6 px-4 md:grid-cols-3 lg:gap-8"
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {countries.map((card) => (
          <motion.div
            key={card.accentColor}
            variants={fadeInUp}
            className={`rounded-2xl border border-border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md lg:p-8 ${accentBorderClass[card.accentColor]}`}
          >
            {/* Flag + Country name */}
            <div className="flex items-center gap-3">
              <span className="text-4xl">{card.flag}</span>
              <span className="text-xl font-bold text-text">{card.country}</span>
            </div>

            {/* Description */}
            <p className="mt-3 text-text-muted">{card.description}</p>

            {/* Features */}
            <ul className="mt-4 space-y-2">
              {card.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-success" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Divider */}
            <div className="mt-6 border-t border-border pt-6">
              {/* Specialist */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                  {card.specialist.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-text">{card.specialist.name}</p>
                  <p className="text-sm text-text-muted">{card.specialist.role}</p>
                </div>
              </div>

              {/* Phone */}
              <a
                href={`tel:${formatPhone(card.specialist.phone)}`}
                className="mt-3 flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-primary"
              >
                <Phone className="h-4 w-4" />
                {card.specialist.phone}
              </a>

              {/* WhatsApp button */}
              <a
                href={getWhatsAppLink(
                  card.specialist.whatsapp,
                  `Здравствуйте! Интересует автомобиль из ${card.country}.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full rounded-xl bg-[#25D366] py-2.5 text-center font-medium text-white transition-colors hover:bg-[#1da851]"
              >
                Написать в WhatsApp
              </a>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
