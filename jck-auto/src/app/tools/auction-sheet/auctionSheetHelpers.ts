/**
 * @file        auctionSheetHelpers.ts
 * @description Pure formatting and classification helpers for the auction-sheet UI. No React, no DOM, no side effects. Deterministic and safe for both server and client rendering (SSR-friendly — no locale-dependent APIs).
 * @rule        Pure functions only — do NOT add hooks, localStorage access, fetch calls, or any side effects here. Anything stateful belongs in AuctionSheetClient.tsx.
 * @rule        No locale-dependent APIs (toLocaleString, Intl.NumberFormat) — SSR/CSR must produce identical strings to avoid hydration mismatches.
 */

import type {
  CarDimensions,
  FormattedVin,
  VinConfidence,
} from "./auctionSheetTypes";

/**
 * Format a file size in bytes to a human-readable Russian string.
 * 500 → "500 Б", 2048 → "2 КБ", 1500000 → "1.4 МБ".
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Map an auction overall grade (numeric or letter) to a Tailwind text color class.
 */
export function gradeColor(grade: string | null): string {
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

/**
 * Map a body-damage severity to a Tailwind background + text color class.
 */
export function severityColor(s: string): string {
  if (s === "minor") return "bg-gray-100 text-gray-600";
  if (s === "moderate") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

/**
 * Map the parser's overall confidence level to a Russian badge label + Tailwind class pair.
 */
export function confidenceBadge(c: string): { label: string; cls: string } {
  if (c === "high") return { label: "Высокая точность", cls: "bg-green-100 text-green-700" };
  if (c === "medium") return { label: "Средняя точность", cls: "bg-amber-100 text-amber-700" };
  return { label: "Низкая точность", cls: "bg-red-100 text-red-700" };
}

/**
 * Format a CarDimensions object to a human-readable Russian string.
 * {length:459, width:169, height:160} → "459 × 169 × 160 см".
 * Any null field is rendered as "—".
 * Returns null if the object itself is null OR all three fields are null.
 */
export function formatDimensions(d: CarDimensions | null): string | null {
  if (!d) return null;
  if (d.length === null && d.width === null && d.height === null) return null;
  const fmt = (v: number | null) => (v === null ? "—" : String(v));
  return `${fmt(d.length)} × ${fmt(d.width)} × ${fmt(d.height)} см`;
}

/**
 * Format a recycle fee amount in JPY to a human-readable Russian string with thin-space thousand separators.
 * 10460 → "10 460 ¥". Returns null when input is null.
 *
 * Uses a plain regex instead of toLocaleString to guarantee byte-identical output
 * between SSR and CSR (no locale-dependent formatting).
 */
export function formatRecycleFee(amount: number | null): string | null {
  if (amount === null) return null;
  const withSeparators = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  return `${withSeparators} ¥`;
}

/**
 * Render a VIN and its confidence into a display pair.
 * See FormattedVin docs in auctionSheetTypes.ts for the four cases.
 * UI layer decides how to render; this helper only classifies.
 */
export function formatVin(
  vin: string | null,
  confidence: VinConfidence,
): FormattedVin {
  if (vin && confidence === "high") return { value: vin, note: null };
  if (vin && confidence === "medium") return { value: vin, note: "частично читается" };
  if (!vin && confidence === "unreadable") return { value: null, note: "не читается на фото" };
  return { value: null, note: null };
}
