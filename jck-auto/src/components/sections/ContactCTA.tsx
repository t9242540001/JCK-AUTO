"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, Phone } from "lucide-react";
import { CONTACTS, type Country } from "@/lib/constants";
import { getWhatsAppLink } from "@/lib/utils";

const countryColors: Record<Country, string> = {
  china: "bg-china",
  korea: "bg-korea",
  japan: "bg-japan",
};

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
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
            {CONTACTS.team.map((member, i) => (
              <motion.div
                key={member.whatsapp}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border bg-white p-6"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${countryColors[member.country]}`}
                >
                  {member.name.charAt(0)}
                </div>
                <h3 className="mt-3 font-heading font-bold text-text">
                  {member.name}
                </h3>
                <p className="text-xs text-text-muted">{member.role}</p>
                <a
                  href={`tel:${member.phone.replace(/\s|\(|\)|-/g, "")}`}
                  className="mt-2 flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary"
                >
                  <Phone className="h-3 w-3" />
                  {member.phone}
                </a>
                <div className="mt-4 flex gap-2">
                  <a
                    href={getWhatsAppLink(member.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#20BD5A]"
                    aria-label={`WhatsApp ${member.name}`}
                  >
                    <MessageCircle className="h-3 w-3" />
                    WA
                  </a>
                  <a
                    href={CONTACTS.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#2AABEE] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#229ED9]"
                    aria-label={`Telegram ${member.name}`}
                  >
                    <Send className="h-3 w-3" />
                    TG
                  </a>
                </div>
              </motion.div>
            ))}
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
