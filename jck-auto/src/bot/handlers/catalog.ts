import TelegramBot from "node-telegram-bot-api";
import { readCatalogJson } from "../../lib/blobStorage";

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
        [{ text: "Подробнее на сайте", url: `https://jckauto.ru/catalog/${car.id}` }],
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

export function registerCatalogHandler(bot: TelegramBot) {
  bot.onText(/\/catalog/, async (msg) => {
    await handleCatalogCommand(bot, msg.chat.id);
  });
}
