"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { MessageCircle, Send } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

const messengers = [
  {
    name: "Max",
    href: CONTACTS.max,
    bg: "bg-[#0077FF]",
    icon: <Image src="/images/max-icon.svg" alt="Max" width={20} height={20} className="h-5 w-5" />,
  },
  {
    name: "WhatsApp",
    href: CONTACTS.whatsapp,
    bg: "bg-[#25D366]",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    name: "Telegram",
    href: CONTACTS.telegram,
    bg: "bg-[#2AABEE]",
    icon: <Send className="h-5 w-5" />,
  },
] as const;

export default function FloatingMessengers() {
  const [open, setOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const STORAGE_KEY = "fm_shake_shown";
    if (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem(STORAGE_KEY)) return;

    const timer = setTimeout(() => {
      setShaking(true);
      setTimeout(() => {
        setShaking(false);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(STORAGE_KEY, "1");
        }
      }, 600);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <>
    <style>{`
      @keyframes fm-shake {
        0%   { transform: rotate(0deg) scale(1); }
        15%  { transform: rotate(-12deg) scale(1.1); }
        30%  { transform: rotate(10deg) scale(1.1); }
        45%  { transform: rotate(-8deg) scale(1.05); }
        60%  { transform: rotate(6deg) scale(1.05); }
        75%  { transform: rotate(-4deg) scale(1.02); }
        100% { transform: rotate(0deg) scale(1); }
      }
    `}</style>
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 max-sm:bottom-4 max-sm:right-4">
      {/* Child buttons */}
      {messengers.map((m, i) => (
        <a
          key={m.name}
          href={m.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={m.name}
          className={`flex items-center gap-2 transition-all duration-200 ${
            open
              ? "translate-y-0 opacity-100 scale-100"
              : "pointer-events-none translate-y-4 opacity-0 scale-75"
          }`}
          style={{ transitionDelay: open ? `${(messengers.length - 1 - i) * 50}ms` : "0ms" }}
        >
          {/* Label — hidden on mobile */}
          <span
            className={`hidden rounded-lg bg-white px-2 py-1 text-sm font-medium text-gray-700 shadow transition-opacity duration-200 sm:block ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            {m.name}
          </span>
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200 hover:scale-110 ${m.bg}`}
          >
            {m.icon}
          </span>
        </a>
      ))}

      {/* Main toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Закрыть мессенджеры" : "Написать нам"}
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform duration-300 hover:scale-110 max-sm:h-12 max-sm:w-12 ${
          open ? "rotate-[135deg]" : "rotate-0"
        }`}
        style={shaking ? {
          animation: "fm-shake 0.6s ease-in-out",
        } : undefined}
      >
        <MessageCircle className="h-6 w-6 max-sm:h-5 max-sm:w-5" />
      </button>
    </div>
    </>
  );
}
