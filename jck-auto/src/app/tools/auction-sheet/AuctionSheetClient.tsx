"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Loader2, X, Download, RefreshCw, Send, AlertTriangle } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

// ─── TYPES ────────────────────────────────────────────────────────────────

interface BodyDamage {
  location: string;
  code: string;
  description: string;
  severity: "minor" | "moderate" | "major";
}

interface AuctionResult {
  auctionName: string | null;
  lotNumber: string | null;
  overallGrade: string | null;
  interiorGrade: string | null;
  make: string | null;
  model: string | null;
  year: string | null;
  engineVolume: string | null;
  engineType: string | null;
  transmission: string | null;
  mileage: string | null;
  mileageWarning: boolean;
  color: string | null;
  ownership: string | null;
  bodyDamages: BodyDamage[];
  equipment: string[];
  expertComments: string | null;
  unrecognized: string[];
  confidence: "high" | "medium" | "low";
  recommendation: string | null;
  warnings: string[];
}

interface ApiResponse {
  success: boolean;
  data: AuctionResult;
  meta: { model: string; tokens: number; remaining: number };
}

interface ApiError {
  error: string;
  message: string;
  resetIn?: number;
}

type State = "idle" | "preview" | "loading" | "result" | "error";

// ─── HELPERS ──────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function gradeColor(grade: string | null): string {
  if (!grade) return "text-text-muted";
  const n = parseFloat(grade);
  if (!isNaN(n)) {
    if (n >= 4) return "text-green-600";
    if (n >= 3) return "text-amber-600";
    return "text-red-600";
  }
  if (grade === "S") return "text-green-600";
  if (grade === "R" || grade === "A" || grade === "***") return "text-red-600";
  return "text-text";
}

function severityColor(s: string): string {
  if (s === "minor") return "bg-gray-100 text-gray-600";
  if (s === "moderate") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function confidenceBadge(c: string): { label: string; cls: string } {
  if (c === "high") return { label: "Высокая точность", cls: "bg-green-100 text-green-700" };
  if (c === "medium") return { label: "Средняя точность", cls: "bg-amber-100 text-amber-700" };
  return { label: "Низкая точность", cls: "bg-red-100 text-red-700" };
}

// ─── COMPONENT ────────────────────────────────────────────────────────────

export default function AuctionSheetClient() {
  const [state, setState] = useState<State>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AuctionResult | null>(null);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    if (f.size > 10 * 1024 * 1024) { setError({ error: "file_too_large", message: "Файл слишком большой (максимум 10 МБ)" }); setState("error"); return; }
    if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(f.type)) { setError({ error: "invalid_type", message: "Поддерживаемые форматы: JPG, PNG, WebP, HEIC" }); setState("error"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setState("preview");
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }, [handleFile]);

  const clearFile = () => { setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); setState("idle"); setResult(null); setMeta(null); setError(null); };

  const handleAnalyze = async () => {
    if (!file) return;
    setState("loading");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/tools/auction-sheet", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json as ApiError); setState("error"); return; }
      const data = json as ApiResponse;
      setResult(data.data);
      setMeta(data.meta);
      setState("result");
    } catch { setError({ error: "network", message: "Ошибка сети. Проверьте подключение." }); setState("error"); }
  };

  const handleDownloadPdf = async () => {
    if (!result) return;
    try {
      const res = await fetch("/api/tools/auction-sheet/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "auction-sheet-report.pdf"; a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  };

  return (
    <div className="mx-auto mt-12 max-w-4xl px-4">
      {/* Upload zone */}
      {(state === "idle" || state === "preview") && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => state === "idle" && inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          {state === "idle" && (
            <>
              <Upload className="mx-auto h-10 w-10 text-text-muted" />
              <p className="mt-3 font-medium text-text">Перетащите фото аукционного листа или нажмите для выбора</p>
              <p className="mt-1 text-xs text-text-muted">JPG, PNG, WebP, HEIC — до 10 МБ</p>
            </>
          )}

          {state === "preview" && file && preview && (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:text-left">
              <img src={preview} alt="Превью" className="h-32 w-auto rounded-xl object-contain" />
              <div className="flex-1">
                <p className="font-medium text-text">{file.name}</p>
                <p className="text-sm text-text-muted">{formatSize(file.size)}</p>
                <button onClick={(e) => { e.stopPropagation(); clearFile(); }} className="mt-2 flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
                  <X className="h-3 w-3" /> Убрать
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {state === "preview" && (
        <button onClick={handleAnalyze} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3.5 font-medium text-white transition-colors hover:bg-secondary-hover">
          Расшифровать
        </button>
      )}

      {/* Loading */}
      {state === "loading" && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          {preview && <img src={preview} alt="Анализируемый лист" className="mx-auto mb-6 h-24 rounded-xl object-contain opacity-60" />}
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 font-medium text-text">Анализируем аукционный лист...</p>
          <p className="mt-1 text-sm text-text-muted">Обычно это занимает 10–15 секунд</p>
        </div>
      )}

      {/* Result */}
      {state === "result" && result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Auction & Grade */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="font-heading text-lg font-semibold text-text">Аукцион и оценка</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {result.auctionName && <div><span className="text-xs text-text-muted">Аукцион</span><p className="font-medium text-text">{result.auctionName}</p></div>}
              {result.lotNumber && <div><span className="text-xs text-text-muted">Лот</span><p className="font-medium text-text">{result.lotNumber}</p></div>}
              {result.overallGrade && <div><span className="text-xs text-text-muted">Общая оценка</span><p className={`text-2xl font-bold ${gradeColor(result.overallGrade)}`}>{result.overallGrade}</p></div>}
              {result.interiorGrade && <div><span className="text-xs text-text-muted">Салон</span><p className="text-lg font-semibold text-text">{result.interiorGrade}</p></div>}
            </div>
            {result.recommendation && <div className="mt-4 rounded-xl bg-primary/5 p-4 text-sm text-text">{result.recommendation}</div>}
          </div>

          {/* Car details */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="font-heading text-lg font-semibold text-text">Автомобиль</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {[
                ["Марка", result.make], ["Модель", result.model], ["Год", result.year],
                ["Двигатель", result.engineVolume ? `${result.engineVolume} см³` : null], ["Тип", result.engineType], ["КПП", result.transmission],
                ["Цвет", result.color], ["Владение", result.ownership],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string}><span className="text-xs text-text-muted">{label}</span><p className="font-medium text-text">{value}</p></div>
              ))}
              {result.mileage && (
                <div>
                  <span className="text-xs text-text-muted">Пробег</span>
                  <p className="flex items-center gap-1 font-medium text-text">
                    {result.mileage} км
                    {result.mileageWarning && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Body damages */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="font-heading text-lg font-semibold text-text">Состояние кузова</h3>
            {result.bodyDamages.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-text-muted"><th className="pb-2 pr-3">Расположение</th><th className="pb-2 pr-3">Код</th><th className="pb-2 pr-3">Описание</th><th className="pb-2">Серьёзность</th></tr></thead>
                  <tbody>
                    {result.bodyDamages.map((d, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-3 text-text">{d.location}</td>
                        <td className="py-2 pr-3 font-mono text-text">{d.code}</td>
                        <td className="py-2 pr-3 text-text-muted">{d.description}</td>
                        <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor(d.severity)}`}>{d.severity === "minor" ? "незначит." : d.severity === "moderate" ? "средний" : "серьёзный"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-4 text-sm text-text-muted">Дефекты не обнаружены</p>}
          </div>

          {/* Equipment */}
          {result.equipment.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-heading text-lg font-semibold text-text">Комплектация</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {result.equipment.map((e) => <span key={e} className="rounded-full bg-surface-alt px-3 py-1 text-sm text-text">{e}</span>)}
              </div>
            </div>
          )}

          {/* Expert comments + warnings */}
          {(result.expertComments || result.warnings.length > 0) && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-heading text-lg font-semibold text-text">Комментарии</h3>
              {result.expertComments && <p className="mt-3 text-sm text-text-muted">{result.expertComments}</p>}
              {result.warnings.map((w, i) => (
                <div key={i} className="mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">{w}</div>
              ))}
            </div>
          )}

          {/* Unrecognized */}
          {result.unrecognized.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-heading text-lg font-semibold text-text">Не распознано</h3>
              <p className="mt-2 text-xs text-text-muted">Эти данные не удалось распознать автоматически</p>
              <ul className="mt-3 list-inside list-disc text-sm text-text-muted">{result.unrecognized.map((u, i) => <li key={i}>{u}</li>)}</ul>
            </div>
          )}

          {/* Footer: confidence + actions */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${confidenceBadge(result.confidence).cls}`}>
              {confidenceBadge(result.confidence).label}
            </span>
            {meta && <span className="text-xs text-text-muted">Осталось расшифровок: {meta.remaining}</span>}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={handleDownloadPdf} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3 font-medium text-white transition-colors hover:bg-secondary-hover">
              <Download className="h-4 w-4" /> Скачать PDF-отчёт
            </button>
            <button onClick={clearFile} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white">
              <RefreshCw className="h-4 w-4" /> Расшифровать ещё
            </button>
          </div>

          <div className="rounded-2xl bg-primary/5 p-6 text-center">
            <p className="font-heading font-semibold text-text">Хотите купить этот автомобиль?</p>
            <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#2AABEE] px-6 py-3 font-medium text-white transition-colors hover:bg-[#229ED9]">
              <Send className="h-4 w-4" /> Оставить заявку
            </a>
          </div>
        </motion.div>
      )}

      {/* Error */}
      {state === "error" && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-800">{error.message}</p>
          {error.error === "rate_limit" ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a href="https://t.me/jckauto_help_bot" target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#2AABEE] px-6 py-3 font-medium text-white">Бот с безлимитом</a>
              <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary">Написать менеджеру</a>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button onClick={() => { setState("preview"); setError(null); }} className="rounded-xl bg-secondary px-6 py-3 font-medium text-white">Попробовать ещё</button>
              <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary">Написать менеджеру</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
