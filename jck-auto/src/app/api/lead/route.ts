import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, message, source } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: "name и phone обязательны" },
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
      `\u{1F464} Имя: ${name}`,
      `\u{1F4F1} Телефон: ${phone}`,
      message ? `\u{1F4AC} Сообщение: ${message}` : "",
      "",
      `Источник: ${source || "сайт jckauto.ru"}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: GROUP_CHAT_ID,
          text,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Telegram API error:", err);
      return NextResponse.json(
        { error: "Не удалось отправить заявку" },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Lead API error:", err);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 },
    );
  }
}
