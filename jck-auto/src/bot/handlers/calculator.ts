/**
 * @file calculator.ts
 * @description Telegram bot /calc command — interactive calculator session per chat. Uses fetchCBRRates() to get operational exchange rates (VTB sell + fallback to CBR + markup).
 * @runs VDS (jckauto-bot pm2 process)
 * @rule Rate label MUST say "Ориентировочный курс", not "Курс ЦБ РФ" — the rate already includes bank markup, calling it "ЦБ" misleads customers.
 * @rule Disclaimer text and rate formatting MUST match what the site shows in CalculatorCore.tsx — bot and site are two faces of the same calculator.
 * @lastModified 2026-04-08
 */

import TelegramBot from "node-telegram-bot-api";
import { calculateTotal, formatPrice, type CalcInput, type CarAge } from "../../lib/calculator";
import { fetchCBRRates, COUNTRY_CURRENCY } from "../../lib/currencyRates";

interface CalcState {
  step: "country" | "price" | "volume" | "power" | "age";
  data: Partial<CalcInput>;
}

const sessions = new Map<number, CalcState>();

function startCalc(bot: TelegramBot, chatId: number) {
  sessions.set(chatId, { step: "country", data: {} });

  bot.sendMessage(chatId, "Из какой страны?", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Китай \u{1F1E8}\u{1F1F3}", callback_data: "calc_country_china" },
          { text: "Корея \u{1F1F0}\u{1F1F7}", callback_data: "calc_country_korea" },
          { text: "Япония \u{1F1EF}\u{1F1F5}", callback_data: "calc_country_japan" },
        ],
      ],
    },
  });
}

export function registerCalculatorHandler(bot: TelegramBot) {
  bot.onText(/\/calc/, (msg) => {
    startCalc(bot, msg.chat.id);
  });

  bot.on("callback_query", (query) => {
    if (!query.data || !query.message) return;
    const chatId = query.message.chat.id;

    // Start calculator from /start menu
    if (query.data === "calc_start") {
      bot.answerCallbackQuery(query.id);
      startCalc(bot, chatId);
      return;
    }

    // Country selection
    if (query.data.startsWith("calc_country_")) {
      bot.answerCallbackQuery(query.id);
      const country = query.data.replace("calc_country_", "") as "china" | "korea" | "japan";
      const state = sessions.get(chatId);
      if (!state) return;

      state.data.country = country;
      state.step = "price";

      const curr = COUNTRY_CURRENCY[country];
      bot.sendMessage(
        chatId,
        `Стоимость автомобиля в ${curr.label}ах (${curr.symbol})?\nНапример: 150000`,
      );
      return;
    }

    // Age selection
    if (query.data.startsWith("calc_age_")) {
      bot.answerCallbackQuery(query.id);
      const age = query.data.replace("calc_age_", "") as CarAge;
      const state = sessions.get(chatId);
      if (!state) return;

      state.data.carAge = age;
      finishCalc(bot, chatId, state);
      return;
    }

    // "Calculate again" button
    if (query.data === "calc_again") {
      bot.answerCallbackQuery(query.id);
      startCalc(bot, chatId);
      return;
    }

    // "Leave request" after calc
    if (query.data === "request_start") {
      bot.answerCallbackQuery(query.id);
      // Handled by request handler
      return;
    }
  });

  bot.on("message", (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const chatId = msg.chat.id;
    const state = sessions.get(chatId);
    if (!state) return;

    const num = parseFloat(msg.text.replace(/\s/g, "").replace(",", "."));

    if (state.step === "price") {
      if (isNaN(num) || num <= 0) {
        bot.sendMessage(chatId, "Введите число больше 0");
        return;
      }
      state.data.priceInCurrency = num;
      state.step = "volume";
      bot.sendMessage(chatId, "Объём двигателя в литрах?\nНапример: 1.5");
      return;
    }

    if (state.step === "volume") {
      if (isNaN(num) || num <= 0 || num > 10) {
        bot.sendMessage(chatId, "Введите объём от 0.1 до 10 литров");
        return;
      }
      state.data.engineVolume = Math.round(num * 1000);
      state.step = "power";
      bot.sendMessage(chatId, "Мощность в л.с.?\nНапример: 150");
      return;
    }

    if (state.step === "power") {
      if (isNaN(num) || num <= 0) {
        bot.sendMessage(chatId, "Введите мощность в л.с.");
        return;
      }
      state.data.enginePower = num;
      state.step = "age";
      bot.sendMessage(chatId, "Возраст автомобиля?", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Новый (до 3 лет)", callback_data: "calc_age_under3" },
              { text: "3\u20135 лет", callback_data: "calc_age_3to5" },
            ],
            [
              { text: "5\u20137 лет", callback_data: "calc_age_5to7" },
              { text: "Старше 7 лет", callback_data: "calc_age_over7" },
            ],
          ],
        },
      });
      return;
    }
  });
}

async function finishCalc(bot: TelegramBot, chatId: number, state: CalcState) {
  sessions.delete(chatId);

  const input: CalcInput = {
    country: state.data.country!,
    currencyCode: COUNTRY_CURRENCY[state.data.country!].code,
    priceInCurrency: state.data.priceInCurrency!,
    engineVolume: state.data.engineVolume!,
    enginePower: state.data.enginePower!,
    carAge: state.data.carAge!,
    buyerType: "individual",
    personalUse: true,
  };

  try {
    const rates = await fetchCBRRates();
    const result = calculateTotal(input, rates);

    const curr = COUNTRY_CURRENCY[input.country!];
    const lines = [
      "\u{1F4CA} Расчёт стоимости под ключ",
      "",
    ];

    for (const item of result.breakdown) {
      lines.push(`${item.label}: ${formatPrice(item.value)}`);
    }

    lines.push("");
    lines.push(`\u{1F4B0} Итого под ключ: \u2248 ${formatPrice(result.totalRub)}`);
    lines.push("");
    lines.push(
      `Ориентировочный курс: 1 ${curr.code} \u2248 ${result.currencyRate.rate.toFixed(curr.code === "KRW" ? 4 : 2)} \u20BD`,
    );
    lines.push("");
    lines.push(
      "Расчёт ориентировочный. Реальный курс уточняется при оформлении заявки — он зависит от дня сделки и канала перевода.",
    );

    bot.sendMessage(chatId, lines.join("\n"), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Оставить заявку", callback_data: "request_start" },
            { text: "Рассчитать ещё", callback_data: "calc_again" },
          ],
          [{ text: "На сайт", url: "https://jckauto.ru/tools/calculator" }],
        ],
      },
    });
  } catch (err) {
    console.error("Calculator error:", err);
    bot.sendMessage(
      chatId,
      "Произошла ошибка при расчёте. Попробуйте позже или свяжитесь с менеджером /contact",
    );
  }
}
