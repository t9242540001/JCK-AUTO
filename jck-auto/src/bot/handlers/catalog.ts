import TelegramBot from "node-telegram-bot-api";
import { readCatalogJson } from "../../lib/blobStorage";
import { pendingSource, handleRequestCommand } from "./request";

export async function handleCatalogCommand(bot: TelegramBot, chatId: number): Promise<void> {
  try {
    const cars = await readCatalogJson();
    const available = cars.filter((c) => c.priceRub && c.priceRub > 0);

    if (available.length === 0) {
      bot.sendMessage(chatId, "Каталог пока пуст. Загляните позже или напишите менеджеру /contact");
      return;
    }

    const toShow = available.slice(0, 5);

    for (const car of toShow) {
      const caption = [
        `${car.brand} ${car.model} ${car.year}`,
        `${car.engineVolume} л, ${car.power} л.с.`,
        `\u2248 ${car.priceRub!.toLocaleString("ru-RU")} \u20BD`,
      ].join("\n");

      const buttons: TelegramBot.InlineKeyboardButton[][] = [
        [
          { text: "Подробнее на сайте", url: `https://jckauto.ru/catalog/${car.id}` },
          { text: "\u{1F697} Заказать", callback_data: `order_${car.id}` },
        ],
      ];

      if (car.photos.length > 0) {
        bot.sendPhoto(chatId, `https://jckauto.ru${car.photos[0]}`, {
          caption,
          reply_markup: { inline_keyboard: buttons },
        });
      } else {
        bot.sendMessage(chatId, caption, {
          reply_markup: { inline_keyboard: buttons },
        });
      }
    }

    bot.sendMessage(chatId, `Показано ${toShow.length} из ${available.length} авто`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Весь каталог на сайте", url: "https://jckauto.ru/catalog" }],
        ],
      },
    });
  } catch (err) {
    console.error("Catalog error:", err);
    bot.sendMessage(chatId, "Не удалось загрузить каталог. Попробуйте позже.");
  }
}

export function registerCatalogHandler(bot: TelegramBot, groupChatId: string) {
  bot.onText(/\/catalog/, async (msg) => {
    await handleCatalogCommand(bot, msg.chat.id);
  });

  bot.on("callback_query", async (query) => {
    if (!query.data?.startsWith("order_") || !query.message) return;

    bot.answerCallbackQuery(query.id);
    const chatId = query.message.chat.id;
    const carId = query.data.replace("order_", "");

    const cars = await readCatalogJson();
    const car = cars.find((c) => c.id === carId);
    const carName = car ? `${car.brand} ${car.model} ${car.year}` : carId;

    pendingSource.set(chatId, `https://jckauto.ru/catalog/${carId}`);
    handleRequestCommand(bot, chatId, groupChatId);
  });
}
