import { NextResponse } from "next/server";
import { checkRateLimit, recordUsage } from "@/lib/rateLimiter";
import { CONTACTS } from "@/lib/constants";

// @rule All three Telegram env vars (TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_CHAT_ID,
//       TELEGRAM_API_BASE_URL) are REQUIRED. Missing any → log + 503 with fallback phone.
//       Do NOT reintroduce a default for TELEGRAM_API_BASE_URL: the VDS provider
//       blocks direct api.telegram.org, so falling back to it silently breaks lead
//       delivery. Requests MUST go through the Cloudflare Worker set via env.
// @rule Any string that may contain a Telegram API response body (res.text() result,
//       caught error messages, etc.) MUST pass through sanitizeTelegramLog() before
//       being logged. Tokens in logs are a security incident.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const TG_API_BASE = process.env.TELEGRAM_API_BASE_URL;

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, message, source, subject } = body;

    const ip =
      (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const leadKey = `lead:${ip}`;
    const limit = checkRateLimit(leadKey);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Слишком много запросов. Попробуйте позже или позвоните нам напрямую: ${CONTACTS.phone}` },
        { status: 429 },
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: "phone обязателен" },
        { status: 400 },
      );
    }
    const cleanPhone = phone.replace(/[^\d\s\+\-\(\)]/g, "");
    const digits = cleanPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      return NextResponse.json(
        { error: "Некорректный номер телефона" },
        { status: 400 },
      );
    }

    const safeName    = name    ? String(name).slice(0, 100)    : undefined;
    const safeMessage = message ? String(message).slice(0, 1000) + (String(message).length > 1000 ? " [truncated]" : "") : undefined;
    const safeSubject = subject ? String(subject).slice(0, 200)  : undefined;

    if (!BOT_TOKEN || !GROUP_CHAT_ID || !TG_API_BASE) {
      const missing = [
        !BOT_TOKEN && "TELEGRAM_BOT_TOKEN",
        !GROUP_CHAT_ID && "TELEGRAM_GROUP_CHAT_ID",
        !TG_API_BASE && "TELEGRAM_API_BASE_URL",
      ].filter(Boolean).join(", ");
      console.error(`[lead] Missing required env: ${missing}`);
      return NextResponse.json(
        { error: `Сервис временно недоступен. Позвоните нам напрямую: ${CONTACTS.phone}` },
        { status: 503 },
      );
    }

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
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: GROUP_CHAT_ID,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "<no body>");
      const sanitized = sanitizeTelegramLog(rawBody).slice(0, 200);
      console.error(`[lead] Telegram API error: status=${res.status} body=${sanitized}`);
      return NextResponse.json(
        { error: `Не удалось отправить заявку. Позвоните нам напрямую: ${CONTACTS.phone}` },
        { status: 502 },
      );
    }

    recordUsage(leadKey);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[lead] API error: ${err?.message || err}`);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 },
    );
  }
}
