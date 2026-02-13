"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CONTACTS } from "@/lib/constants";
import { getWhatsAppLink } from "@/lib/utils";

export default function FloatingCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 500);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
          <motion.a
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            href={getWhatsAppLink(CONTACTS.team[0].whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110"
            aria-label="Написать в WhatsApp"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.a>
          <motion.a
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2AABEE] text-white shadow-lg transition-transform hover:scale-110"
            aria-label="Написать в Telegram"
          >
            <Send className="h-6 w-6" />
          </motion.a>
        </div>
      )}
    </AnimatePresence>
  );
}
