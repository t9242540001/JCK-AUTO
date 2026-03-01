"use client";

import { motion } from "framer-motion";
import { Send, Youtube } from "lucide-react";

interface SocialSubscribeProps {
  contacts: {
    telegram: string;
    youtube: string;
  };
}

const socials = [
  {
    key: "telegram",
    icon: Send,
    title: "Telegram-канал",
    description: "Новости, акции и кейсы доставок",
    hrefKey: "telegram" as const,
  },
  {
    key: "youtube",
    icon: Youtube,
    title: "YouTube-канал",
    description: "Обзоры авто и видеоотзывы",
    hrefKey: "youtube" as const,
  },
];

export function SocialSubscribe({ contacts }: SocialSubscribeProps) {
  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-text sm:text-3xl">
            Следите за нами
          </h2>
          <p className="mt-2 text-text-muted">
            Обзоры автомобилей, новости рынка и выгодные предложения
          </p>
        </motion.div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {socials.map((social, i) => (
            <motion.a
              key={social.key}
              href={contacts[social.hrefKey]}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border border-border p-6 transition-shadow hover:shadow-md"
            >
              <social.icon className="mx-auto mb-3 h-8 w-8 text-primary" />
              <h3 className="font-semibold text-text">{social.title}</h3>
              <p className="mt-1 text-sm text-text-muted">
                {social.description}
              </p>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
