/**
 * @file        inlineKeyboards.ts
 * @description Shared builders for Telegram inline keyboards used below
 *              result messages produced by bot handlers
 *              (auctionSheet, encar, calculator, customs, noscut).
 *              Single source of truth for button text, ordering, and
 *              callback_data values across the bot surface.
 * @rule        Bot result-message inline keyboards MUST be built by
 *              these helpers. Direct literal `inline_keyboard: [...]`
 *              objects inside `src/bot/handlers/**` for result
 *              messages are FORBIDDEN. Keyboards for navigation and
 *              interactive prompts (e.g. catalog paging, customs
 *              wizard steps) are NOT covered — only terminal result
 *              messages.
 * @rule        `REQUEST_START_CALLBACK` is the canonical callback for
 *              the "Оставить заявку" button. When the bot-side
 *              `request_start` handler is renamed, update this
 *              constant and nothing else needs to change.
 * @lastModified 2026-04-21
 */

/**
 * Canonical callback_data for the "Оставить заявку" button across the bot.
 * Consumers of these helpers do NOT need to know this string — it is
 * captured inside the builders. It is exported only so the bot-level
 * callback handler registration can share the same literal.
 */
export const REQUEST_START_CALLBACK = 'request_start';

/** A single inline button. Shape matches node-telegram-bot-api. */
interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

/** Shape of the `reply_markup` value accepted by `bot.sendMessage`. */
export interface ResultKeyboard {
  inline_keyboard: InlineButton[][];
}

/**
 * Two-button keyboard for AI-analysis result messages.
 * Row 1: "🌐 Подробный отчёт на сайте" → caller-provided siteUrl.
 * Row 2: "Оставить заявку" → REQUEST_START_CALLBACK.
 *
 * Used by: auctionSheet, encar.
 */
export function siteAndRequestButtons(siteUrl: string): ResultKeyboard {
  return {
    inline_keyboard: [
      [{ text: '🌐 Подробный отчёт на сайте', url: siteUrl }],
      [{ text: 'Оставить заявку', callback_data: REQUEST_START_CALLBACK }],
    ],
  };
}

/**
 * Three-button keyboard for calculator-style result messages where
 * the user typically wants either to submit a lead, recalculate, or
 * see the full form on the website.
 * Row 1: "Оставить заявку" + "Рассчитать ещё" (two columns).
 * Row 2: "🌐 Подробный отчёт на сайте" (full width).
 *
 * IMPORTANT: The caller MUST register a callback handler for
 * `againCallback` on the bot instance — this builder does not do that.
 * If no handler is registered, the "Рассчитать ещё" button will do
 * nothing when tapped.
 *
 * Used by: calculator, customs.
 */
export function siteRequestAndAgainButtons(
  siteUrl: string,
  againCallback: string,
): ResultKeyboard {
  return {
    inline_keyboard: [
      [
        { text: 'Оставить заявку', callback_data: REQUEST_START_CALLBACK },
        { text: 'Рассчитать ещё', callback_data: againCallback },
      ],
      [{ text: '🌐 Подробный отчёт на сайте', url: siteUrl }],
    ],
  };
}

/**
 * Two-button keyboard for the noscut selection result.
 * Row 1: "Оставить заявку" → REQUEST_START_CALLBACK.
 * Row 2: "🌐 Каталог ноускатов на сайте" → jckauto.ru/tools/noscut.
 *
 * Distinct from `siteAndRequestButtons` because the secondary action
 * is a catalog, not a "detailed report". URL is fixed — noscut has
 * no per-result URL.
 *
 * Used by: noscut (only when results are present — the empty-result
 * branch keeps its own single-button keyboard).
 */
export function noscutResultButtons(): ResultKeyboard {
  return {
    inline_keyboard: [
      [{ text: 'Оставить заявку', callback_data: REQUEST_START_CALLBACK }],
      [{ text: '🌐 Каталог ноускатов на сайте', url: 'https://jckauto.ru/tools/noscut' }],
    ],
  };
}
