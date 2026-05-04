/**
 * @file LeadFormTrigger.tsx
 * @description Universal trigger button that opens a modal with LeadForm.
 *              Use instead of inline LeadForm when space is limited or
 *              form should not be visible until user initiates contact.
 * @usage <LeadFormTrigger subject="Оптовые условия" triggerLabel="Узнать условия" />
 */

"use client";

import { useState, useEffect, type ReactNode } from "react";
import LeadForm from "@/components/LeadForm";

interface LeadFormTriggerProps {
  subject?: string;
  ctaLabel?: string;
  triggerLabel?: string;
  triggerIcon?: ReactNode;
  triggerVariant?: "primary" | "outline" | "on-primary" | "on-primary-soft";
  size?: "sm" | "md";
  modalTitle?: string;
  className?: string;
}

export default function LeadFormTrigger({
  subject,
  ctaLabel = "Оставить заявку",
  triggerLabel = "Оставить заявку",
  triggerIcon,
  triggerVariant = "outline",
  size = "md",
  modalTitle,
  className,
}: LeadFormTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // @rule triggerVariant MUST match the surrounding background:
  //   - "primary"    → button has bg-primary fill. Use on light/neutral backgrounds.
  //   - "outline"    → primary border + primary text on transparent. Use on light backgrounds ONLY.
  //                    Never use on bg-primary sections — text-primary on bg-primary is invisible.
  //   - "on-primary" → white fill + primary text. Use on bg-primary (or any coloured) section.
  //   - "on-primary-soft" → translucent white fill (bg-white/20) + white text on bg-primary (or any coloured) section. Use as SECONDARY affordance alongside a primary CTA — softer visual weight than "on-primary". Includes flex/items/justify/gap utilities so an icon may be rendered inside the button (e.g. <FileText/> + label).
  // @rule size axis is orthogonal to triggerVariant for the three base variants
  //   (primary / outline / on-primary):
  //   - "md" (default) → px-6 py-3, default text size — for standalone CTAs
  //     (sidebar, hero, full-width sections).
  //   - "sm" → px-4 py-2 text-sm — for compact contexts (cards, inline,
  //     small surfaces). Used by NoscutCard.
  //   "on-primary-soft" IGNORES size — its responsive class already encodes
  //   compact-on-mobile / standard-on-desktop. Passing size="sm" with
  //   on-primary-soft has no effect.
  //   YAGNI: do not add "lg" or other size values until a real consumer
  //   requires them. Adding a size pre-emptively expands surface area.
  // @rule When adding a new variant, extend the switch below AND the triggerVariant union type.
  //       The exhaustiveness check (_exhaustive: never) will break the build if a case is missed.
  // Size-dependent classes for primary / outline / on-primary variants.
  // `on-primary-soft` ignores size — its responsive sm:px-8/py-4/text-base built-in already.
  const sizeCls = size === "sm" ? "px-4 py-2 text-sm" : "px-6 py-3";
  let btnCls: string;
  switch (triggerVariant) {
    case "primary":
      btnCls = `cursor-pointer w-full rounded-xl bg-primary font-medium text-white transition-colors hover:bg-primary/90 ${sizeCls}`;
      break;
    case "outline":
      btnCls = `cursor-pointer w-full rounded-xl border border-primary font-medium text-primary transition-colors hover:bg-primary hover:text-white ${sizeCls}`;
      break;
    case "on-primary":
      btnCls = `cursor-pointer w-full rounded-xl bg-white font-medium text-primary transition-colors hover:bg-white/90 ${sizeCls}`;
      break;
    case "on-primary-soft":
      btnCls = "cursor-pointer flex w-full items-center justify-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/30 sm:px-8 sm:py-4 sm:text-base";
      break;
    default: {
      const _exhaustive: never = triggerVariant;
      throw new Error(`Unhandled triggerVariant: ${_exhaustive}`);
    }
  }

  const title = modalTitle || subject;

  return (
    <div className={className}>
      <button onClick={() => setIsOpen(true)} className={btnCls}>
        {triggerIcon ? (
          <span className="inline-flex items-center gap-2">
            {triggerIcon}
            {triggerLabel}
          </span>
        ) : (
          triggerLabel
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 px-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 cursor-pointer text-gray-400 hover:text-gray-600"
              aria-label="Закрыть"
            >
              ✕
            </button>
            {title && (
              <h2 className="mb-4 font-heading text-lg font-bold text-text">{title}</h2>
            )}
            <LeadForm
              subject={subject}
              ctaLabel={ctaLabel}
              successMode="auto-close"
              onSuccess={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
