/**
 * @file        leadPersistence.ts
 * @description Client-side localStorage persistence of every lead submit attempt.
 *              Internal recovery infrastructure. Never user-facing.
 * @runs        Browser (client component imports only — SSR-safe via window guard)
 * @rule        ALWAYS call saveBeforeSend() BEFORE fetch('/api/lead'). The whole
 *              point is to persist data even when the fetch call never reaches
 *              the network (DNS failure, tab close, browser cancellation).
 *              Calling it after fetch defeats the safety net.
 * @rule        Persistence is INDEFINITE. We never auto-clean lead entries from
 *              localStorage. Per-user storage cost is ~300 bytes per lead;
 *              a typical user submits 1-3 leads in their entire history, far
 *              under the 5MB localStorage quota. Out-of-quota errors are
 *              caught and swallowed (the lead still attempts the network call).
 * @rule        SSR-safe — every public function checks `typeof window` first
 *              and returns a safe value when called server-side. Next.js 16
 *              renders client components on the server during initial paint;
 *              localStorage does not exist there.
 * @rule        NO UI. NO banners. NO retries. NO user notifications. The user
 *              sees no behavioural change from these functions. They exist
 *              purely to enable lead recovery via support (user opens DevTools,
 *              finds the entry, forwards JSON).
 * @lastModified 2026-05-04
 */

const STORAGE_KEY = "jckauto:leads";

export interface LeadFormSnapshot {
  phone: string;
  name?: string;
  message?: string;
  source?: string;
  subject?: string;
}

export interface PersistedLead {
  id: string;
  timestamp: string; // ISO 8601
  status: "unconfirmed" | "confirmed";
  data: LeadFormSnapshot;
  url: string; // window.location.href at submit time
  userAgent: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll(): PersistedLead[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: PersistedLead[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded or storage disabled — swallow. The fetch still happens
    // on the network; this is best-effort persistence, not a hard requirement.
  }
}

/**
 * Persist a lead snapshot BEFORE the fetch call. Returns the generated ID
 * which the caller passes to markConfirmed() on HTTP 2xx.
 *
 * Generates a UUID-like ID using crypto.randomUUID() if available, else
 * falls back to a timestamp+random string.
 */
export function saveBeforeSend(data: LeadFormSnapshot): string {
  const id =
    isBrowser() && typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const entry: PersistedLead = {
    id,
    timestamp: new Date().toISOString(),
    status: "unconfirmed",
    data,
    url: isBrowser() ? window.location.href : "",
    userAgent: isBrowser() ? window.navigator.userAgent : "",
  };

  const all = readAll();
  all.push(entry);
  writeAll(all);

  return id;
}

/**
 * Mark a previously-saved lead as confirmed (server returned HTTP 2xx).
 * If the entry is not found (e.g. localStorage was cleared between save
 * and confirm), this is a no-op.
 */
export function markConfirmed(id: string): void {
  if (!isBrowser()) return;
  const all = readAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], status: "confirmed" };
  writeAll(all);
}
