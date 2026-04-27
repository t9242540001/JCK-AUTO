"use client";

/**
 * @file        useAuctionSheetJob.ts
 * @description React hook that owns the auction-sheet decoding job lifecycle:
 *              accept-and-poll the async API, manage cross-tab ownership via
 *              localStorage/sessionStorage, rotate processing-stage labels,
 *              expose state as a discriminated union JobState.
 * @rule        This hook is async-first. POST /api/tools/auction-sheet returns
 *              202 Accepted with jobId; the hook polls GET /job/[jobId] every
 *              2s. Do NOT revert to synchronous fetch — backend no longer
 *              supports it.
 * @rule        jobId is persisted in localStorage so users surviving screen-off
 *              / tab-switch can resume. On mount, ownership check via
 *              sessionStorage[TAB_ID_STORAGE_KEY] decides resume vs ignore.
 *              On "done"/"failed"/explicit reset — remove from localStorage.
 * @rule        Polling uses AbortController + setTimeout (NOT setInterval).
 *              Every unmount / state transition / reset MUST abort pending
 *              fetch AND clear pending timeout — otherwise requests leak.
 * @rule        localStorage[ACTIVE_JOB_STORAGE_KEY] value is JSON
 *              {jobId, ownerTabId}, NOT a plain string. Ownership check on
 *              mount via sessionStorage[TAB_ID_STORAGE_KEY] — fixes C-6
 *              cross-tab session leak.
 * @lastModified 2026-04-26
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type {
  AcceptedResponse,
  JobStatusResponse,
  JobState,
} from "./auctionSheetTypes";

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

function ensureTabId(): string {
  let tabId = sessionStorage.getItem(TAB_ID_STORAGE_KEY);
  if (!tabId) {
    tabId = generateTabId();
    sessionStorage.setItem(TAB_ID_STORAGE_KEY, tabId);
  }
  return tabId;
}

// ─── HOOK ─────────────────────────────────────────────────────────────────

export interface UseAuctionSheetJob {
  /** Current job state — react to changes via useEffect. */
  state: JobState;
  /** Begin polling for an accepted job. Call after POST /api/... returns 202. */
  start: (accepted: AcceptedResponse) => void;
  /** Reset to idle. Aborts polling, clears storage, resets refs. */
  reset: () => void;
}

export function useAuctionSheetJob(): UseAuctionSheetJob {
  const [state, setState] = useState<JobState>({ phase: "idle" });

  // Polling lifecycle refs.
  const pollAbortRef = useRef<AbortController | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);
  const processingStartRef = useRef<number | null>(null);

  /**
   * Internal cleanup: abort pending fetch + clear pending timeout. Called
   * before any state transition that should stop polling, on unmount, and
   * inside reset(). Does NOT touch state or storage — caller decides those.
   */
  const stopPolling = useCallback(() => {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  /**
   * Recursive poll: fetch one snapshot, schedule the next via setTimeout.
   * On done/failed/network-exhaustion — transition state and stop. On
   * transient error — exponential backoff. AbortController cancels in-flight
   * fetch on cleanup.
   */
  const pollJob = useCallback(
    async (jobId: string, consecutiveFailures = 0) => {
      const controller = new AbortController();
      pollAbortRef.current = controller;

      try {
        const res = await fetch(`/api/tools/auction-sheet/job/${jobId}`, {
          signal: controller.signal,
        });

        if (res.status === 404) {
          localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
          setState({
            phase: "failed",
            jobId,
            error: {
              error: "job_not_found",
              message: "Расшифровка устарела. Загрузите лист заново.",
            },
          });
          return;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const snapshot: JobStatusResponse = await res.json();

        if (snapshot.status === "done" && snapshot.result) {
          localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
          setState({
            phase: "done",
            jobId,
            result: snapshot.result.data,
            meta: snapshot.result.meta,
          });
          return;
        }

        if (snapshot.status === "failed") {
          localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
          setState({
            phase: "failed",
            jobId,
            error: {
              error: "pipeline_failed",
              message:
                snapshot.error ||
                "Не удалось расшифровать лист. Попробуйте другое фото.",
            },
          });
          return;
        }

        // queued or processing — update state and schedule next poll.
        if (snapshot.status === "queued") {
          setState({
            phase: "queued",
            jobId,
            position: snapshot.position,
            etaSec: snapshot.etaSec,
          });
        } else if (snapshot.status === "processing") {
          if (processingStartRef.current === null && snapshot.startedAt !== null) {
            processingStartRef.current = snapshot.startedAt;
          }
          // Compute initial stage from elapsed time. The rotating useEffect
          // below will keep this fresh while phase === "processing".
          const elapsed =
            Date.now() - (processingStartRef.current ?? Date.now());
          let stage = 0;
          let acc = 0;
          for (let i = 0; i < PROCESSING_STAGE_DURATIONS_MS.length; i++) {
            acc += PROCESSING_STAGE_DURATIONS_MS[i];
            if (elapsed < acc) {
              stage = i;
              break;
            }
          }
          setState({ phase: "processing", jobId, stage });
        }

        pollTimeoutRef.current = window.setTimeout(
          () => pollJob(jobId, 0),
          POLL_INTERVAL_MS,
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;

        const failures = consecutiveFailures + 1;
        if (failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
          setState({ phase: "lost", jobId });
          return;
        }

        // Exponential backoff: 2s, 4s, 8s, 16s, 32s (cap 60s)
        const backoffMs = Math.min(
          POLL_INTERVAL_MS * Math.pow(2, failures - 1),
          60_000,
        );
        pollTimeoutRef.current = window.setTimeout(
          () => pollJob(jobId, failures),
          backoffMs,
        );
      }
    },
    [],
  );

  /**
   * Begin tracking a new job. Writes ownership record, transitions state.
   */
  const start = useCallback(
    (accepted: AcceptedResponse) => {
      stopPolling();
      const tabId = ensureTabId();
      localStorage.setItem(
        ACTIVE_JOB_STORAGE_KEY,
        JSON.stringify({ jobId: accepted.jobId, ownerTabId: tabId }),
      );

      if (accepted.position > 0) {
        setState({
          phase: "queued",
          jobId: accepted.jobId,
          position: accepted.position,
          etaSec: accepted.etaSec,
        });
      } else {
        processingStartRef.current = Date.now();
        setState({ phase: "processing", jobId: accepted.jobId, stage: 0 });
      }

      void pollJob(accepted.jobId, 0);
    },
    [pollJob, stopPolling],
  );

  /**
   * Reset to idle. Used on user "clear" action and after consuming a
   * terminal state (done/failed/lost) when the orchestrator decides to
   * return the user to the upload screen.
   */
  const reset = useCallback(() => {
    stopPolling();
    localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    processingStartRef.current = null;
    setState({ phase: "idle" });
  }, [stopPolling]);

  // Abort pending fetch + timeout on unmount.
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Session restore on mount — resume polling only if THIS tab owns the
  // stored job. localStorage is shared across all tabs of the same origin;
  // sessionStorage is per-tab. Ownership matches localStorage.ownerTabId
  // against sessionStorage[TAB_ID_STORAGE_KEY]. Fixes bug C-6.
  // @rule Orphan handling is silent cleanup, NOT a "resume?" banner.
  //       See ADR [2026-04-19] Cross-tab session ownership in auction-sheet.
  useEffect(() => {
    const raw = localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
    if (!raw) return;

    const tabId = ensureTabId();

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
      // Sibling tab owns this job. Silent — that tab will clean up on terminal.
      return;
    }

    // Resume.
    void pollJob(parsed.jobId, 0);
    // pollJob is stable (empty deps). Lint should be satisfied; suppress
    // exhaustive-deps because we explicitly only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotate processing stage label while phase === "processing".
  useEffect(() => {
    if (state.phase !== "processing") return;
    if (processingStartRef.current === null) {
      processingStartRef.current = Date.now();
    }

    const update = () => {
      const elapsed =
        Date.now() - (processingStartRef.current ?? Date.now());
      let stage = 0;
      let acc = 0;
      for (let i = 0; i < PROCESSING_STAGE_DURATIONS_MS.length; i++) {
        acc += PROCESSING_STAGE_DURATIONS_MS[i];
        if (elapsed < acc) {
          stage = i;
          break;
        }
      }
      // Only update state if stage actually changed — avoids re-renders.
      setState((prev) => {
        if (prev.phase !== "processing") return prev;
        if (prev.stage === stage) return prev;
        return { ...prev, stage };
      });
    };

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  return { state, start, reset };
}
