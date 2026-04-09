"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle } from "lucide-react";
import InputMask from "react-input-mask";

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

  const {
    register,
    handleSubmit,
    control,
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
        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <InputMask
              mask="+7 (999) 999-99-99"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            >
              {/* @ts-expect-error react-input-mask children render prop */}
              {(inputProps: React.InputHTMLAttributes<HTMLInputElement>) => (
                <input
                  {...inputProps}
                  ref={field.ref}
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  className={inputCls}
                />
              )}
            </InputMask>
          )}
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

    </form>
  );
}
