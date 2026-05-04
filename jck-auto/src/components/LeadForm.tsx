"use client";

/**
 * @file LeadForm.tsx
 * @description Canonical inline lead-capture form. Single engine for all
 *   site lead-form surfaces (homepage CTAs, calculator, encar/auction-sheet,
 *   noscut card, catalog detail). Used directly inline OR wrapped in
 *   LeadFormTrigger for modal presentation. Validates phone (and optionally
 *   name), formats phone input live, persists to localStorage before fetch
 *   (SALES-PERSIST-1), submits to /api/lead, supports both permanent inline
 *   success and timed auto-close success modes.
 *
 * @rule source vs subject contract:
 *   - `source` is a stable channel label suitable for grep'ing
 *     site-leads.log ("calculator", "noscut-card", "catalog-car-detail").
 *     New callers MUST pass it explicitly.
 *   - `subject` is the human-readable detail line shown to the manager
 *     in Telegram ("Расчёт: Toyota Camry 2020 — ≈ 3 200 000 ₽").
 *   - Legacy fallback `source ?? subject ?? "LeadForm"` exists only for
 *     pre-UNIFY-1 callers. See ADR [2026-05-04] UNIFY-1.
 *
 * @rule data-fm-hide="true" on the form root keeps FloatingMessengers
 *   FAB hidden while the form is in viewport (handled by FAB itself
 *   via IntersectionObserver). DO NOT remove the attribute.
 */

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle } from "lucide-react";
import { saveBeforeSend, markConfirmed } from "@/lib/leadPersistence";

// ─── HELPERS ──────────────────────────────────────────────────────────

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  let result = "+7";
  if (digits.length > 1) result += " (" + digits.slice(1, 4);
  if (digits.length >= 4) result += ") " + digits.slice(4, 7);
  if (digits.length >= 7) result += "-" + digits.slice(7, 9);
  if (digits.length >= 9) result += "-" + digits.slice(9, 11);
  return result;
}

// ─── TYPES ────────────────────────────────────────────────────────────

const leadSchemaPhoneOnly = z.object({
  phone: z.string().refine(
    (val) => val.replace(/\D/g, "").length >= 11,
    "Введите телефон",
  ),
  name: z.string().optional(),
  comment: z.string().optional(),
});

const leadSchemaWithName = z.object({
  phone: z.string().refine(
    (val) => val.replace(/\D/g, "").length >= 11,
    "Введите телефон",
  ),
  name: z.string().min(1, "Введите имя"),
  comment: z.string().optional(),
});

// Wider variant — name typed as string. RHF permissive-type pattern:
// runtime validation is selected per-render via useMemo on `requireName`,
// but the static type covers both schemas.
type LeadFormData = z.infer<typeof leadSchemaWithName>;

interface LeadFormProps {
  /** Free-text human-readable subject shown to the manager in Telegram */
  subject?: string;
  /** Submit button label */
  ctaLabel?: string;
  /** Tighter padding for nested cards / sidebar slots */
  compact?: boolean;
  /**
   * Stable channel label for site-leads.log analytics ("calculator",
   * "noscut-card", "catalog-car-detail"). Falls back to `subject` then
   * "LeadForm" if absent. See ADR [2026-05-04] UNIFY-1.
   */
  source?: string;
  /** When true, name field is required (1+ char). Default false. */
  requireName?: boolean;
  /**
   * "inline" (default) — success state stays visible permanently.
   * "auto-close" — success UI shows for `autoCloseMs` then `onSuccess`
   * fires. Used by LeadFormTrigger to close the modal after submit.
   */
  successMode?: "inline" | "auto-close";
  /** Delay before onSuccess fires when successMode="auto-close". Default 3000ms. */
  autoCloseMs?: number;
  /** Called after successful submit + autoCloseMs delay (auto-close mode only). */
  onSuccess?: () => void;
}

// ─── COMPONENT ────────────────────────────────────────────────────────

export default function LeadForm({
  subject,
  ctaLabel = "Оставить заявку",
  compact = false,
  source,
  requireName = false,
  successMode = "inline",
  autoCloseMs = 3000,
  onSuccess,
}: LeadFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const schema = useMemo(
    () => (requireName ? leadSchemaWithName : leadSchemaPhoneOnly),
    [requireName],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "" },
  });

  const inputCls = compact
    ? "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
    : "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary";

  const onSubmit = async (data: LeadFormData) => {
    setStatus("loading");
    setErrorMessage(null);
    const persistedId = saveBeforeSend({
      phone: data.phone,
      name: data.name || undefined,
      message: data.comment || undefined,
      source: source ?? subject ?? "LeadForm",
      subject: subject || undefined,
    });
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: data.phone,
          name: data.name || undefined,
          message: data.comment || undefined,
          source: source ?? subject ?? "LeadForm",
          subject: subject || undefined,
        }),
      });
      if (!res.ok) {
        try {
          const body = await res.json();
          setErrorMessage(body.error || "Ошибка отправки. Попробуйте позже.");
        } catch {
          setErrorMessage("Ошибка отправки. Попробуйте позже.");
        }
        setStatus("error");
        return;
      }
      markConfirmed(persistedId);
      setStatus("success");
    } catch {
      setErrorMessage("Ошибка отправки. Попробуйте позже.");
      setStatus("error");
    }
  };

  // Auto-close: when in auto-close mode and submit succeeded, fire
  // onSuccess after autoCloseMs. Cleans up if status changes or unmounts.
  useEffect(() => {
    if (status !== "success" || successMode !== "auto-close") return;
    const t = setTimeout(() => {
      onSuccess?.();
    }, autoCloseMs);
    return () => clearTimeout(t);
  }, [status, successMode, autoCloseMs, onSuccess]);

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium text-gray-900">Заявка принята!</p>
        <p className="text-sm text-gray-500">Менеджер свяжется в ближайшее время</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} data-fm-hide="true" className={`space-y-3 ${compact ? "text-sm" : ""}`}>
      <div>
        <input
          {...register("phone")}
          type="tel"
          placeholder="+7 (___) ___-__-__"
          className={inputCls}
          onChange={(e) => {
            const formatted = formatPhone(e.target.value);
            e.target.value = formatted;
            register("phone").onChange(e);
          }}
        />
        {errors.phone && (
          <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <input
          {...register("name")}
          type="text"
          placeholder="Ваше имя (необязательно)"
          className={inputCls}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div>
        <textarea
          {...register("comment")}
          rows={compact ? 2 : 3}
          placeholder="Комментарий (необязательно)"
          className={`resize-none ${inputCls}`}
        />
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className={`cursor-pointer flex w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-70 ${compact ? "px-4 py-2.5 text-sm" : "px-6 py-3.5"}`}
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Отправка…
          </>
        ) : (
          ctaLabel
        )}
      </button>

      {status === "error" && errorMessage && (
        <p className="text-center text-sm text-red-500">{errorMessage}</p>
      )}

    </form>
  );
}
