/**
 * @file        admin.ts
 * @description Admin-only Telegram bot commands — /stats with users
 *              and bot-stats summary, "Статистика" reply keyboard
 *              button, admin_export callback (list dump), /broadcast
 *              text command. ADMIN_IDS gating on every entry point.
 * @lastModified 2026-04-27
 */

import TelegramBot from "node-telegram-bot-api";
import { getAllUsers, getUsersStats } from "../store/users";
import { ADMIN_IDS } from "../config";
import { getBotStats } from "../store/botStats";
async function sendStats(bot: TelegramBot, chatId: number): Promise<void> {
  const stats = getUsersStats();
  const botStats = getBotStats();
  const text = [
    '📊 Статистика бота JCK AUTO',
    '',
    `👥 Всего пользователей: ${stats.total}`,
    `📱 С телефоном: ${stats.withPhone}`,
    `📅 Новых сегодня: ${stats.today}`,
    `📆 Новых за неделю: ${stats.thisWeek}`,
    '',
    '🤖 Команды (всего запусков):',
    `  /calc — ${botStats.commands.calc}`,
    `  /customs — ${botStats.commands.customs}`,
    `  /catalog — ${botStats.commands.catalog}`,
    `  /noscut — ${botStats.commands.noscut}`,
    `  📷 Аукционный лист — ${botStats.commands.auction}`,
    '',
    `🌐 Авторизаций с сайта: ${botStats.webAuthCount}`,
    `  encar: ${botStats.sources.web_encar}`,
    `  auction: ${botStats.sources.web_auction}`,
    `  direct: ${botStats.sources.direct}`,
  ].join('\n');
  await bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Выгрузить список", callback_data: "admin_export" }],
      ],
    },
  });
}
export function registerAdminHandler(bot: TelegramBot) {
  // /stats command
  bot.onText(/\/stats/, async (msg) => {
    if (!ADMIN_IDS.includes(msg.from?.id ?? 0)) return;
    try {
      await sendStats(bot, msg.chat.id);
    } catch (err) {
      console.error("Stats error:", err);
    }
  });
  // "📊 Статистика" reply keyboard button
  bot.onText(/Статистика/, async (msg) => {
    if (!ADMIN_IDS.includes(msg.from?.id ?? 0)) return;
    try {
      await sendStats(bot, msg.chat.id);
    } catch (err) {
      console.error("Stats button error:", err);
    }
  });
  // Export users list
  bot.on("callback_query", async (query) => {
    if (!query.data || !query.message) return;
    if (!ADMIN_IDS.includes(query.from?.id ?? 0)) return;
    if (query.data === "admin_export") {
      await bot.answerCallbackQuery(query.id);
      const chatId = query.message.chat.id;
      try {
        const users = getAllUsers();
        if (users.length === 0) {
          await bot.sendMessage(chatId, "Пользователей пока нет.");
          return;
        }
        const lines = users.map((u, i) => {
          const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
          const username = u.username ? `@${u.username}` : "—";
          const phone = u.phone ?? "не указан";
          const date = new Date(u.registeredAt).toLocaleDateString("ru-RU");
          return `${i + 1}. ${name} | ${username} | ${phone} | ${date}`;
        });
        // Split by 50 users per message (Telegram 4096 char limit)
        const chunkSize = 50;
        for (let i = 0; i < lines.length; i += chunkSize) {
          await bot.sendMessage(chatId, lines.slice(i, i + chunkSize).join("\n"));
        }
      } catch (err) {
        console.error("Export error:", err);
      }
    }
  });
  // /broadcast — send message to all users
  bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (!ADMIN_IDS.includes(msg.from?.id ?? 0)) return;
    if (!match) return;
    const text = match[1];
    const users = getAllUsers();
    let sent = 0;
    let failed = 0;
    await bot.sendMessage(msg.chat.id, `Начинаю рассылку ${users.length} пользователям...`);
    for (const user of users) {
      try {
        await bot.sendMessage(user.id, text);
        sent++;
        await new Promise((r) => setTimeout(r, 50));
      } catch {
        failed++;
      }
    }
    await bot.sendMessage(
      msg.chat.id,
      `✅ Рассылка завершена\nОтправлено: ${sent}\nОшибок: ${failed}`,
    );
  });
}
