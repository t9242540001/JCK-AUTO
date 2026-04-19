"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import TelegramAuthBlock from "@/components/TelegramAuthBlock";
import UploadZone from "./UploadZone";
import ProcessingViews from "./ProcessingViews";
import ErrorView from "./ErrorView";
import ResultView from "./ResultView";
import type {
  AuctionResult,
  ApiResponse,
  ApiError,
  AcceptedResponse,
  JobStatusResponse,
  QueueFullError,
  State,
} from "./auctionSheetTypes";

// @rule This component is async-first. POST /api/tools/auction-sheet returns
//       202 Accepted with jobId; the client polls GET /job/[jobId] every 2s.
//       Do NOT revert to synchronous fetch — backend no longer supports it.
// @rule jobId is persisted in localStorage so users surviving screen-off /
//       tab-switch can resume. On mount, check localStorage first.
//       On "done", "failed", or explicit reset — remove from localStorage.
// @rule Polling uses AbortController + setTimeout (NOT setInterval). Every
//       unmount / state change / cleanup must abort pending fetch AND
//       clear pending timeout — otherwise requests leak.
// @rule localStorage[ACTIVE_JOB_STORAGE_KEY] value is JSON {jobId, ownerTabId},
//       NOT a plain string. Ownership is checked on mount via sessionStorage[TAB_ID_STORAGE_KEY].
//       Do not strip ownerTabId or revert to plain-string format.

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;
const ACTIVE_JOB_STORAGE_KEY = "jckauto.auction_sheet.active_job";
const TAB_ID_STORAGE_KEY = "jckauto.auction_sheet.tab_id";
const PROCESSING_STAGE_DURATIONS_MS = [5000, 15000, Infinity];

// ─── HELPERS ──────────────────────────────────────────────────────────────

function generateTabId(): string {
  // crypto.randomUUID requires secure context + modern browser
  // (Chrome 92+, Firefox 95+, Safari 15.4+). Fallback covers older
  // mobile Safari on outdated iOS versions to prevent runtime crash.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

  // Session restore on mount — resume polling only if THIS tab owns the stored job.
  // @rule localStorage is shared across all tabs of the same origin; sessionStorage
  //       is per-tab. Ownership is established by matching localStorage.ownerTabId
  //       against sessionStorage[TAB_ID_STORAGE_KEY]. Fixes bug C-6.
  // @rule Orphan handling is silent cleanup, NOT a "resume?" banner. This is a
  //       deliberate decision — see ADR [2026-04-19] Cross-tab session ownership
  //       in auction-sheet client. Do not add a resume banner without revising
  //       the ADR first.
  useEffect(() => {
    const raw = localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
    if (!raw) return;

    // Ensure this tab has an id (needed for both owner check AND future submits
    // within this tab — a refreshed tab mid-polling keeps its id via sessionStorage).
    let tabId = sessionStorage.getItem(TAB_ID_STORAGE_KEY);
    if (!tabId) {
      tabId = generateTabId();
      sessionStorage.setItem(TAB_ID_STORAGE_KEY, tabId);
    }

    let parsed: { jobId?: unknown; ownerTabId?: unknown } | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Legacy plain-string format OR malformed JSON — treat as orphan.
      localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      return;
    }

    if (
      !parsed ||
      typeof parsed.jobId !== "string" ||
      typeof parsed.ownerTabId !== "string"
    ) {
      localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      return;
    }

    if (parsed.ownerTabId !== tabId) {
      // Another tab owns this job (or the owner tab was closed).
      // Silent cleanup — the sibling tab renders a fresh upload screen.
      // We do NOT remove the localStorage entry here, because the owning
      // tab may still be active and polling. It will clean up on done/failed/reset.
      return;
    }

    setActiveJobId(parsed.jobId);
    void pollJob(parsed.jobId, 0);
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
        const body = (await res.json()) as ApiError;
        // Only mark the user as "limit reached" when the anonymous lifetime quota is exhausted.
        // Cooldown (remaining > 0) and authenticated-daily-exhausted cases must NOT set isLimitReached
        // — otherwise the preview-block counter and TelegramAuthBlock state desynchronise.
        // This is the orchestrator half of bug С-7 fix; the UI half lives in ErrorView.
        if (body.isLifetimeLimit) {
          setIsLimitReached(true);
          setUsedCount(3);
        }
        setError(body);
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

      // Ensure this tab has an id, then write ownership record.
      // @rule ALWAYS write both jobId and ownerTabId together — a record missing
      //       ownerTabId is treated as orphan garbage on next mount.
      let tabId = sessionStorage.getItem(TAB_ID_STORAGE_KEY);
      if (!tabId) {
        tabId = generateTabId();
        sessionStorage.setItem(TAB_ID_STORAGE_KEY, tabId);
      }
      localStorage.setItem(
        ACTIVE_JOB_STORAGE_KEY,
        JSON.stringify({ jobId: accepted.jobId, ownerTabId: tabId }),
      );
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

      {state === "result" && result && (
        <ResultView
          result={result}
          meta={meta}
          usedCount={usedCount}
          onDownloadPdf={handleDownloadPdf}
          onReset={clearFile}
        />
      )}

      {/* Error */}
      {state === "error" && error && (
        <ErrorView
          error={error}
          usedCount={usedCount}
          onRetry={() => {
            setError(null);
            setState("preview");
          }}
          onAuthSuccess={() => {
            setIsLimitReached(false);
            setError(null);
            setState("idle");
            clearFile();
          }}
        />
      )}
    </div>
  );
}
