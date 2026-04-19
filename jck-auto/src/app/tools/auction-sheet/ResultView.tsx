/**
 * @file        ResultView.tsx
 * @description Result view for the auction-sheet tool — renders the full decoded auction sheet across 9 visual sections: Аукцион и оценка, Автомобиль, Идентификация (new — VIN/model code/plate/inspection), Состояние кузова, Плюсы по заметкам аукциона (new — salesPoints), Комплектация, Комментарии, collapsible Дополнительный текст с листа (replaces former "Не распознано"), Footer (confidence + PDF + retry), CTA. Fully controlled.
 * @rule        Fully controlled. All data and callbacks come from props. No fetch, no localStorage, no timers.
 * @rule        Section order is deliberate: grade first (primary purchase signal), then vehicle overview, then identification details, then condition, then extras. Do NOT reorder without a UX review.
 * @rule        "Дополнительный текст с листа" is a native <details>/<summary> collapsible. Do NOT reinvent with useState — the HTML element is already accessible and keyboard-friendly.
 */

"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Download, RefreshCw, Send } from "lucide-react";
import { CONTACTS } from "@/lib/constants";
import TelegramAuthBlock from "@/components/TelegramAuthBlock";
import type { AuctionResult, ApiResponse } from "./auctionSheetTypes";
import {
  gradeColor,
  severityColor,
  confidenceBadge,
  formatVin,
  formatDimensions,
  formatRecycleFee,
} from "./auctionSheetHelpers";

export interface ResultViewProps {
  /** Decoded auction sheet data from the server pipeline. */
  result: AuctionResult;
  /** Response meta (model, tokens, remaining). Used to conditionally render TelegramAuthBlock in footer. */
  meta: ApiResponse["meta"] | null;
  /** Current usage count (0–3). Shown inside TelegramAuthBlock in the footer. */
  usedCount: number;
  /** Called when the user clicks "Скачать PDF-отчёт". Parent owns the fetch. */
  onDownloadPdf: () => void;
  /** Called when the user clicks "Расшифровать ещё". Parent resets all state. */
  onReset: () => void;
}

export default function ResultView({
  result,
  meta,
  usedCount,
  onDownloadPdf,
  onReset,
}: ResultViewProps) {
  const vin = formatVin(result.vin, result.vinConfidence);
  const dimensionsFmt = formatDimensions(result.dimensions);
  const recycleFeeFmt = formatRecycleFee(result.recycleFee);

  const hasIdentification =
    vin.value !== null ||
    vin.note !== null ||
    result.modelCode !== null ||
    result.registrationNumber !== null ||
    result.inspectionValidUntil !== null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* 1. Auction & Grade */}
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

      {/* 2. Car details */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="font-heading text-lg font-semibold text-text">Автомобиль</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {[
            ["Марка", result.make], ["Модель", result.model], ["Год", result.year],
            ["Двигатель", result.engineVolume ? `${result.engineVolume} см³` : null], ["Тип", result.engineType], ["КПП", result.transmission],
            ["Цвет", result.color],
            ["Код цвета", result.colorCode],
            ["Владение", result.ownership],
            ["Мест", result.seats !== null ? `${result.seats} мест` : null],
            ["Тип кузова", result.bodyType],
            ["Габариты", dimensionsFmt],
            ["Сбор утилизации", recycleFeeFmt],
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

      {/* 3. Identification (new) */}
      {hasIdentification && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h3 className="font-heading text-lg font-semibold text-text">Идентификация</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(vin.value || vin.note) && (
              <div>
                <span className="text-xs text-text-muted">VIN</span>
                {vin.value ? (
                  <>
                    <p className="font-mono font-medium text-text">{vin.value}</p>
                    {vin.note && <span className="text-xs text-amber-600">{vin.note}</span>}
                  </>
                ) : (
                  <p className="italic text-text-muted">{vin.note}</p>
                )}
              </div>
            )}
            {result.modelCode && (
              <div>
                <span className="text-xs text-text-muted">Код модели</span>
                <p className="font-mono text-text">{result.modelCode}</p>
              </div>
            )}
            {result.registrationNumber && (
              <div>
                <span className="text-xs text-text-muted">Регистрационный номер</span>
                <p className="font-medium text-text">{result.registrationNumber}</p>
              </div>
            )}
            {result.inspectionValidUntil && (
              <div>
                <span className="text-xs text-text-muted">Тех. осмотр до</span>
                <p className="font-medium text-text">{result.inspectionValidUntil}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Body damages */}
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

      {/* 5. Sales points (new) */}
      {(result.salesPoints ?? []).length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h3 className="font-heading text-lg font-semibold text-text">Плюсы по заметкам аукциона</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {result.salesPoints.map((p, i) => (
              <span key={i} className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* 6. Equipment */}
      {(result.equipment ?? []).length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h3 className="font-heading text-lg font-semibold text-text">Комплектация</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {(result.equipment ?? []).map((e) => <span key={e} className="rounded-full bg-surface-alt px-3 py-1 text-sm text-text">{e}</span>)}
          </div>
        </div>
      )}

      {/* 7. Expert comments + warnings */}
      {(result.expertComments || (result.warnings ?? []).length > 0) && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h3 className="font-heading text-lg font-semibold text-text">Комментарии</h3>
          {result.expertComments && <p className="mt-3 text-sm text-text-muted">{result.expertComments}</p>}
          {(result.warnings ?? []).map((w, i) => (
            <div key={i} className="mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">{w}</div>
          ))}
        </div>
      )}

      {/* 8. Additional text (collapsible, replaces "Не распознано") */}
      {(result.unrecognized ?? []).length > 0 && (
        <details className="rounded-2xl border border-border bg-surface p-6">
          <summary className="cursor-pointer font-heading text-sm font-medium text-text-muted hover:text-text">
            Дополнительный текст с листа ({result.unrecognized.length})
          </summary>
          <p className="mt-3 text-xs text-text-muted">
            Данные, которые не удалось сопоставить со структурированными полями. Обычно это технические отметки аукциона, которые не влияют на оценку машины.
          </p>
          <ul className="mt-3 list-inside list-disc text-sm text-text-muted">
            {result.unrecognized.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        </details>
      )}

      {/* 9. Footer: confidence + actions + CTA */}
      <ResultFooter
        confidence={result.confidence}
        meta={meta}
        usedCount={usedCount}
        onDownloadPdf={onDownloadPdf}
        onReset={onReset}
      />
    </motion.div>
  );
}

function ResultFooter({
  confidence,
  meta,
  usedCount,
  onDownloadPdf,
  onReset,
}: {
  confidence: AuctionResult["confidence"];
  meta: ApiResponse["meta"] | null;
  usedCount: number;
  onDownloadPdf: () => void;
  onReset: () => void;
}) {
  const confBadge = confidenceBadge(confidence);
  return (
    <>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${confBadge.cls}`}>
          {confBadge.label}
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
        <button onClick={onDownloadPdf} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3 font-medium text-white transition-colors hover:bg-secondary-hover">
          <Download className="h-4 w-4" /> Скачать PDF-отчёт
        </button>
        <button onClick={onReset} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white">
          <RefreshCw className="h-4 w-4" /> Расшифровать ещё
        </button>
      </div>

      <div className="rounded-2xl bg-primary/5 p-6 text-center">
        <p className="font-heading font-semibold text-text">Хотите купить этот автомобиль?</p>
        <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#2AABEE] px-6 py-3 font-medium text-white transition-colors hover:bg-[#229ED9]">
          <Send className="h-4 w-4" /> Оставить заявку
        </a>
      </div>
    </>
  );
}
