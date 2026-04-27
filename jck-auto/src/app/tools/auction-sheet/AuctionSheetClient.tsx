"use client";

import { useState, useCallback, useEffect } from "react";
import TelegramAuthBlock from "@/components/TelegramAuthBlock";
import UploadZone from "./UploadZone";
import ProcessingViews from "./ProcessingViews";
import ErrorView from "./ErrorView";
import ResultView from "./ResultView";
import { useAuctionSheetJob } from "./useAuctionSheetJob";
import type {
  AuctionResult,
  ApiResponse,
  ApiError,
  AcceptedResponse,
  QueueFullError,
  State,
} from "./auctionSheetTypes";

// @rule This component owns UI state (idle/preview/submitting/result/error)
//       and reacts to job lifecycle changes from useAuctionSheetJob via a
//       single useEffect. The hook owns all polling, refs, storage, and
//       session restore. Do NOT inline polling logic here — that was the
//       pre-refactor shape that grew to 380 lines and missed cleanup paths.

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

  // Mirror queue/processing data into local state for prop passing to
  // ProcessingViews. The hook owns the source of truth; this is a copy.
  const [jobPosition, setJobPosition] = useState<number>(0);
  const [jobEtaSec, setJobEtaSec] = useState<number>(0);
  const [processingStage, setProcessingStage] = useState<number>(0);

  const job = useAuctionSheetJob();

  // React to job lifecycle changes. Exhaustiveness-checked via discriminated
  // union — adding a new phase to JobState will surface as a TS error here.
  useEffect(() => {
    switch (job.state.phase) {
      case "idle":
        // Hook reset to idle (e.g. after start error). Do NOT touch UI state
        // here — UI orchestrates its own idle via clearFile().
        break;
      case "queued":
        setJobPosition(job.state.position);
        setJobEtaSec(job.state.etaSec);
        setState("queued");
        break;
      case "processing":
        setProcessingStage(job.state.stage);
        setState("processing");
        break;
      case "done": {
        setResult(job.state.result);
        setMeta(job.state.meta);
        const used = 3 - (job.state.meta.remaining ?? 0);
        setUsedCount(Math.max(0, used));
        setState("result");
        break;
      }
      case "failed":
        setError(job.state.error);
        setState("error");
        break;
      case "lost":
        setError({
          error: "network",
          message:
            "Потеряна связь с сервером. Проверьте подключение и попробуйте ещё раз.",
        });
        setState("error");
        break;
    }
  }, [job.state]);

  const handleFile = useCallback((f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      setError({
        error: "file_too_large",
        message: "Файл слишком большой (максимум 10 МБ)",
      });
      setState("error");
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp", "image/heic"].includes(f.type)
    ) {
      setError({
        error: "invalid_type",
        message: "Поддерживаемые форматы: JPG, PNG, WebP, HEIC",
      });
      setState("error");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setState("preview");
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const clearFile = () => {
    job.reset();
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
      const res = await fetch("/api/tools/auction-sheet", {
        method: "POST",
        body: fd,
      });

      if (res.status === 503) {
        const body = (await res.json()) as QueueFullError;
        setError({ error: "queue_full", message: body.message });
        setState("error");
        return;
      }

      if (res.status === 429) {
        const body = (await res.json()) as ApiError;
        // Only mark the user as "limit reached" when the anonymous lifetime
        // quota is exhausted. Cooldown (remaining > 0) and authenticated-
        // daily-exhausted cases must NOT set isLimitReached — otherwise the
        // preview-block counter and TelegramAuthBlock state desynchronise.
        // This is the orchestrator half of bug С-7 fix; the UI half lives
        // in ErrorView.
        if (body.isLifetimeLimit) {
          setIsLimitReached(true);
          setUsedCount(3);
        }
        setError(body);
        setState("error");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({
          message: "Не удалось отправить файл.",
        }));
        setError({
          error: body.error ?? "submit_error",
          message: body.message ?? "Ошибка при отправке.",
        });
        setState("error");
        return;
      }

      // 202 Accepted — expect {jobId, statusUrl, position, etaSec}.
      // Hand off to the hook, which writes ownership record, transitions
      // job state, and starts polling. This component reacts via the
      // useEffect above.
      const accepted = (await res.json()) as AcceptedResponse;
      job.start(accepted);
    } catch {
      setError({
        error: "network",
        message: "Ошибка сети. Проверьте подключение.",
      });
      setState("error");
    }
  };

  const handleDownloadPdf = async () => {
    if (!result) return;
    try {
      const res = await fetch("/api/tools/auction-sheet/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "auction-sheet-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* silent */
    }
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
          <button
            onClick={handleAnalyze}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3.5 font-medium text-white transition-colors hover:bg-secondary-hover"
          >
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
