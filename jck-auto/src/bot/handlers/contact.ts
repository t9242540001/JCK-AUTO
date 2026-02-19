import TelegramBot from "node-telegram-bot-api";
import { CONTACTS } from "../../lib/constants";

export function handleContactCommand(bot: TelegramBot, chatId: number): void {
  bot.sendMessage(
    chatId,
    [
      "\u{1F4DE} Свяжитесь с нами:",
      "",
      `Telegram: ${CONTACTS.telegramHandle}`,
      `WhatsApp: ${CONTACTS.phone}`,
      `Телефон: ${CONTACTS.phone}`,
      "",
      "Или оставьте заявку прямо здесь \u2014 нажмите кнопку ниже.",
    ].join("\n"),
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Оставить заявку", callback_data: "request_start" }],
        ],
      },
    },
  );
}

export function registerContactHandler(bot: TelegramBot) {
  bot.onText(/\/contact/, (msg) => {
    handleContactCommand(bot, msg.chat.id);
  });
}
