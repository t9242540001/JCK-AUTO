/**
 * @file        syncBotCommands.ts
 * @description Synchronizes Telegram bot's BotFather command list with code
 *              on every bot startup. Source of truth for the command list is
 *              the BOT_COMMANDS array below. Called fire-and-forget from
 *              src/bot/index.ts after handler registration. If setMyCommands
 *              fails (network/Telegram outage), the bot still starts and
 *              works — only the BotFather menu is potentially stale until
 *              the next successful sync.
 * @rule        BOT_COMMANDS array MUST mirror the inline-keyboard layout in
 *              src/bot/handlers/start.ts (sendStartMessage). Adding a new
 *              tool? Update both — array here AND inline-keyboard there.
 *              Missing one of two = inconsistent UX (BotFather menu shows
 *              entry that does nothing, or button works but is invisible
 *              in BotFather menu).
 * @rule        Order in BOT_COMMANDS mirrors the menu reading order
 *              (top-left → top-right → middle-left → ... bottom). /start
 *              stays first; service commands follow in inline-keyboard
 *              row order.
 * @lastModified 2026-04-27
 */

import TelegramBot from "node-telegram-bot-api";

export const BOT_COMMANDS: TelegramBot.BotCommand[] = [
  { command: "start", description: "Главное меню" },
  { command: "catalog", description: "🚗 Каталог авто" },
  { command: "noscut", description: "🔧 Поиск ноускатов" },
  { command: "calc", description: "💰 Калькулятор авто" },
  { command: "customs", description: "📋 Калькулятор пошлин" },
  { command: "auction", description: "🔍 Расшифровать аукционный лист" },
  { command: "encar", description: "🇰🇷 Анализ авто с Encar" },
];

export async function syncBotCommands(bot: TelegramBot): Promise<void> {
  try {
    await bot.setMyCommands(BOT_COMMANDS);
    console.log(`[bot] commands synced with BotFather: ${BOT_COMMANDS.length}`);
  } catch (err) {
    console.error("[bot] failed to sync commands with BotFather:", err);
  }
}
