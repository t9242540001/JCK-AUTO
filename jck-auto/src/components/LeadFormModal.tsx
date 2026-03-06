"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle } from "lucide-react";

const leadSchema = z.object({
  name: z.string().min(1, "Введите имя"),
  phone: z.string().min(1, "Введите телефон"),
  comment: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  carName: string;
}

export default function LeadFormModal({ isOpen, onClose, carName }: LeadFormModalProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
  });

  const onSubmit = async (data: LeadFormData) => {
    setStatus("loading");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          message: data.comment || `Интересует ${carName}`,
          source: carName,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
      setTimeout(() => {
        onClose();
        setStatus("idle");
        reset();
      }, 2000);
    } catch {
      setStatus("error");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md transform rounded-2xl bg-white p-6 transition-all duration-200 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium text-gray-900">Заявка отправлена! ✓</p>
            <p className="text-sm text-gray-500">Менеджер свяжется с вами в течение 15 минут</p>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-gray-900">Заявка на {carName}</h3>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
              <div>
                <input
                  {...register("name")}
                  type="text"
                  placeholder="Ваше имя"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div>
                <input
                  {...register("phone")}
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <textarea
                  {...register("comment")}
                  rows={2}
                  placeholder="Комментарий (необязательно)"
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-70"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Отправка…
                  </>
                ) : (
                  "Отправить заявку"
                )}
              </button>

              {status === "error" && (
                <p className="text-center text-sm text-red-500">Ошибка, попробуйте позже</p>
              )}

              <p className="text-center text-xs text-gray-400">
                Менеджер свяжется с вами в течение 15 минут
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
