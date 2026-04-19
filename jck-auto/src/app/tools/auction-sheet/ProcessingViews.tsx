/**
 * @file        ProcessingViews.tsx
 * @description Three transitional states rendered between user submit and final result: "submitting" (POST in flight), "queued" (job waiting in server queue), "processing" (queue worker running AI pipeline). Fully controlled — all data comes from props; the stage rotation timer lives in the orchestrator.
 * @rule        This component is fully controlled and side-effect-free. Do NOT add timers, hooks, or state. The stage-rotation useEffect lives in AuctionSheetClient.tsx and feeds `processingStage` via props.
 * @rule        Visual structure (container + preview + loader) is SHARED across all three states. Only text content differs. Preserve this — do not split into three separate components.
 */

"use client";

import { Loader2 } from "lucide-react";

/** Stage labels for the "processing" state. 3 items, rotated by the orchestrator's timer. */
const PROCESSING_STAGE_LABELS = [
  "Распознаём лист…",
  "Распознаём текст…",
  "Расшифровываем данные…",
];

type ProcessingViewsProps =
  | { state: "submitting"; preview: string | null }
  | { state: "queued"; preview: string | null; jobPosition: number; jobEtaSec: number }
  | { state: "processing"; preview: string | null; processingStage: number };

export default function ProcessingViews(props: ProcessingViewsProps) {
  const { state, preview } = props;

  // Alt text varies by state for screen-reader accessibility.
  const alt =
    state === "submitting" ? "Анализируемый лист" :
    state === "queued" ? "В очереди" :
    "Обработка";

  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      {preview && (
        <img
          src={preview}
          alt={alt}
          className="mx-auto mb-6 h-24 rounded-xl object-contain opacity-60"
        />
      )}
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />

      {state === "submitting" && (
        <p className="mt-3 font-medium text-text">Отправляем файл на сервер…</p>
      )}

      {state === "queued" && (
        <>
          <p className="mt-3 font-medium text-text">В очереди на обработку</p>
          <p className="mt-1 text-sm text-text-muted">
            Позиция в очереди: {props.jobPosition}. Ожидание около {Math.ceil(props.jobEtaSec)} сек.
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Не закрывайте страницу. Мы продолжим обработку, даже если вы свернёте браузер.
          </p>
        </>
      )}

      {state === "processing" && (
        <>
          <p className="mt-3 font-medium text-text">
            {PROCESSING_STAGE_LABELS[props.processingStage] ?? PROCESSING_STAGE_LABELS[0]}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Обычно занимает 20–60 секунд. Рукописные листы — до 2 минут.
          </p>
        </>
      )}
    </div>
  );
}
