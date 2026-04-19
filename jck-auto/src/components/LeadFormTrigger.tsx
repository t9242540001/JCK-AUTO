/**
 * @file LeadFormTrigger.tsx
 * @description Universal trigger button that opens a modal with LeadForm.
 *              Use instead of inline LeadForm when space is limited or
 *              form should not be visible until user initiates contact.
 * @usage <LeadFormTrigger subject="Оптовые условия" triggerLabel="Узнать условия" />
 */

"use client";

import { useState, useEffect } from "react";
import LeadForm from "@/components/LeadForm";

interface LeadFormTriggerProps {
  subject?: string;
  ctaLabel?: string;
  triggerLabel?: string;
  triggerVariant?: "primary" | "outline" | "on-primary";
  modalTitle?: string;
  className?: string;
}

export default function LeadFormTrigger({
  subject,
  ctaLabel = "Оставить заявку",
  triggerLabel = "Оставить заявку",
  triggerVariant = "outline",
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
  // @rule When adding a new variant, extend the switch below AND the triggerVariant union type.
  //       The exhaustiveness check (_exhaustive: never) will break the build if a case is missed.
  let btnCls: string;
  switch (triggerVariant) {
    case "primary":
      btnCls = "cursor-pointer w-full rounded-xl bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary/90";
      break;
    case "outline":
      btnCls = "cursor-pointer w-full rounded-xl border border-primary px-6 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white";
      break;
    case "on-primary":
      btnCls = "cursor-pointer w-full rounded-xl bg-white px-6 py-3 font-medium text-primary transition-colors hover:bg-white/90";
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
        {triggerLabel}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
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
            <LeadForm subject={subject} ctaLabel={ctaLabel} />
          </div>
        </div>
      )}
    </div>
  );
}
