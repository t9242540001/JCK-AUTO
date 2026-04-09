import { NextResponse } from "next/server";
import { checkRateLimit, recordUsage } from "@/lib/rateLimiter";
import { CONTACTS } from "@/lib/constants";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const TG_API_BASE = process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org";

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

    if (!BOT_TOKEN || !GROUP_CHAT_ID) {
      console.error("TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_CHAT_ID not configured");
      return NextResponse.json(
        { error: "Сервис временно недоступен" },
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
      const err = await res.text();
      console.error(`[lead] Telegram API error (${TG_API_BASE.replace(/\/\/.*@/, "//***@")}):`, err);
      return NextResponse.json(
        { error: "Не удалось отправить заявку" },
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
