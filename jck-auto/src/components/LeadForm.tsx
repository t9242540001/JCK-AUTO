"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

const leadSchema = z.object({
  phone: z.string().min(1, "Введите телефон"),
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
  });

  const inputCls = compact
    ? "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
    : "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary";

  const onSubmit = async (data: LeadFormData) => {
    setStatus("loading");
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
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
    } catch {
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
    <form onSubmit={handleSubmit(onSubmit)} className={`space-y-3 ${compact ? "text-sm" : ""}`}>
      <div>
        <input
          {...register("phone")}
          type="tel"
          placeholder="+7 (___) ___-__-__"
          className={inputCls}
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
        className={`flex w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-70 ${compact ? "px-4 py-2.5 text-sm" : "px-6 py-3.5"}`}
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

      {status === "error" && (
        <p className="text-center text-sm text-red-500">Ошибка отправки. Попробуйте позже.</p>
      )}

      {!compact && (
        <p className="text-center text-xs text-gray-400">
          <a
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            Вы представляете СТО? Условия для оптовых покупателей →
          </a>
        </p>
      )}
    </form>
  );
}
