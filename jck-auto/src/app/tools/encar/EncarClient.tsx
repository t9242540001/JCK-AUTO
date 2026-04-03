"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, Download, RefreshCw, Send, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Image from "next/image";
import { CONTACTS } from "@/lib/constants";

// ─── TYPES ────────────────────────────────────────────────────────────────

interface EncarResult {
  make: string; model: string; grade: string | null; year: number; mileage: number;
  priceKRW: number; displacement: number; fuelType: string; transmission: string;
  bodyType: string | null; color: string; vin: string | null; photoUrls: string[];
  region: string | null; dealerName: string | null; dealerPhone: string | null;
  accidentFree: boolean; inspectionSummary: string | null; description: string | null;
  sourceUrl: string; confidence: string;
}

interface BreakdownItem { label: string; value: number; details?: string }
interface CostBreakdown { totalRub: number; carPriceRub: number; breakdown: BreakdownItem[]; currencyRate: { code: string; rate: number; eurRate: number; date: string }; deliveryCity?: string }
interface ApiResponse { success: boolean; data: EncarResult; costBreakdown: CostBreakdown | null; meta: { remaining: number; source: string } }
interface ApiError { error: string; message: string; resetIn?: number }

type State = "idle" | "loading" | "result" | "error";

function formatPrice(v: number): string { return v.toLocaleString("ru-RU") + " \u20BD"; }
function formatKRW(v: number): string { return v.toLocaleString("ru-RU") + " ₩"; }

// ─── COMPONENT ────────────────────────────────────────────────────────────

export default function EncarClient() {
  const [state, setState] = useState<State>("idle");
  const [url, setUrl] = useState("");
  const [power, setPower] = useState("");
  const [result, setResult] = useState<EncarResult | null>(null);
  const [cost, setCost] = useState<CostBreakdown | null>(null);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  // Основной запрос
  const handleAnalyze = async (overridePower?: string) => {
    if (!url.trim()) return;
    setState("loading");
    setError(null);
    try {
      const body: Record<string, unknown> = { url: url.trim() };
      const hp = Number(overridePower ?? power);
      if (hp > 0) body.enginePower = hp;
      const res = await fetch("/api/tools/encar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json as ApiError); setState("error"); return; }
      const data = json as ApiResponse;
      setResult(data.data);
      setCost(data.costBreakdown);
      setMeta(data.meta);
      setState("result");
    } catch { setError({ error: "network", message: "Ошибка сети. Проверьте подключение." }); setState("error"); }
  };

  // Допрасчёт мощности
  const [extraPower, setExtraPower] = useState("");
  const handleCalcCost = () => { if (extraPower) handleAnalyze(extraPower); };

  const handleDownloadPdf = async () => {
    if (!result) return;
    try {
      const res = await fetch("/api/tools/encar/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: result, costBreakdown: cost }) });
      if (!res.ok) return;
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = u; a.download = `encar-${result.make}-${result.model}.pdf`; a.click();
      URL.revokeObjectURL(u);
    } catch { /* silent */ }
  };

  const reset = () => { setUrl(""); setPower(""); setResult(null); setCost(null); setMeta(null); setError(null); setExtraPower(""); setState("idle"); };

  const inputClass = "mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="mx-auto mt-12 max-w-4xl px-4">
      {/* ── Форма ввода ── */}
      {state === "idle" && (
        <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text">Ссылка на автомобиль</label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://fem.encar.com/cars/detail/..." className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-text">Мощность двигателя, л.с.</label>
              <input type="number" value={power} onChange={(e) => setPower(e.target.value)} placeholder="например, 177" className={inputClass} />
              <p className="mt-1 text-xs text-text-muted">Необязательно. Если указать — рассчитаем полную стоимость в РФ</p>
            </div>
            <button onClick={() => handleAnalyze()} disabled={!url.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3.5 font-medium text-white transition-colors hover:bg-secondary-hover disabled:opacity-50">
              <Search className="h-5 w-5" /> Анализировать
            </button>
          </div>
        </div>
      )}

      {/* ── Загрузка ── */}
      {state === "loading" && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 font-medium text-text">Загружаем данные с Encar...</p>
          <p className="mt-1 text-sm text-text-muted">Обычно 2–3 секунды</p>
        </div>
      )}

      {/* ── Результат ── */}
      {state === "result" && result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Автомобиль */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex flex-col gap-6 sm:flex-row">
              {result.photoUrls[0] && (
                <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-xl sm:w-64">
                  <Image src={result.photoUrls[0]} alt={`${result.make} ${result.model}`} fill className="object-cover" unoptimized />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-heading text-xl font-bold text-text">{result.make} {result.model}</h3>
                {result.grade && <p className="text-sm text-text-muted">{result.grade}</p>}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[["Год", result.year], ["Пробег", `${result.mileage.toLocaleString("ru-RU")} км`],
                    ["Двигатель", result.displacement ? `${result.displacement} см³` : null], ["Топливо", result.fuelType],
                    ["КПП", result.transmission], ["Кузов", result.bodyType],
                    ["Цвет", result.color], ["VIN", result.vin],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-text-muted">{label}</span>
                      <span className="font-medium text-text">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Состояние */}
          {result.inspectionSummary && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-heading text-lg font-semibold text-text">Состояние</h3>
              <div className="mt-3 flex items-center gap-2">
                {result.accidentFree ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                <span className={`font-medium ${result.accidentFree ? "text-green-700" : "text-red-700"}`}>
                  {result.accidentFree ? "Без ДТП" : "Есть ДТП"}
                </span>
              </div>
              <p className="mt-2 text-sm text-text-muted">{result.inspectionSummary}</p>
            </div>
          )}

          {/* Цена и стоимость */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="font-heading text-lg font-semibold text-text">Цена и стоимость в РФ</h3>
            <p className="mt-3 text-2xl font-bold text-primary">{formatKRW(result.priceKRW)}</p>
            <p className="text-xs text-text-muted">Цена на Encar.com</p>

            {cost ? (
              <div className="mt-6">
                <div className="space-y-3">
                  {cost.breakdown.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-muted">{item.label}</p>
                        {item.details && <p className="mt-0.5 text-xs italic text-text-muted/70">{item.details}</p>}
                      </div>
                      <p className="shrink-0 text-sm font-medium text-text">{formatPrice(item.value)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-4 flex items-center justify-between">
                  <p className="font-heading font-semibold text-text">Итого «под ключ»</p>
                  <p className="text-xl font-bold text-primary">{formatPrice(cost.totalRub)}</p>
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  {cost.deliveryCity && `Доставка до ${cost.deliveryCity} | `}
                  Курс ЦБ на {cost.currencyRate.date}: 1 KRW = {cost.currencyRate.rate.toFixed(4)} ₽
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-xl bg-surface-alt p-4">
                <p className="text-sm text-text-muted">Укажите мощность двигателя для расчёта стоимости в РФ</p>
                <div className="mt-3 flex gap-3">
                  <input type="number" value={extraPower} onChange={(e) => setExtraPower(e.target.value)} placeholder="л.с." className="w-28 rounded-xl border border-border bg-white px-3 py-2 text-sm" />
                  <button onClick={handleCalcCost} disabled={!extraPower} className="rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Рассчитать</button>
                </div>
              </div>
            )}
          </div>

          {/* Действия */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={handleDownloadPdf} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3 font-medium text-white transition-colors hover:bg-secondary-hover">
              <Download className="h-4 w-4" /> Скачать PDF
            </button>
            <button onClick={reset} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white">
              <RefreshCw className="h-4 w-4" /> Анализировать другой
            </button>
          </div>

          <div className="rounded-2xl bg-primary/5 p-6 text-center">
            <p className="font-heading font-semibold text-text">Хотите привезти это авто из Кореи?</p>
            <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#2AABEE] px-6 py-3 font-medium text-white transition-colors hover:bg-[#229ED9]">
              <Send className="h-4 w-4" /> Оставить заявку
            </a>
          </div>

          {meta && <p className="text-center text-xs text-text-muted">Осталось анализов: {meta.remaining}</p>}
        </motion.div>
      )}

      {/* ── Ошибка ── */}
      {state === "error" && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 font-medium text-red-800">{error.message}</p>
          {error.error === "rate_limit" ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a href="https://t.me/jckauto_help_bot" target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#2AABEE] px-6 py-3 font-medium text-white">Бот с безлимитом</a>
              <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary">Написать менеджеру</a>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button onClick={reset} className="rounded-xl bg-secondary px-6 py-3 font-medium text-white">Попробовать ещё</button>
              <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary">Написать менеджеру</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
