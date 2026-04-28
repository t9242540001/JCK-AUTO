/**
 * @file        instructionMessages.ts
 * @description Shared instruction messages for bot tools that have BOTH a
 *              callback entry-point (from inline keyboard in start.ts) AND
 *              a slash-command entry-point (from /auction or /encar). Each
 *              helper sends the SAME Markdown-formatted instruction message
 *              regardless of how the user reached it. Centralizing the text
 *              here prevents drift between the two surfaces.
 * @rule        Auction and encar instruction message texts MUST live here.
 *              Do NOT inline them back into start.ts callback handlers,
 *              into auctionSheet.ts /auction handler, or into encar.ts
 *              /encar handler. That re-creates the drift this module
 *              exists to prevent.
 * @rule        These helpers wrap parse_mode: "Markdown" — callers must NOT
 *              pass their own parse_mode option. If a future change needs a
 *              different rendering mode, change it here for all surfaces at
 *              once.
 * @lastModified 2026-04-27
 */

import TelegramBot from "node-telegram-bot-api";

/**
 * Sends the auction-sheet instruction message to a chat.
 * Used by start.ts callback `auction_info` and auctionSheet.ts /auction handler.
 */
export function sendAuctionInstructions(bot: TelegramBot, chatId: number): void {
  bot.sendMessage(
    chatId,
    [
      "🔍 *Расшифровка аукционного листа*",
      "",
      "Отправьте мне фотографию японского аукционного листа (USS, TAA, HAA, JU и др.) — AI распознает оценку, дефекты, комплектацию и переведёт на русский.",
      "",
      "Поддерживаются JPG, PNG, WebP, HEIC. Размер до 5 МБ.",
      "",
      "Без авторизации — 3 расшифровки за всё время. Через сайт с авторизацией Telegram — 10/день.",
    ].join("\n"),
    { parse_mode: "Markdown" },
  );
}

/**
 * Sends the encar.com analysis instruction message to a chat.
 * Used by start.ts callback `encar_info` and encar.ts /encar handler.
 */
export function sendEncarInstructions(bot: TelegramBot, chatId: number): void {
  bot.sendMessage(
    chatId,
    [
      "🇰🇷 *Анализ авто с Encar.com*",
      "",
      "Отправьте ссылку на автомобиль с encar.com — я подтяну характеристики, цену, фото, состояние и рассчитаю стоимость под ключ до Владивостока.",
      "",
      "Пример ссылки: https://fem.encar.com/cars/detail/12345678",
      "",
      "5 анализов в сутки.",
    ].join("\n"),
    { parse_mode: "Markdown" },
  );
}
