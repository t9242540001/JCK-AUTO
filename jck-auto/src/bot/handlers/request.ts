import TelegramBot from "node-telegram-bot-api";

interface RequestState {
  step: "name" | "phone" | "car";
  name?: string;
  phone?: string;
}

const sessions = new Map<number, RequestState>();

export function registerRequestHandler(bot: TelegramBot, groupChatId: string) {
  function startRequest(chatId: number) {
    sessions.set(chatId, { step: "name" });
    bot.sendMessage(chatId, "Как вас зовут?");
  }

  bot.on("callback_query", (query) => {
    if (!query.data || !query.message) return;
    if (query.data !== "request_start") return;

    bot.answerCallbackQuery(query.id);
    startRequest(query.message.chat.id);
  });

  bot.on("message", (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const chatId = msg.chat.id;
    const state = sessions.get(chatId);
    if (!state) return;

    if (state.step === "name") {
      state.name = msg.text.trim();
      state.step = "phone";
      bot.sendMessage(chatId, "Ваш телефон для связи?");
      return;
    }

    if (state.step === "phone") {
      state.phone = msg.text.trim();
      state.step = "car";
      bot.sendMessage(chatId, "Какой автомобиль интересует?");
      return;
    }

    if (state.step === "car") {
      const carInterest = msg.text.trim();
      sessions.delete(chatId);

      const username = msg.from?.username ? `@${msg.from.username}` : "не указан";

      // Send to manager group
      const groupMessage = [
        "\u{1F514} Новая заявка с Telegram-бота!",
        "",
        `\u{1F464} Имя: ${state.name}`,
        `\u{1F4F1} Телефон: ${state.phone}`,
        `\u{1F697} Интересует: ${carInterest}`,
        `\u{1F4E8} Telegram: ${username}`,
        "",
        "Источник: Telegram-бот",
      ].join("\n");

      bot.sendMessage(groupChatId, groupMessage).catch((err) => {
        console.error("Failed to send lead to group:", err);
      });

      bot.sendMessage(
        chatId,
        "Спасибо! Ваша заявка отправлена. Менеджер свяжется с вами в ближайшее время.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "На главную", callback_data: "back_to_start" }],
            ],
          },
        },
      );
      return;
    }
  });

  bot.on("callback_query", (query) => {
    if (query.data !== "back_to_start" || !query.message) return;
    bot.answerCallbackQuery(query.id);
    const chatId = query.message.chat.id;
    bot.emit("text", { ...query.message, chat: { ...query.message.chat, id: chatId }, text: "/start" });
  });
}
