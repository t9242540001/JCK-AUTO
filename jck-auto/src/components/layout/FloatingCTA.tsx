"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send } from "lucide-react";
import { CONTACTS } from "@/lib/constants";
import { getWhatsAppLink } from "@/lib/utils";

export default function FloatingCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 500);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const whatsappLink = getWhatsAppLink(
    CONTACTS.team[0].whatsapp,
    "Здравствуйте! Хочу узнать о привозе автомобиля."
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-6 right-6 z-40 flex flex-col gap-3"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.2 }}
        >
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Написать в WhatsApp"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl"
          >
            <MessageCircle size={24} />
          </a>
          <a
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Написать в Telegram"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2AABEE] text-white shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl"
          >
            <Send size={24} />
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
