"use client";

import { useState, useEffect } from "react";
import { Phone, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CONTACTS } from "@/lib/constants";

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
        <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-3 sm:bottom-6 sm:right-6">
          <motion.a
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            href={`tel:${CONTACTS.phoneRaw}`}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110"
            aria-label="Позвонить"
          >
            <Phone className="h-6 w-6" />
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
