/**
 * @file        start.ts
 * @description /start command handler — welcome message, inline keyboard, deep link support.
 *              Deep link pattern: /start web_{source} — sent after Telegram Login Widget auth.
 * @lastModified 2026-04-27
 */

import TelegramBot from "node-telegram-bot-api";
import { handleCatalogCommand } from "./catalog";
import { handleContactCommand } from "./contact";
import { saveUser } from "../store/users";
import { ADMIN_IDS } from "../config";
import { incrementSource, incrementWebAuth } from "../store/botStats";
import { sendAuctionInstructions, sendEncarInstructions } from "../lib/instructionMessages";

async function sendStartMessage(bot: TelegramBot, chatId: number, userId?: number) {
  await bot.sendMessage(
    chatId,
    [
      "\u{1F697} Добро пожаловать в JCK AUTO!",
      "",
      "Мы привозим автомобили и запчасти из Китая, Кореи и Японии под ключ.",
      "",
      "Выбирайте сервис ниже — или просто напишите марку и модель, я помогу найти.",
    ].join("\n"),
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🚗 Каталог авто", callback_data: "catalog" },
            { text: "🔧 Ноускаты", callback_data: "noscut_info" },
          ],
          [
            { text: "💰 Калькулятор авто", callback_data: "calc_start" },
            { text: "📋 Калькулятор пошлин", callback_data: "customs_start" },
          ],
          [
            { text: "🔍 Аукционный лист", callback_data: "auction_info" },
            { text: "🇰🇷 Анализ Encar", callback_data: "encar_info" },
          ],
          [{ text: "📞 Связаться", callback_data: "contact" }],
          [{
            text: "📤 Поделиться ботом",
            url: `https://t.me/share/url?url=${encodeURIComponent("https://t.me/jckauto_help_bot")}&text=${encodeURIComponent("🚗 JCK AUTO — авто из Кореи, Китая и Японии. Узнай цену под ключ за минуту: калькулятор, каталог, ноускаты, расшифровка аукциона и Encar.")}`,
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
    if (msg.from) saveUser(msg.from);
    const chatId = msg.chat.id;

    // Deep link from jckauto.ru after Telegram Login Widget auth
    const deepLinkMatch = msg.text?.match(/^\/start web_(.+)/);
    if (deepLinkMatch) {
      if (msg.from) saveUser(msg.from);
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
        incrementWebAuth();
        const knownSources = ['web_encar', 'web_auction'] as const;
        const src = `web_${deepLinkMatch[1]}` as string;
        if ((knownSources as readonly string[]).includes(src)) {
          incrementSource(src as 'web_encar' | 'web_auction');
        }
      } catch (err) {
        console.error('[start] deep link welcome error:', err);
        bot.sendMessage(chatId, 'Добро пожаловать! Авторизация через сайт прошла успешно.');
      }
      return;
    }

    try {
      bot.sendChatAction(chatId, "typing");
      await sendStartMessage(bot, chatId, msg.from?.id);
      incrementSource('direct');
    } catch (err) {
      console.error("Start command error:", err);
      bot.sendMessage(chatId, "Произошла ошибка. Попробуйте /start");
    }
  });

  bot.onText(/Главное меню/, async (msg) => {
    if (msg.from) saveUser(msg.from);
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
    } else if (query.data === "noscut_info") {
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(
        chatId,
        [
          "🔧 *Поиск ноускатов*",
          "",
          "Отправьте марку и модель авто — я найду подходящий ноускат в наличии или подберу из доступных вариантов.",
          "",
          "Например: Toyota RAV4, Honda Accord, Nissan X-Trail.",
          "",
          "Можно также использовать команду /noscut <марка модель> для прямого поиска.",
        ].join("\n"),
        { parse_mode: "Markdown" },
      );
    } else if (query.data === "auction_info") {
      bot.answerCallbackQuery(query.id);
      sendAuctionInstructions(bot, chatId);
    } else if (query.data === "encar_info") {
      bot.answerCallbackQuery(query.id);
      sendEncarInstructions(bot, chatId);
    }
  });
}
