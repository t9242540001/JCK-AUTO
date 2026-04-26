/**
 * @file        request.ts
 * @description Telegram bot "Оставить заявку" flow — collects phone
 *              number via reply keyboard, forwards lead to the
 *              group chat.
 * @dependencies ../store/users (ensureUsersLoaded, getUser, savePhone)
 * @rule        handleRequestCommand MUST await ensureUsersLoaded()
 *              before calling getUser — otherwise on bot restart the
 *              in-memory user map is empty and users who tap an old
 *              inline button without first typing /start hit the
 *              "Нажмите /start" fallback even though they are
 *              registered. See Б-9 in knowledge/bugs.md and the
 *              2026-04-21 ADR in knowledge/decisions.md.
 * @rule        Phone validity is checked via normalizePhone()/hasValidPhone() — NEVER bare truthy on user.phone (Б-6 incident: legacy "+7" / " " / "" garbage reached operator group). See ADR [2026-04-25] Б-6 closed.
 * @lastModified 2026-04-25
 */
import TelegramBot from "node-telegram-bot-api";
import { ensureUsersLoaded, getUser, savePhone, type BotUser } from "../store/users";

/**
 * Normalises a phone-like input into a 10–15 digit string (E.164 range,
 * country code optional). Returns `null` for any input that fails the
 * structural check — including `null`, `undefined`, empty/whitespace
 * strings, strings whose digit-count is outside [10, 15], and strings
 * that contain no digits at all. Does NOT verify the number is real or
 * reachable; that requires a third-party lookup (Twilio, Numverify) and
 * is intentionally out of scope.
 *
 * @see ADR [2026-04-25] Б-6 closed — phone validation single source of truth
 */
// @rule This is the SINGLE truth source for phone validity in the bot
// lead flow. Every entry point (handleRequestCommand truthy check,
// bot.on("contact") Telegram payload, bot.on("message") manual digits,
// future "submit without phone" fallback) MUST go through this helper.
// Adding any new code path that compares `user.phone` directly is a
// regression of Б-6.
function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/**
 * Convenience wrapper: returns `true` iff `user.phone` passes
 * `normalizePhone`. Use this in place of bare `if (user.phone)` checks.
 */
function hasValidPhone(user: BotUser): boolean {
  return normalizePhone(user.phone) !== null;
}

export const pendingSource = new Map<number, string>();
export const pendingPhone = new Set<number>();

function finishRequest(bot: TelegramBot, groupChatId: string, user: BotUser, source?: string) {
  const username = user.username ? `@${user.username}` : "не указан";

  const text = [
    "\u{1F697} Новая заявка!",
    "",
    `\u{1F464} Имя: ${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`,
    `\u{1F4E8} Username: ${username}`,
    `\u{1F4F1} Телефон: ${user.phone || "не указан"}`,
    `\u{1F517} Источник: ${source || "Telegram-бот (прямая заявка)"}`,
    "",
    "Источник: Telegram-бот",
  ].join("\n");

  bot.sendMessage(groupChatId, text).catch((err) => {
    console.error("Failed to send lead to group:", err);
  });
}

export async function handleRequestCommand(bot: TelegramBot, chatId: number, groupChatId: string): Promise<void> {
  await ensureUsersLoaded();
  const user = getUser(chatId);

  if (!user) {
    bot.sendMessage(chatId, "Нажмите /start чтобы начать.");
    return;
  }

  // If phone is already known — finish immediately
  if (hasValidPhone(user)) {
    const carName = pendingSource.get(chatId);
    pendingSource.delete(chatId);
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

  // Ask for phone
  pendingPhone.add(chatId);
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
    void handleRequestCommand(bot, query.message.chat.id, groupChatId);
  });

  bot.on("contact", async (msg) => {
    if (!msg.contact || !msg.from) return;
    const chatId = msg.chat.id;
    pendingPhone.delete(chatId);
    const normalized = normalizePhone(msg.contact.phone_number);
    if (!normalized) {
      // @rule Telegram clients have been observed returning empty or
      // malformed phone_number in shared-contact payloads. Reject and
      // re-prompt rather than saving garbage. See ADR [2026-04-25].
      pendingPhone.add(chatId);
      bot.sendMessage(
        chatId,
        "Не удалось прочитать номер. Пожалуйста, введите его в формате +7 999 123 45 67 или нажмите «📱 Поделиться номером» ещё раз.",
      );
      return;
    }
    await savePhone(msg.from.id, normalized);

    const user = getUser(msg.from.id);
    if (!user) return;

    const source = pendingSource.get(chatId);
    pendingSource.delete(chatId);
    finishRequest(bot, groupChatId, user, source);

    bot.sendMessage(chatId, "\u2705 Заявка принята! Менеджер свяжется с вами.", {
      reply_markup: {
        keyboard: [[{ text: "\u{1F3E0} Главное меню" }]],
        resize_keyboard: true,
        persistent: true,
      },
    });
  });

  bot.on("message", async (msg) => {
    if (!msg.text || !msg.from) return;
    const chatId = msg.chat.id;
    if (!pendingPhone.has(chatId)) return;

    // Skip the cancel button — handled by its own onText listener below.
    if (msg.text.startsWith("\u2B05\uFE0F")) return;

    const normalized = normalizePhone(msg.text);
    if (!normalized) {
      bot.sendMessage(
        chatId,
        "Это не похоже на телефон. Введите номер в формате +7 999 123 45 67 или нажмите «📱 Поделиться номером».",
      );
      return;
    }

    pendingPhone.delete(chatId);
    await savePhone(msg.from.id, normalized);
    const user = getUser(msg.from.id);
    if (!user) {
      // @rule Silent exit here previously lost the lead without trace
      // (Б-6 EP-4). User saw the previous "введите номер" hint and then
      // nothing. Tell them the session is broken and re-route to /start
      // so they can recover instead of waiting for a reply that never
      // comes. See ADR [2026-04-25] Б-6 closed.
      console.error("[request] phone saved but getUser returned undefined", { telegramUserId: msg.from.id });
      bot.sendMessage(
        chatId,
        "Что-то пошло не так. Пожалуйста, нажмите /start и попробуйте снова.",
      );
      return;
    }
    const source = pendingSource.get(chatId) || "Telegram-бот (прямая заявка)";
    pendingSource.delete(chatId);
    finishRequest(bot, groupChatId, user, source);
    bot.sendMessage(chatId, "✅ Заявка принята! Менеджер свяжется с вами.", {
      reply_markup: {
        keyboard: [[{ text: "🏠 Главное меню" }]],
        resize_keyboard: true,
        persistent: true,
      },
    });
  });

  bot.onText(/\u2B05\uFE0F Отмена/, (msg) => {
    pendingSource.delete(msg.chat.id);
    pendingPhone.delete(msg.chat.id);
    bot.sendMessage(msg.chat.id, "Заявка отменена.", {
      reply_markup: {
        keyboard: [[{ text: "\u{1F3E0} Главное меню" }]],
        resize_keyboard: true,
        persistent: true,
      },
    });
  });
}
