import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const TG_API_BASE = process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, message, source, subject } = body;

    if (!phone) {
      return NextResponse.json(
        { error: "phone обязателен" },
        { status: 400 },
      );
    }

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
      name ? `\u{1F464} Имя: ${name}` : "",
      `\u{1F4F1} Телефон: ${phone}`,
      subject ? `\u{1F4CC} Тема: ${subject}` : "",
      message ? `\u{1F4AC} Сообщение: ${message}` : "",
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[lead] API error: ${err?.message || err}`);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 },
    );
  }
}
