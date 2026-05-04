"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { MESSENGER_CHANNELS } from "@/lib/messengerChannels";

export default function FloatingMessengers() {
  const [open, setOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [hidden, setHidden] = useState(false);
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

  // RULE: any element with data-fm-hide="true" attribute hides this FAB while
  // it is intersecting the viewport. Used to avoid touch conflict between the
  // floating button and inline lead-forms / sticky CTAs on narrow screens.
  // Opt-in via attribute only — do NOT hardcode component refs here. Adding
  // a new opt-in: just put data-fm-hide="true" on the element's root in JSX.
  // Static observer — does not detect elements added after mount; if a future
  // case requires that, switch to a MutationObserver wrapper.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const intersecting = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) intersecting.add(entry.target);
        else intersecting.delete(entry.target);
      }
      setHidden(intersecting.size > 0);
    });

    let cancelled = false;
    const handle = requestAnimationFrame(() => {
      if (cancelled) return;
      const targets = document.querySelectorAll<HTMLElement>("[data-fm-hide]");
      targets.forEach((el) => observer.observe(el));
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
      observer.disconnect();
    };
  }, []);

  // Collapse the messenger menu when the FAB hides — leaving an expanded
  // menu visible while the FAB itself fades is incoherent UX.
  useEffect(() => {
    if (hidden && open) setOpen(false);
  }, [hidden, open]);

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
    {/* RULE: opacity-0 + pointer-events-none MUST stay paired in the hidden
        state. Invisible-but-tappable FAB is a UX trap (taps land on
        air-elements above the form). Keep both in the same conditional. */}
    <div ref={containerRef} className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 max-sm:bottom-4 max-sm:right-4 transition-opacity duration-300 ${hidden ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      {/* Child buttons */}
      {MESSENGER_CHANNELS.map((ch, i) => (
        <a
          key={ch.name}
          href={ch.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ch.ariaLabel}
          className={`flex items-center gap-2 transition-all duration-200 ${
            open
              ? "translate-y-0 opacity-100 scale-100"
              : "pointer-events-none translate-y-4 opacity-0 scale-75"
          }`}
          style={{ transitionDelay: open ? `${(MESSENGER_CHANNELS.length - 1 - i) * 50}ms` : "0ms" }}
        >
          {/* Label — hidden on mobile */}
          <span
            className={`hidden rounded-lg bg-white px-2 py-1 text-sm font-medium text-gray-700 shadow transition-opacity duration-200 sm:block ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            {ch.name}
          </span>
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200 hover:scale-110 ${ch.bg}`}
          >
            {ch.glyph}
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
