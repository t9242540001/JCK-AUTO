/**
 * @file        ErrorView.tsx
 * @description Error view for the auction-sheet tool. Renders four sub-cases based on the incoming error: queue_full (server capacity), rate_limit cooldown (2-minute pause — with live countdown), rate_limit anonymous-lifetime exhausted (TelegramAuthBlock), rate_limit authenticated-daily exhausted (manager contact), and a default fallback for any other error code.
 * @rule        Fully controlled. All state and callbacks come from the orchestrator. Exception: CooldownTimer owns its own ticking state (seconds counting down), which is a local display concern and does not leak upward.
 * @rule        rate_limit routing: `remaining > 0` → cooldown; `remaining === 0 && isLifetimeLimit === true` → anonymous auth block; `remaining === 0 && isLifetimeLimit === false` → authenticated daily-exhausted manager card; any undefined sub-field falls through to the default "Попробовать ещё + написать менеджеру" UI.
 */

"use client";

import { useEffect, useState } from "react";
import { CONTACTS } from "@/lib/constants";
import TelegramAuthBlock from "@/components/TelegramAuthBlock";
import type { ApiError } from "./auctionSheetTypes";

export interface ErrorViewProps {
  /** The error to display. Shape comes from the orchestrator via `setError`. */
  error: ApiError;
  /** Usage counter shown in TelegramAuthBlock (anonymous case only). Pass the orchestrator's current usedCount. */
  usedCount: number;
  /** Called when the user clicks "Попробовать ещё". Parent resets error + transitions state to "preview". */
  onRetry: () => void;
  /** Called by TelegramAuthBlock on successful Telegram login. Parent clears error + file + state. */
  onAuthSuccess: () => void;
}

// ─── COOLDOWN TIMER (inner sub-component) ─────────────────────────────────

/**
 * Live countdown timer used only in the rate_limit cooldown case.
 * Counts down from the initial value, formats as "MM:SS", stops at 0.
 * Calls `onFinish` exactly once when it reaches 0 so the parent can enable the retry button.
 */
function CooldownTimer({
  initialSeconds,
  onFinish,
}: {
  initialSeconds: number;
  onFinish: () => void;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      onFinish();
      return;
    }
    const id = window.setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds, onFinish]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <span className="font-mono text-lg font-semibold text-text" aria-live="off">
      {mm}:{ss}
    </span>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────

export default function ErrorView({
  error,
  usedCount,
  onRetry,
  onAuthSuccess,
}: ErrorViewProps) {
  // Cooldown readiness tracked here (not inside CooldownTimer) so the "Retry" button can read it.
  const [cooldownReady, setCooldownReady] = useState(false);

  // queue_full — unchanged from current inline code.
  const isQueueFull = error.error === "queue_full";
  const isRateLimit = error.error === "rate_limit";
  const isCooldown = isRateLimit && (error.remaining ?? 0) > 0;
  const isAnonLifetime =
    isRateLimit && error.remaining === 0 && error.isLifetimeLimit === true;
  const isAuthDaily =
    isRateLimit && error.remaining === 0 && error.isLifetimeLimit === false;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="font-medium text-red-800">{error.message}</p>

      {/* queue_full — 2 buttons (unchanged) */}
      {isQueueFull && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onRetry}
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
      )}

      {/* rate_limit cooldown — live countdown + conditionally-active retry button */}
      {isCooldown && (
        <div className="mt-4">
          <p className="text-sm text-text-muted">
            Можно попробовать через{" "}
            <CooldownTimer
              key={error.resetIn ?? 120}
              initialSeconds={error.resetIn ?? 120}
              onFinish={() => setCooldownReady(true)}
            />
          </p>
          <button
            onClick={onRetry}
            disabled={!cooldownReady}
            aria-label={
              cooldownReady
                ? "Попробовать ещё, кулдаун истёк"
                : "Попробовать ещё — недоступно, идёт кулдаун"
            }
            className={`mt-4 rounded-xl bg-secondary px-6 py-3 font-medium text-white transition-opacity ${
              cooldownReady
                ? "hover:bg-secondary-hover"
                : "cursor-not-allowed opacity-50"
            }`}
          >
            Попробовать ещё
          </button>
        </div>
      )}

      {/* rate_limit anonymous-lifetime exhausted — Telegram auth block */}
      {isAnonLifetime && (
        <TelegramAuthBlock
          usedCount={usedCount}
          maxCount={3}
          isLimitReached={true}
          source="auction"
          onAuthSuccess={onAuthSuccess}
        />
      )}

      {/* rate_limit authenticated-daily exhausted — manager contact only */}
      {isAuthDaily && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-secondary px-6 py-3 font-medium text-white"
          >
            Написать менеджеру
          </a>
        </div>
      )}

      {/* default — any other error code (network, pipeline_failed, submit_error, job_not_found) */}
      {!isQueueFull && !isRateLimit && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onRetry}
            className="rounded-xl bg-secondary px-6 py-3 font-medium text-white"
          >
            Попробовать ещё
          </button>
          <a
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary"
          >
            Написать менеджеру
          </a>
        </div>
      )}
    </div>
  );
}
