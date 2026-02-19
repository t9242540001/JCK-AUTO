import TelegramBot from "node-telegram-bot-api";
import { handleCatalogCommand } from "./catalog";
import { handleContactCommand } from "./contact";
import { saveUser } from "../store/users";

async function sendStartMessage(bot: TelegramBot, chatId: number) {
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
        ],
      },
    },
  );

  await bot.sendMessage(chatId, "Выберите действие \u{1F447}", {
    reply_markup: {
      keyboard: [[{ text: "\u{1F3E0} Главное меню" }]],
      resize_keyboard: true,
      persistent: true,
    },
  });
}

export function registerStartHandler(bot: TelegramBot) {
  bot.onText(/\/start/, async (msg) => {
    console.log("Received /start from", msg.from?.id, msg.from?.first_name);
    if (msg.from) saveUser(msg.from);
    const chatId = msg.chat.id;
    try {
      bot.sendChatAction(chatId, "typing");
      await sendStartMessage(bot, chatId);
    } catch (err) {
      console.error("Start command error:", err);
      bot.sendMessage(chatId, "Произошла ошибка. Попробуйте /start");
    }
  });

  bot.onText(/Главное меню/, async (msg) => {
    console.log("Received Главное меню from", msg.from?.id);
    if (msg.from) saveUser(msg.from);
    const chatId = msg.chat.id;
    try {
      bot.sendChatAction(chatId, "typing");
      await sendStartMessage(bot, chatId);
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
