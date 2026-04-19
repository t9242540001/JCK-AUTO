"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, Loader2, X, Download, RefreshCw, Send, AlertTriangle } from "lucide-react";
import { CONTACTS } from "@/lib/constants";
import TelegramAuthBlock from "@/components/TelegramAuthBlock";
import UploadZone from "./UploadZone";
import ProcessingViews from "./ProcessingViews";

// @rule This component is async-first. POST /api/tools/auction-sheet returns
//       202 Accepted with jobId; the client polls GET /job/[jobId] every 2s.
//       Do NOT revert to synchronous fetch — backend no longer supports it.
// @rule jobId is persisted in localStorage so users surviving screen-off /
//       tab-switch can resume. On mount, check localStorage first.
//       On "done", "failed", or explicit reset — remove from localStorage.
// @rule Polling uses AbortController + setTimeout (NOT setInterval). Every
//       unmount / state change / cleanup must abort pending fetch AND
//       clear pending timeout — otherwise requests leak.
// @rule This file is ~450 lines after this prompt. It exceeds the 200-line
//       universal file-size guideline. A refactor split (state machine +
//       subcomponents) is planned but NOT part of this prompt — do not
//       attempt mid-work.

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

interface AcceptedResponse {
  jobId: string;
  statusUrl: string;
  position: number;
  etaSec: number;
}

interface JobStatusResponse {
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  position: number;
  etaSec: number;
  enqueuedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  result?: {
    data: AuctionResult;
    meta: { model: string; tokens: number; remaining: number };
  };
  error?: string;
}

interface QueueFullError {
  error: "queue_full";
  message: string;
  queueSize: number;
  maxSize: number;
  retryInSeconds: number;
}

type State =
  | "idle"
  | "preview"
  | "submitting"
  | "queued"
  | "processing"
  | "result"
  | "error";

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;
const ACTIVE_JOB_STORAGE_KEY = "jckauto.auction_sheet.active_job";
const PROCESSING_STAGE_DURATIONS_MS = [5000, 15000, Infinity];

// ─── HELPERS ──────────────────────────────────────────────────────────────

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
  const [dragOver, setDragOver] = useState(false);
  const [usedCount, setUsedCount] = useState<number>(0);
  const [isLimitReached, setIsLimitReached] = useState<boolean>(false);

  // Async-flow state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobPosition, setJobPosition] = useState<number>(0);
  const [jobEtaSec, setJobEtaSec] = useState<number>(0);
  const [processingStage, setProcessingStage] = useState<number>(0);

  // Refs for polling lifecycle
  const pollAbortRef = useRef<AbortController | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);
  const processingStartRef = useRef<number | null>(null);

  const pollJob = useCallback(async (jobId: string, consecutiveFailures = 0) => {
    const controller = new AbortController();
    pollAbortRef.current = controller;

    try {
      const res = await fetch(`/api/tools/auction-sheet/job/${jobId}`, {
        signal: controller.signal,
      });

      if (res.status === 404) {
        localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
        setError({ error: "job_not_found", message: "Расшифровка устарела. Загрузите лист заново." });
        setState("error");
        setActiveJobId(null);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const snapshot: JobStatusResponse = await res.json();

      if (snapshot.status === "done" && snapshot.result) {
        localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
        setResult(snapshot.result.data);
        setMeta(snapshot.result.meta);
        setActiveJobId(null);
        const used = 3 - (snapshot.result.meta.remaining ?? 0);
        setUsedCount(Math.max(0, used));
        setState("result");
        return;
      }

      if (snapshot.status === "failed") {
        localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
        setError({
          error: "pipeline_failed",
          message: snapshot.error || "Не удалось расшифровать лист. Попробуйте другое фото.",
        });
        setActiveJobId(null);
        setState("error");
        return;
      }

      // queued or processing — update state and schedule next poll
      setJobPosition(snapshot.position);
      setJobEtaSec(snapshot.etaSec);
      if (snapshot.status === "queued") setState("queued");
      else if (snapshot.status === "processing") {
        setState("processing");
        if (processingStartRef.current === null && snapshot.startedAt !== null) {
          processingStartRef.current = snapshot.startedAt;
        }
      }

      pollTimeoutRef.current = window.setTimeout(
        () => pollJob(jobId, 0),
        POLL_INTERVAL_MS,
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;

      const failures = consecutiveFailures + 1;
      if (failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        setError({
          error: "network",
          message: "Потеряна связь с сервером. Проверьте подключение и попробуйте ещё раз.",
        });
        setState("error");
        return;
      }

      // Exponential backoff: 2s, 4s, 8s, 16s, 32s (cap 60s)
      const backoffMs = Math.min(POLL_INTERVAL_MS * Math.pow(2, failures - 1), 60_000);
      pollTimeoutRef.current = window.setTimeout(
        () => pollJob(jobId, failures),
        backoffMs,
      );
    }
  }, []);

  // Abort pending fetch + timeout on unmount
  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  // Session restore on mount — resume polling if jobId is in localStorage
  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
    if (stored) {
      setActiveJobId(stored);
      void pollJob(stored, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotate processing stage label while state === "processing"
  useEffect(() => {
    if (state !== "processing") return;
    if (processingStartRef.current === null) processingStartRef.current = Date.now();

    const update = () => {
      const elapsed = Date.now() - (processingStartRef.current ?? Date.now());
      let stage = 0;
      let acc = 0;
      for (let i = 0; i < PROCESSING_STAGE_DURATIONS_MS.length; i++) {
        acc += PROCESSING_STAGE_DURATIONS_MS[i];
        if (elapsed < acc) { stage = i; break; }
      }
      setProcessingStage(stage);
    };

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const handleFile = useCallback((f: File) => {
    if (f.size > 10 * 1024 * 1024) { setError({ error: "file_too_large", message: "Файл слишком большой (максимум 10 МБ)" }); setState("error"); return; }
    if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(f.type)) { setError({ error: "invalid_type", message: "Поддерживаемые форматы: JPG, PNG, WebP, HEIC" }); setState("error"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setState("preview");
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }, [handleFile]);

  const clearFile = () => {
    pollAbortRef.current?.abort();
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    processingStartRef.current = null;
    setActiveJobId(null);
    setJobPosition(0);
    setJobEtaSec(0);
    setProcessingStage(0);
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setState("idle");
    setResult(null);
    setMeta(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setState("submitting");

    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/tools/auction-sheet", { method: "POST", body: fd });

      if (res.status === 503) {
        const body = (await res.json()) as QueueFullError;
        setError({ error: "queue_full", message: body.message });
        setState("error");
        return;
      }

      if (res.status === 429) {
        const body = await res.json();
        setIsLimitReached(true);
        setUsedCount(3);
        setError(body as ApiError);
        setState("error");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Не удалось отправить файл." }));
        setError({
          error: body.error ?? "submit_error",
          message: body.message ?? "Ошибка при отправке.",
        });
        setState("error");
        return;
      }

      // 202 Accepted — expect {jobId, statusUrl, position, etaSec}
      const accepted = (await res.json()) as AcceptedResponse;

      localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, accepted.jobId);
      setActiveJobId(accepted.jobId);
      setJobPosition(accepted.position);
      setJobEtaSec(accepted.etaSec);
      setState(accepted.position > 0 ? "queued" : "processing");
      if (accepted.position === 0) processingStartRef.current = Date.now();

      void pollJob(accepted.jobId, 0);
    } catch {
      setError({ error: "network", message: "Ошибка сети. Проверьте подключение." });
      setState("error");
    }
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
        <UploadZone
          state={state}
          file={file}
          preview={preview}
          dragOver={dragOver}
          onFileSelect={handleFile}
          onDragOverChange={setDragOver}
          onClear={clearFile}
        />
      )}

      {state === "preview" && (
        <>
          {usedCount > 0 && (
            <div className="mt-4">
              <TelegramAuthBlock
                usedCount={usedCount}
                maxCount={3}
                isLimitReached={false}
                source="auction"
              />
            </div>
          )}
          <button onClick={handleAnalyze} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3.5 font-medium text-white transition-colors hover:bg-secondary-hover">
            Расшифровать
          </button>
        </>
      )}

      {state === "submitting" && (
        <ProcessingViews state="submitting" preview={preview} />
      )}

      {state === "queued" && (
        <ProcessingViews
          state="queued"
          preview={preview}
          jobPosition={jobPosition}
          jobEtaSec={jobEtaSec}
        />
      )}

      {state === "processing" && (
        <ProcessingViews
          state="processing"
          preview={preview}
          processingStage={processingStage}
        />
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
            {(result.bodyDamages ?? []).length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-text-muted"><th className="pb-2 pr-3">Расположение</th><th className="pb-2 pr-3">Код</th><th className="pb-2 pr-3">Описание</th><th className="pb-2">Серьёзность</th></tr></thead>
                  <tbody>
                    {(result.bodyDamages ?? []).map((d, i) => (
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
          {(result.equipment ?? []).length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-heading text-lg font-semibold text-text">Комплектация</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {(result.equipment ?? []).map((e) => <span key={e} className="rounded-full bg-surface-alt px-3 py-1 text-sm text-text">{e}</span>)}
              </div>
            </div>
          )}

          {/* Expert comments + warnings */}
          {(result.expertComments || (result.warnings ?? []).length > 0) && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-heading text-lg font-semibold text-text">Комментарии</h3>
              {result.expertComments && <p className="mt-3 text-sm text-text-muted">{result.expertComments}</p>}
              {(result.warnings ?? []).map((w, i) => (
                <div key={i} className="mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">{w}</div>
              ))}
            </div>
          )}

          {/* Unrecognized */}
          {(result.unrecognized ?? []).length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-heading text-lg font-semibold text-text">Не распознано</h3>
              <p className="mt-2 text-xs text-text-muted">Эти данные не удалось распознать автоматически</p>
              <ul className="mt-3 list-inside list-disc text-sm text-text-muted">{(result.unrecognized ?? []).map((u, i) => <li key={i}>{u}</li>)}</ul>
            </div>
          )}

          {/* Footer: confidence + actions */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${confidenceBadge(result.confidence).cls}`}>
              {confidenceBadge(result.confidence).label}
            </span>
            {meta && (
              <TelegramAuthBlock
                usedCount={usedCount}
                maxCount={3}
                isLimitReached={false}
                source="auction"
              />
            )}
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
          {error.error === "queue_full" ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => { setError(null); setState("preview"); }}
                className="rounded-xl bg-secondary px-6 py-3 font-medium text-white"
              >
                Попробовать через несколько минут
              </button>
              <a
                href={CONTACTS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary"
              >
                Написать менеджеру — он поможет вам подобрать машину
              </a>
            </div>
          ) : error.error === "rate_limit" ? (
            <TelegramAuthBlock
              usedCount={usedCount}
              maxCount={3}
              isLimitReached={true}
              source="auction"
              onAuthSuccess={() => {
                setIsLimitReached(false);
                setError(null);
                setState('idle');
                clearFile();
              }}
            />
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
