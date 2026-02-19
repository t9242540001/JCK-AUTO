import TelegramBot from "node-telegram-bot-api";

export function registerStartHandler(bot: TelegramBot) {
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(
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
  });

  bot.on("callback_query", (query) => {
    if (!query.message) return;
    const chatId = query.message.chat.id;

    if (query.data === "catalog") {
      bot.answerCallbackQuery(query.id);
      bot.emit("text", { ...query.message, chat: { ...query.message.chat, id: chatId }, text: "/catalog" });
    } else if (query.data === "contact") {
      bot.answerCallbackQuery(query.id);
      bot.emit("text", { ...query.message, chat: { ...query.message.chat, id: chatId }, text: "/contact" });
    }
  });
}
