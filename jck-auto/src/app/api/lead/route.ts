/**
 * @file        route.ts
 * @description POST endpoint for site lead submission. Validates phone,
 *              applies route-local 5/15min sliding-window rate limit,
 *              writes audit log, sends to Telegram via Cloudflare Worker.
 * @runs        VDS
 * @rule        All three Telegram env vars (TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_CHAT_ID,
 *              TELEGRAM_API_BASE_URL) are REQUIRED. Missing any → log + 503 with fallback phone.
 *              Do NOT reintroduce a default for TELEGRAM_API_BASE_URL: the VDS provider
 *              blocks direct api.telegram.org, so falling back to it silently breaks lead
 *              delivery. Requests MUST go through the Cloudflare Worker set via env.
 * @rule        Any string that may contain a Telegram API response body (res.text() result,
 *              caught error messages, etc.) MUST pass through sanitizeTelegramLog() before
 *              being logged. Tokens in logs are a security incident.
 * @rule        This route uses its own route-local rate limiter (5 requests / 15 min / IP).
 *              DO NOT reuse the lifetime-3 tools quota from `@/lib/rateLimiter` here —
 *              that quota must not gate lead delivery. Wiring the tools quota here
 *              caused a 7-day zero-leads incident (2026-04-27 to 2026-05-04) because
 *              IPs that hit 3 successful tool runs OR 3 successful leads were
 *              permanently blocked from leads, with CGNAT amplifying the impact across
 *              entire mobile-carrier NAT segments. See ADR [2026-05-04] CRIT-1.
 * @rule        Every lead MUST be persisted via `appendSiteLeadLog()` BEFORE the Telegram
 *              fetch — silent Telegram delivery failures (rate-limit, network drop, group
 *              deleted) used to lose leads without trace. By analogy with bot's
 *              `appendLeadLog` (ADR [2026-04-25] Б-15).
 * @rule        This rate limiter relies on single-process invariant (PM2 `instances: 1`
 *              for the `jckauto` process). If site is ever scaled to multiple instances,
 *              replace the in-memory Map with a shared store (Redis or file lock).
 * @rule        Telegram fetch is retried ONCE on AbortError or network error. Per-attempt
 *              timeout is 6s; total worst case ~13s (6 + 800ms backoff + 6). Cloudflare
 *              Worker `tg-proxy` has empirically observed 20% timeout rate (5-curl test
 *              2026-05-04). Retry drops effective failure rate to ~4%. If retry also
 *              fails, return 502 as before. See ADR [2026-05-04] SALES-CRIT-2.
 * @lastModified 2026-05-04
 */
import { NextResponse } from "next/server";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { CONTACTS } from "@/lib/constants";

// ─── CONSTANTS ─────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const TG_API_BASE = process.env.TELEGRAM_API_BASE_URL;

const STORAGE_PATH = process.env.STORAGE_PATH || "/var/www/jckauto/storage";
const SITE_LEADS_LOG_PATH = join(STORAGE_PATH, "leads", "site-leads.log");

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 5;

const TG_FETCH_TIMEOUT_MS = 6000;       // per-attempt timeout
const TG_FETCH_RETRY_BACKOFF_MS = 800;  // wait before second attempt

// ─── RATE LIMIT (route-local) ──────────────────────────────────────────

// @rule This Map is per-process state. Single-process invariant — PM2
// jckauto is `instances: 1`. Multi-instance scaling requires shared
// store (Redis or file lock). See ADR [2026-05-04] CRIT-1.
const leadRateBuckets: Map<string, number[]> = new Map();

function checkLeadRateLimit(
  ip: string,
): { allowed: true } | { allowed: false; resetInSec: number } {
  const now = Date.now();
  const bucket = leadRateBuckets.get(ip) ?? [];
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = bucket.filter((ts) => ts > cutoff);
  if (recent.length !== bucket.length) {
    leadRateBuckets.set(ip, recent);
  }
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = recent[0];
    const resetInSec = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, resetInSec };
  }
  return { allowed: true };
}

function recordLeadAttempt(ip: string): void {
  const bucket = leadRateBuckets.get(ip) ?? [];
  bucket.push(Date.now());
  leadRateBuckets.set(ip, bucket);
}

// ─── AUDIT LOG ─────────────────────────────────────────────────────────

interface SiteLeadLogEntry {
  ip: string;
  source: string;
  subject: string | null;
  name: string | null;
  phone: string;
  message: string | null;
  telegramDelivered: boolean;
}

/**
 * Append-only audit trail of every site lead attempt — one JSON line per
 * call. Persisted at `${STORAGE_PATH}/leads/site-leads.log`. Independent
 * of Telegram delivery: written BEFORE the fetch, so a Telegram-side
 * failure (rate-limit, network drop, group deleted) is still recorded.
 *
 * @see ADR [2026-05-04] CRIT-1, ADR [2026-04-25] Б-15 (bot analog)
 */
// @rule Fail-open. Any FS error (missing dir, EACCES, EROFS, disk full)
// is caught, logged to stderr, and swallowed — the route continues.
// Monitoring code that crashes the thing it monitors is worse than no
// monitoring (same rationale as bot's appendLeadLog and cronAlert.ts).
function appendSiteLeadLog(entry: SiteLeadLogEntry): void {
  try {
    const dir = dirname(SITE_LEADS_LOG_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n";
    appendFileSync(SITE_LEADS_LOG_PATH, line, "utf-8");
  } catch (err) {
    console.error(
      "[lead] appendSiteLeadLog failed (swallowed):",
      err instanceof Error ? err.message : err,
    );
  }
}

// ─── HELPERS ───────────────────────────────────────────────────────────

/**
 * Mask Telegram bot tokens in arbitrary strings before logging.
 * Telegram bot tokens have the format `<numeric_bot_id>:<35+ char token>`,
 * and appear in error bodies when the API echoes back request URLs like
 * `/bot<TOKEN>/sendMessage`. This helper handles both the `/bot<TOKEN>/`
 * path form and bare token occurrences.
 * @rule NEVER log response bodies from Telegram API without passing them
 *       through this helper. Tokens in logs are a security incident even
 *       if logs are currently VDS-local — a future Sentry/centralized-log
 *       integration would leak them retroactively.
 */
function sanitizeTelegramLog(s: string): string {
  // Match /bot<digits>:<token_chars>/ (full path form) AND bare <digits>:<token_chars>
  // Token chars include A-Z, a-z, 0-9, underscore, hyphen. At least 20 chars after
  // the colon — real Telegram tokens are 35+ chars, this lower bound just avoids
  // over-matching random `NUM:WORD` patterns in error messages.
  return s.replace(/\d{6,}:[A-Za-z0-9_-]{20,}/g, "***");
}

function getClientIp(request: Request): string {
  return (
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function lastFour(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-4);
}

/**
 * Send a single sendMessage POST to the Worker with a per-attempt timeout.
 * Returns the Response on any HTTP outcome (including non-2xx). Throws
 * only on AbortError (timeout) or network error (DNS, TLS, connection
 * reset). Caller decides whether to retry based on thrown error vs
 * non-ok Response.
 *
 * @rule Each call gets its OWN AbortSignal — do NOT reuse across retries.
 *       AbortSignal.timeout() fires once and cannot be reset.
 */
async function sendTelegramOnce(
  apiUrl: string,
  payload: { chat_id: string; text: string },
): Promise<Response> {
  return fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TG_FETCH_TIMEOUT_MS),
  });
}

// ─── ROUTE — POST ──────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Некорректный формат запроса" },
        { status: 400 },
      );
    }
    const { name, phone, message, source, subject } = body ?? {};

    const ip = getClientIp(request);

    // Rate limit (route-local — NOT @/lib/rateLimiter)
    const rl = checkLeadRateLimit(ip);
    if (!rl.allowed) {
      console.warn(`[lead] rate-limited ip=${ip} resetInSec=${rl.resetInSec}`);
      return NextResponse.json(
        {
          error: `Слишком много запросов. Попробуйте позже или позвоните нам напрямую: ${CONTACTS.phone}`,
        },
        { status: 429 },
      );
    }

    // Phone validation
    if (!phone) {
      return NextResponse.json(
        { error: "phone обязателен" },
        { status: 400 },
      );
    }
    const cleanPhone = String(phone).replace(/[^\d\s\+\-\(\)]/g, "");
    const digits = cleanPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      return NextResponse.json(
        { error: "Некорректный номер телефона" },
        { status: 400 },
      );
    }

    // Sanitize fields
    const safeName = name ? String(name).slice(0, 100) : undefined;
    const safeMessage = message
      ? String(message).slice(0, 1000) +
        (String(message).length > 1000 ? " [truncated]" : "")
      : undefined;
    const safeSubject = subject ? String(subject).slice(0, 200) : undefined;

    // Env check
    if (!BOT_TOKEN || !GROUP_CHAT_ID || !TG_API_BASE) {
      const missing = [
        !BOT_TOKEN && "TELEGRAM_BOT_TOKEN",
        !GROUP_CHAT_ID && "TELEGRAM_GROUP_CHAT_ID",
        !TG_API_BASE && "TELEGRAM_API_BASE_URL",
      ]
        .filter(Boolean)
        .join(", ");
      console.error(`[lead] Missing required env: ${missing}`);
      return NextResponse.json(
        { error: `Сервис временно недоступен. Позвоните нам напрямую: ${CONTACTS.phone}` },
        { status: 503 },
      );
    }

    // Record rate-limit attempt and write pre-send audit log BEFORE Telegram fetch.
    // Two log lines per successful lead by design — pre-send guarantees the
    // "lead existed" record irrespective of Telegram outcome.
    recordLeadAttempt(ip);
    const baseLogEntry: Omit<SiteLeadLogEntry, "telegramDelivered"> = {
      ip,
      source: source || "сайт jckauto.ru",
      subject: safeSubject ?? null,
      name: safeName ?? null,
      phone: cleanPhone,
      message: safeMessage ?? null,
    };
    appendSiteLeadLog({ ...baseLogEntry, telegramDelivered: false });

    // Telegram send
    const text = [
      "\u{1F514} Новая заявка с сайта!",
      "",
      safeName ? `\u{1F464} Имя: ${safeName}` : "",
      `\u{1F4F1} Телефон: ${cleanPhone}`,
      safeSubject ? `\u{1F4CC} Тема: ${safeSubject}` : "",
      safeMessage ? `\u{1F4AC} Сообщение: ${safeMessage}` : "",
      "",
      `Источник: ${source || "сайт jckauto.ru"}`,
    ]
      .filter(Boolean)
      .join("\n");

    const apiUrl = `${TG_API_BASE}/bot${BOT_TOKEN}/sendMessage`;
    const payload = { chat_id: GROUP_CHAT_ID, text };
    let attemptedRetry = false;
    let res: Response;
    try {
      res = await sendTelegramOnce(apiUrl, payload);
    } catch (firstErr) {
      const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      console.warn(`[lead] telegram-attempt-1 failed (retrying): ${errMsg}`);
      attemptedRetry = true;
      await new Promise((r) => setTimeout(r, TG_FETCH_RETRY_BACKOFF_MS));
      // Second attempt — if it also throws, the throw propagates to the
      // outer try/catch and returns 500 (pre-CRIT-2 behaviour for total
      // Worker outage).
      res = await sendTelegramOnce(apiUrl, payload);
    }

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "<no body>");
      const sanitized = sanitizeTelegramLog(rawBody).slice(0, 200);
      console.error(`[lead] Telegram API error: status=${res.status} body=${sanitized}`);
      console.error(`[lead] telegram-failed ip=${ip} source=${baseLogEntry.source}`);
      return NextResponse.json(
        { error: `Не удалось отправить заявку. Позвоните нам напрямую: ${CONTACTS.phone}` },
        { status: 502 },
      );
    }

    // Success — append second log line confirming delivery.
    appendSiteLeadLog({ ...baseLogEntry, telegramDelivered: true });
    console.log(
      `[lead] success ip=${ip} source=${baseLogEntry.source} phone_last4=${lastFour(cleanPhone)}${attemptedRetry ? " (after-retry)" : ""}`,
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[lead] API error: ${err?.message || err}`);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 },
    );
  }
}
