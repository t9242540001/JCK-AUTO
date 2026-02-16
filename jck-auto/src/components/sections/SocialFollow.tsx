"use client";

import { motion } from "framer-motion";
import { Send, Youtube, Instagram } from "lucide-react";

const socials = [
  {
    label: "Telegram",
    href: "https://t.me/jck_auto_channel",
    icon: Send,
    className: "bg-[#2AABEE] hover:bg-[#229ED9]",
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@JCK_AUTO",
    icon: Youtube,
    className: "bg-[#FF0000] hover:bg-[#CC0000]",
  },
  {
    label: "Instagram",
    href: "https://instagram.com/jck_auto",
    icon: Instagram,
    className: "bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90",
  },
];

export default function SocialFollow() {
  return (
    <section className="bg-[#F1F3F5] py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto max-w-2xl text-center"
      >
        <p className="text-lg font-semibold text-gray-900">
          Подпишитесь, чтобы не потерять контакт
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Следите за новыми поступлениями и добавьте сайт в закладки (Ctrl+D)
        </p>
        <div className="mt-4 flex justify-center gap-4">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform hover:scale-110 ${s.className}`}
            >
              <s.icon className="h-5 w-5" />
            </a>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
