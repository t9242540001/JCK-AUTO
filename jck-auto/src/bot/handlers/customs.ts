/**
 * @file        customs.ts
 * @description Telegram bot /customs command — interactive customs-only cost calculator.
 *              Asks country (for currency), price, volume, power, age.
 *              Calls calculateTotal() with country:undefined to exclude delivery/fixed costs.
 *              Shows only customs charges: processingFee + ETS/duty + recycling.
 * @rule        Rate label: "Ориентировочный курс", never "Курс ЦБ РФ"
 * @rule        All callback_data use "cust_" prefix — never "calc_"
 * @rule        checkBotLimit BEFORE any API call; recordBotUsage AFTER successful send
 * @lastModified 2026-04-27
 */

import TelegramBot from "node-telegram-bot-api";
import { calculateTotal, formatPrice, type CalcInput, type CarAge } from "../../lib/calculator";
import { fetchCBRRates, COUNTRY_CURRENCY } from "../../lib/currencyRates";
import { checkBotLimit, recordBotUsage, getBotLimitMessage } from "../../lib/botRateLimiter";
import { incrementCommand } from "../store/botStats";
import { siteRequestAndAgainButtons } from "../lib/inlineKeyboards";
import { pendingSource } from "./request";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Country = "china" | "korea" | "japan";

interface CustState {
  step: "country" | "price" | "volume" | "power" | "age";
  data: {
    country?: Country;
    priceInCurrency?: number;
    engineVolume?: number;
    enginePower?: number;
    carAge?: CarAge;
  };
  telegramId: string;
}

// ─── SESSION STORE ────────────────────────────────────────────────────────────

const sessions = new Map<number, CustState>();

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

function startCustoms(bot: TelegramBot, chatId: number, telegramId: string): void {
  const limit = checkBotLimit(telegramId, "calc");
  if (!limit.allowed) {
    bot.sendMessage(chatId, getBotLimitMessage(limit));
    return;
  }

  sessions.set(chatId, { step: "country", data: {}, telegramId });

  bot.sendMessage(chatId, "Из какой страны автомобиль?", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Китай \u{1F1E8}\u{1F1F3}", callback_data: "cust_country_china" },
          { text: "Корея \u{1F1F0}\u{1F1F7}", callback_data: "cust_country_korea" },
          { text: "Япония \u{1F1EF}\u{1F1F5}", callback_data: "cust_country_japan" },
        ],
      ],
    },
  });
}

// ─── RESULT BUILDER ───────────────────────────────────────────────────────────

async function finishCustoms(bot: TelegramBot, chatId: number, state: CustState): Promise<void> {
  sessions.delete(chatId);

  const country = state.data.country!;
  const curr = COUNTRY_CURRENCY[country];

  // country: undefined — excludes delivery/fixed costs from calculateTotal()
  const input: CalcInput = {
    country: undefined,
    currencyCode: curr.code,
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

    // breakdown[0] is always "Автомобиль" — skip it for customs-only view
    const customsOnlyTotal = result.totalRub - result.carPriceRub;

    const lines: string[] = [
      "\u{1F4CB} Таможенные расходы",
      "",
    ];

    for (const item of result.breakdown.slice(1)) {
      lines.push(`${item.label}: ${formatPrice(item.value)}`);
    }

    lines.push("");
    lines.push(`\u{1F4B0} Итого таможенных расходов: \u2248 ${formatPrice(customsOnlyTotal)}`);
    lines.push("");
    lines.push(
      `Ориентировочный курс: 1 ${curr.code} \u2248 ${result.currencyRate.rate.toFixed(curr.code === "KRW" ? 4 : 2)} \u20BD`,
    );
    lines.push("");
    lines.push(
      "Расчёт ориентировочный. Реальные расходы уточняются при оформлении — ставки могут измениться.",
    );

    pendingSource.set(chatId, `Telegram-бот: расчёт таможни (${curr.label})`);
    await bot.sendMessage(chatId, lines.join("\n"), {
      reply_markup: siteRequestAndAgainButtons(
        "https://jckauto.ru/tools/customs",
        "cust_again",
      ),
    });

    recordBotUsage(state.telegramId, "calc");
    incrementCommand('customs');
  } catch (err) {
    console.error("[customs] calculation error:", err);
    bot.sendMessage(
      chatId,
      "Произошла ошибка при расчёте. Попробуйте позже или свяжитесь с менеджером /contact",
    );
  }
}

// ─── HANDLER REGISTRATION ─────────────────────────────────────────────────────

export function registerCustomsHandler(bot: TelegramBot): void {
  // Command entry point
  bot.onText(/\/customs/, (msg) => {
    const telegramId = String(msg.from?.id ?? msg.chat.id);
    startCustoms(bot, msg.chat.id, telegramId);
  });

  // Callback queries (all use "cust_" prefix)
  bot.on("callback_query", (query) => {
    if (!query.data || !query.message) return;
    const chatId = query.message.chat.id;

    // Start customs calculator from /start menu
    if (query.data === "customs_start") {
      bot.answerCallbackQuery(query.id);
      const telegramId = String(query.from.id);
      startCustoms(bot, chatId, telegramId);
      return;
    }

    // Country selection
    if (query.data.startsWith("cust_country_")) {
      bot.answerCallbackQuery(query.id);
      const country = query.data.replace("cust_country_", "") as Country;
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
    if (query.data.startsWith("cust_age_")) {
      bot.answerCallbackQuery(query.id);
      const age = query.data.replace("cust_age_", "") as CarAge;
      const state = sessions.get(chatId);
      if (!state) return;

      state.data.carAge = age;
      finishCustoms(bot, chatId, state);
      return;
    }

    // "Calculate again" button
    if (query.data === "cust_again") {
      bot.answerCallbackQuery(query.id);
      const telegramId = String(query.from?.id ?? chatId);
      startCustoms(bot, chatId, telegramId);
      return;
    }
  });

  // Text input handler for multi-step session
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
              { text: "Новый (до 3 лет)", callback_data: "cust_age_under3" },
              { text: "3\u20135 лет", callback_data: "cust_age_3to5" },
            ],
            [
              { text: "5\u20137 лет", callback_data: "cust_age_5to7" },
              { text: "Старше 7 лет", callback_data: "cust_age_over7" },
            ],
          ],
        },
      });
      return;
    }
  });
}
