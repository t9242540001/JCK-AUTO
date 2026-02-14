"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Phone } from "lucide-react";
import { CONTACTS, type Country } from "@/lib/constants";

export default function ContactCTA() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country>("china");
  const [comment, setComment] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(
      `Спасибо, ${name}! Мы свяжемся с вами в ближайшее время.`
    );
    setName("");
    setPhone("");
    setCountry("china");
    setComment("");
    // TODO: send to backend
  };

  return (
    <section id="contact" className="bg-surface-alt py-20">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Контакты
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-text md:text-4xl">
            Свяжитесь с нами
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
            Выберите удобный способ связи или оставьте заявку
          </p>
        </motion.div>

        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          <div className="flex flex-col gap-4 lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-border bg-white p-6"
            >
              <h3 className="font-heading text-lg font-bold text-text">
                Наши контакты
              </h3>
              <a
                href={`tel:${CONTACTS.phoneRaw}`}
                className="mt-4 flex items-center gap-2 text-text-muted transition-colors hover:text-primary"
              >
                <Phone className="h-5 w-5" />
                <span className="text-lg font-medium">{CONTACTS.phone}</span>
              </a>
              <div className="mt-6 flex gap-3">
                <a
                  href={CONTACTS.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#229ED9]"
                >
                  <Send className="h-4 w-4" />
                  {CONTACTS.telegramHandle}
                </a>
                <a
                  href={`tel:${CONTACTS.phoneRaw}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  <Phone className="h-4 w-4" />
                  Позвонить
                </a>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-white p-6 lg:col-span-2"
          >
            <h3 className="font-heading text-lg font-bold text-text">
              Оставить заявку
            </h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                required
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Телефон"
                required
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as Country)}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="china">Китай</option>
                <option value="korea">Южная Корея</option>
                <option value="japan">Япония</option>
              </select>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Комментарий (необязательно)"
                rows={3}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-secondary px-6 py-3.5 font-medium text-white transition-colors hover:bg-secondary-hover"
              >
                Отправить заявку
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
