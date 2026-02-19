import TelegramBot from "node-telegram-bot-api";
import { getUser, savePhone, type BotUser } from "../store/users";

export const pendingCar = new Map<number, string>();

function finishRequest(bot: TelegramBot, groupChatId: string, user: BotUser, carName?: string) {
  const username = user.username ? `@${user.username}` : "не указан";

  const text = [
    "\u{1F697} Новая заявка!",
    "",
    `\u{1F464} Имя: ${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`,
    `\u{1F4E8} Username: ${username}`,
    `\u{1F4F1} Телефон: ${user.phone || "не указан"}`,
    `\u{1F698} Автомобиль: ${carName || "не указан"}`,
    "",
    "Источник: Telegram-бот",
  ].join("\n");

  bot.sendMessage(groupChatId, text).catch((err) => {
    console.error("Failed to send lead to group:", err);
  });
}

export function handleRequestCommand(bot: TelegramBot, chatId: number, groupChatId: string) {
  const user = getUser(chatId);

  if (!user) {
    bot.sendMessage(chatId, "Нажмите /start чтобы начать.");
    return;
  }

  // If phone is already known — finish immediately
  if (user.phone) {
    const carName = pendingCar.get(chatId);
    pendingCar.delete(chatId);
    finishRequest(bot, groupChatId, user, carName);
    bot.sendMessage(chatId, "\u2705 Заявка принята! Менеджер свяжется с вами.", {
      reply_markup: {
        keyboard: [[{ text: "\u{1F3E0} Главное меню" }]],
        resize_keyboard: true,
        persistent: true,
      },
    });
    return;
  }

  // Ask for phone via contact sharing
  bot.sendMessage(
    chatId,
    `${user.firstName}, чтобы менеджер связался с вами — поделитесь номером телефона:`,
    {
      reply_markup: {
        keyboard: [
          [{ text: "\u{1F4F1} Поделиться номером", request_contact: true }],
          [{ text: "\u2B05\uFE0F Отмена" }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    },
  );
}

export function registerRequestHandler(bot: TelegramBot, groupChatId: string) {
  bot.on("callback_query", (query) => {
    if (!query.data || !query.message) return;
    if (query.data !== "request_start") return;

    bot.answerCallbackQuery(query.id);
    handleRequestCommand(bot, query.message.chat.id, groupChatId);
  });

  bot.on("contact", (msg) => {
    if (!msg.contact || !msg.from) return;
    const chatId = msg.chat.id;
    const phone = msg.contact.phone_number;
    savePhone(msg.from.id, phone);

    const user = getUser(msg.from.id);
    if (!user) return;

    const carName = pendingCar.get(chatId);
    pendingCar.delete(chatId);
    finishRequest(bot, groupChatId, user, carName);

    bot.sendMessage(chatId, "\u2705 Заявка принята! Менеджер свяжется с вами.", {
      reply_markup: {
        keyboard: [[{ text: "\u{1F3E0} Главное меню" }]],
        resize_keyboard: true,
        persistent: true,
      },
    });
  });

  bot.onText(/\u2B05\uFE0F Отмена/, (msg) => {
    pendingCar.delete(msg.chat.id);
    bot.sendMessage(msg.chat.id, "Заявка отменена.", {
      reply_markup: {
        keyboard: [[{ text: "\u{1F3E0} Главное меню" }]],
        resize_keyboard: true,
        persistent: true,
      },
    });
  });
}
