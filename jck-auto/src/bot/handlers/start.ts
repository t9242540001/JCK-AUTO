/**
 * @file        start.ts
 * @description /start command handler — welcome message, inline keyboard, deep link support.
 *              Deep link pattern: /start web_{source} — sent after Telegram Login Widget auth.
 * @lastModified 2026-04-10
 */

import TelegramBot from "node-telegram-bot-api";
import { handleCatalogCommand } from "./catalog";
import { handleContactCommand } from "./contact";
import { saveUser } from "../store/users";
import { ADMIN_IDS } from "../config";

async function sendStartMessage(bot: TelegramBot, chatId: number, userId?: number) {
  await bot.sendMessage(
    chatId,
    [
      "\u{1F697} Добро пожаловать в JCK AUTO!",
      "",
      "Мы привозим автомобили из Китая, Кореи и Японии под ключ.",
      "",
      "Что я могу:",
      "\u{1F4CA} /calc \u2014 рассчитать стоимость авто под ключ",
      "\u{1F4CB} /catalog \u2014 посмотреть авто в наличии",
      "\u{1F4DE} /contact \u2014 связаться с менеджером",
      "",
      "Или просто напишите марку и модель \u2014 я помогу!",
    ].join("\n"),
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Рассчитать стоимость", callback_data: "calc_start" },
            { text: "Каталог", callback_data: "catalog" },
          ],
          [{ text: "Связаться", callback_data: "contact" }],
          [{
            text: "📤 Поделиться ботом",
            url: "https://t.me/share/url?url=https%3A%2F%2Ft.me%2Fjckauto_help_bot&text=%F0%9F%9A%97%20JCK%20AUTO%20%E2%80%94%20%D0%B0%D0%B2%D1%82%D0%BE%D0%BC%D0%BE%D0%B1%D0%B8%D0%BB%D0%B8%20%D0%B8%D0%B7%20%D0%9A%D0%B8%D1%82%D0%B0%D1%8F%2C%20%D0%9A%D0%BE%D1%80%D0%B5%D0%B8%20%D0%B8%20%D0%AF%D0%BF%D0%BE%D0%BD%D0%B8%D0%B8%20%D0%BF%D0%BE%D0%B4%20%D0%BA%D0%BB%D1%8E%D1%87.%20%D0%91%D0%B5%D1%81%D0%BF%D0%BB%D0%B0%D1%82%D0%BD%D1%8B%D0%B9%20%D0%BA%D0%B0%D0%BB%D1%8C%D0%BA%D1%83%D0%BB%D1%8F%D1%82%D0%BE%D1%80%20%D1%81%D1%82%D0%BE%D0%B8%D0%BC%D0%BE%D1%81%D1%82%D0%B8%20%D0%BF%D0%BE%D0%B4%20%D0%BA%D0%BB%D1%8E%D1%87.",
          }],
        ],
      },
    },
  );

  const isAdmin = userId ? ADMIN_IDS.includes(userId) : false;
  const keyboard: { text: string }[][] = [[{ text: "🏠 Главное меню" }]];
  if (isAdmin) keyboard.push([{ text: "📊 Статистика" }]);
  await bot.sendMessage(chatId, "Выберите действие 👇", {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      persistent: true,
    },
  });
}

export function registerStartHandler(bot: TelegramBot) {
  bot.onText(/\/start/, async (msg) => {
    if (msg.from) await saveUser(msg.from);
    const chatId = msg.chat.id;

    // Deep link from jckauto.ru after Telegram Login Widget auth
    const deepLinkMatch = msg.text?.match(/^\/start web_(.+)/);
    if (deepLinkMatch) {
      if (msg.from) await saveUser(msg.from);
      // @todo: saveUser overwrites users.json without preserving web auth fields
      //   (source, webAuthAt) written by api/auth/telegram/route.ts.
      //   Fix: update saveUser() to merge unknown fields instead of overwriting.
      try {
        await bot.sendMessage(chatId, [
          '✅ Вы авторизовались через jckauto.ru.',
          '',
          'Теперь у вас 10 запросов в день на инструментах сайта.',
          '',
          'Подпишитесь на наш канал — там актуальные авто, цены и новости рынка:',
        ].join('\n'), {
          reply_markup: {
            inline_keyboard: [[
              {
                text: '📢 Подписаться на канал',
                url: 'https://t.me/jckauto_import_koreya',
              },
            ]],
          },
        });
      } catch (err) {
        console.error('[start] deep link welcome error:', err);
        bot.sendMessage(chatId, 'Добро пожаловать! Авторизация через сайт прошла успешно.');
      }
      return;
    }

    try {
      bot.sendChatAction(chatId, "typing");
      await sendStartMessage(bot, chatId, msg.from?.id);
    } catch (err) {
      console.error("Start command error:", err);
      bot.sendMessage(chatId, "Произошла ошибка. Попробуйте /start");
    }
  });

  bot.onText(/Главное меню/, async (msg) => {
    if (msg.from) await saveUser(msg.from);
    const chatId = msg.chat.id;
    try {
      bot.sendChatAction(chatId, "typing");
      await sendStartMessage(bot, chatId, msg.from?.id);
    } catch (err) {
      console.error("Main menu error:", err);
      bot.sendMessage(chatId, "Произошла ошибка. Попробуйте /start");
    }
  });

  bot.on("callback_query", (query) => {
    if (!query.message) return;
    const chatId = query.message.chat.id;

    if (query.data === "catalog") {
      bot.answerCallbackQuery(query.id);
      handleCatalogCommand(bot, chatId);
    } else if (query.data === "contact") {
      bot.answerCallbackQuery(query.id);
      handleContactCommand(bot, chatId);
    }
  });
}
