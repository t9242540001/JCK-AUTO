"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle } from "lucide-react";

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

const leadSchema = z.object({
  phone: z.string().refine(
    (val) => val.replace(/\D/g, "").length >= 11,
    "Введите телефон",
  ),
  name: z.string().optional(),
  comment: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadFormProps {
  subject?: string;
  ctaLabel?: string;
  compact?: boolean;
}

export default function LeadForm({
  subject,
  ctaLabel = "Оставить заявку",
  compact = false,
}: LeadFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: { phone: "" },
  });

  const inputCls = compact
    ? "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
    : "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary";

  const onSubmit = async (data: LeadFormData) => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: data.phone,
          name: data.name || undefined,
          message: data.comment || undefined,
          source: subject || "LeadForm",
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
      setStatus("success");
    } catch {
      setErrorMessage("Ошибка отправки. Попробуйте позже.");
      setStatus("error");
    }
  };

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
