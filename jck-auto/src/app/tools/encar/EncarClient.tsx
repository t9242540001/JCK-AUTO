"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, Download, RefreshCw, Send, AlertTriangle, CheckCircle, XCircle, Zap, X } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

// ─── TYPES ────────────────────────────────────────────────────────────────

interface EncarResult {
  make: string; model: string; grade: string | null; year: number; mileage: number;
  priceKRW: number; displacement: number; fuelType: string; transmission: string;
  bodyType: string | null; color: string; vin: string | null; photoUrls: string[];
  region: string | null; dealerName: string | null; dealerPhone: string | null;
  accidentFree: boolean; inspectionSummary: string | null; description: string | null;
  sourceUrl: string; confidence: string;
  city: string | null; dealerFirm: string | null; descriptionRu: string | null;
  translationFailed?: boolean;
  enginePower?: number; enginePowerKw?: number;
  enginePowerSource?: 'ai' | 'user'; enginePowerConfidence?: 'high' | 'medium' | 'low';
}

interface BreakdownItem { label: string; value: number; details?: string }
interface CostBreakdown { totalRub: number; carPriceRub: number; breakdown: BreakdownItem[]; currencyRate: { code: string; rate: number; eurRate: number; date: string }; deliveryCity?: string }
interface ApiResponse { success: boolean; data: EncarResult; costBreakdown: CostBreakdown | null; meta: { remaining: number; source: string } }
interface ApiError { error: string; message: string; resetIn?: number }

type State = "idle" | "loading" | "result" | "error";

const KW_TO_HP = 1.35962;
function formatPrice(v: number): string { return v.toLocaleString("ru-RU") + " \u20BD"; }
function formatKRW(v: number): string { return v.toLocaleString("ru-RU") + " ₩"; }

function confidenceBadge(c: string): { label: string; cls: string } {
  if (c === "high") return { label: "высокая точность", cls: "bg-green-100 text-green-700" };
  if (c === "medium") return { label: "средняя точность", cls: "bg-amber-100 text-amber-700" };
  return { label: "низкая точность", cls: "bg-red-100 text-red-700" };
}

// ─── COMPONENT ────────────────────────────────────────────────────────────

export default function EncarClient() {
  const [state, setState] = useState<State>("idle");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<EncarResult | null>(null);
  const [cost, setCost] = useState<CostBreakdown | null>(null);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  // Manual power override
  const [showPowerOverride, setShowPowerOverride] = useState(false);
  const [manualPower, setManualPower] = useState("");
  const [manualUnit, setManualUnit] = useState<"hp" | "kw">("hp");
  const [descExpanded, setDescExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false); };
    window.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen]);

  const handleAnalyze = async (overridePower?: number) => {
    if (!url.trim()) return;
    setState("loading");
    setError(null);
    try {
      const body: Record<string, unknown> = { url: url.trim() };
      if (overridePower && overridePower > 0) body.enginePower = overridePower;
      const res = await fetch("/api/tools/encar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json as ApiError); setState("error"); return; }
      const data = json as ApiResponse;
      setResult(data.data);
      setCost(data.costBreakdown);
      setMeta(data.meta);
      setState("result");
      setShowPowerOverride(false);
    } catch { setError({ error: "network", message: "Ошибка сети. Проверьте подключение." }); setState("error"); }
  };

  const handleRecalcWithPower = () => {
    const val = Number(manualPower);
    if (!val) return;
    const hp = manualUnit === "kw" ? Math.round(val * KW_TO_HP) : val;
    handleAnalyze(hp);
  };

  const toggleManualUnit = () => {
    const val = Number(manualPower);
    if (val > 0) {
      setManualPower(manualUnit === "hp" ? String(Math.round(val / KW_TO_HP)) : String(Math.round(val * KW_TO_HP)));
    }
    setManualUnit(manualUnit === "hp" ? "kw" : "hp");
  };

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

  const reset = () => { setUrl(""); setResult(null); setCost(null); setMeta(null); setError(null); setShowPowerOverride(false); setManualPower(""); setState("idle"); };

  const inputClass = "mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
  const toggleBtn = (active: boolean) => `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-primary text-white" : "border border-border text-text-muted hover:bg-primary/10"}`;

  return (
    <div className="mx-auto mt-12 max-w-4xl px-4">
      {/* Форма */}
      {state === "idle" && (
        <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text">Ссылка на автомобиль</label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://fem.encar.com/cars/detail/..." className={inputClass} />
            </div>
            <button onClick={() => handleAnalyze()} disabled={!url.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3.5 font-medium text-white transition-colors hover:bg-secondary-hover disabled:opacity-50">
              <Search className="h-5 w-5" /> Анализировать
            </button>
          </div>
        </div>
      )}

      {/* Загрузка */}
      {state === "loading" && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 font-medium text-text">Загружаем данные с Encar...</p>
          <p className="mt-1 text-sm text-text-muted">Определяем мощность и рассчитываем стоимость</p>
        </div>
      )}

      {/* Результат */}
      {state === "result" && result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Главное фото */}
          {result.photoUrls[0] && (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="group relative mx-auto block aspect-[4/3] w-full max-w-md cursor-zoom-in overflow-hidden rounded-2xl bg-neutral-100 transition-shadow hover:shadow-lg"
              aria-label="Открыть фото на весь экран"
            >
              <img
                src={result.photoUrls[0]}
                alt={`${result.make} ${result.model}`}
                className="h-full w-full object-contain"
                loading="lazy"
              />
              <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                Нажмите, чтобы увеличить
              </span>
            </button>
          )}

          {/* Автомобиль */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div>
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
                  {/* Мощность */}
                  {result.enginePower && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Мощность</span>
                      <span className="flex items-center gap-1.5 font-medium text-text">
                        {result.enginePowerKw ? `${result.enginePowerKw} кВт (${result.enginePower} л.с.)` : `${result.enginePower} л.с.`}
                        {result.enginePowerSource === 'ai' && result.enginePowerConfidence && (
                          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${confidenceBadge(result.enginePowerConfidence).cls}`}>
                            <Zap className="h-2.5 w-2.5" /> AI
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* AI-мощность: возможность переопределить */}
                {result.enginePower && result.enginePowerSource === 'ai' && !showPowerOverride && (
                  <button onClick={() => setShowPowerOverride(true)} className="mt-2 text-xs text-primary hover:underline">Указать другую мощность</button>
                )}

                {/* Мощность не определена ИЛИ пользователь хочет переопределить */}
                {(!result.enginePower || showPowerOverride) && (
                  <div className="mt-3 rounded-xl bg-surface-alt p-3">
                    <p className="text-xs text-text-muted">{result.enginePower ? 'Укажите мощность вручную:' : 'Не удалось определить мощность. Укажите вручную для расчёта.'}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <input type="number" value={manualPower} onChange={(e) => setManualPower(e.target.value)} placeholder={manualUnit === "kw" ? "кВт" : "л.с."} className="w-24 rounded-lg border border-border bg-white px-3 py-2 text-sm" />
                      <div className="flex gap-1">
                        <button type="button" onClick={toggleManualUnit} className={toggleBtn(manualUnit === "hp")}>л.с.</button>
                        <button type="button" onClick={toggleManualUnit} className={toggleBtn(manualUnit === "kw")}>кВт</button>
                      </div>
                      <button onClick={handleRecalcWithPower} disabled={!manualPower} className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{cost ? 'Пересчитать' : 'Рассчитать'}</button>
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Состояние */}
          {result.inspectionSummary && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-heading text-lg font-semibold text-text">Состояние</h3>
              <div className="mt-3 flex items-center gap-2">
                {result.accidentFree ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                <span className={`font-medium ${result.accidentFree ? "text-green-700" : "text-red-700"}`}>{result.accidentFree ? "Без ДТП" : "Есть ДТП"}</span>
              </div>
              <p className="mt-2 text-sm text-text-muted">{result.inspectionSummary}</p>
            </div>
          )}

          {/* Продавец */}
          {(result.dealerName || result.dealerFirm || result.city) && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-heading text-lg font-semibold text-text">Продавец</h3>
              <div className="mt-3 grid gap-2">
                {result.dealerName && (
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-text-muted">Имя</span>
                    <span className="text-right font-medium text-text">{result.dealerName}</span>
                  </div>
                )}
                {result.dealerFirm && (
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-text-muted">Автосалон</span>
                    <span className="text-right font-medium text-text">{result.dealerFirm}</span>
                  </div>
                )}
                {result.city && (
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-text-muted">Город</span>
                    <span className="text-right font-medium text-text">{result.city}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Описание от продавца */}
          {(() => {
            const desc = result.descriptionRu ?? result.description;
            if (!desc) return null;
            const isOriginal = !result.descriptionRu && result.description;
            return (
              <div className="rounded-2xl border border-border bg-surface p-6">
                <h3 className="font-heading text-lg font-semibold text-text">Описание от продавца</h3>
                {isOriginal && (
                  <p className="mt-1 text-xs text-amber-700">Перевод временно недоступен — показан оригинал</p>
                )}
                <p className="mt-3 whitespace-pre-line text-sm text-text-muted">
                  {descExpanded || desc.length <= 200 ? desc : desc.slice(0, 200) + "..."}
                </p>
                {desc.length > 200 && (
                  <button onClick={() => setDescExpanded(!descExpanded)} className="mt-2 text-sm text-primary hover:underline">
                    {descExpanded ? "Свернуть" : "Показать полностью"}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Ссылка на Encar.com */}
          {result.sourceUrl && (
            <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-text-muted hover:text-primary transition-colors">
              Смотреть на Encar.com →
            </a>
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
                  Ориентировочный курс: 1 KRW ≈ {cost.currencyRate.rate.toFixed(4)} ₽
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Расчёт ориентировочный. Реальный курс уточняется при оформлении заявки — он зависит от дня сделки и канала перевода.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-muted">Укажите мощность двигателя для расчёта стоимости в РФ</p>
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

          {/* Lightbox */}
          {lightboxOpen && result.photoUrls[0] && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
              onClick={() => setLightboxOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Фото автомобиля"
            >
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                aria-label="Закрыть"
              >
                <X className="h-6 w-6" />
              </button>
              <img
                src={result.photoUrls[0]}
                alt={`${result.make} ${result.model}`}
                className="max-h-[90vh] max-w-[90vw] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* Ошибка */}
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
