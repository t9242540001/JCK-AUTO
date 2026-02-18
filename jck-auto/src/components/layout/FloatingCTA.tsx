"use client";

import { useState, useEffect } from "react";
import { Phone } from "lucide-react";
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
        <div className="fixed bottom-24 right-6 z-40 max-sm:bottom-20 max-sm:right-4">
          <motion.a
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            href={`tel:${CONTACTS.phoneRaw}`}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110 max-sm:h-12 max-sm:w-12"
            aria-label="Позвонить"
          >
            <Phone className="h-6 w-6 max-sm:h-5 max-sm:w-5" />
          </motion.a>
        </div>
      )}
    </AnimatePresence>
  );
}
