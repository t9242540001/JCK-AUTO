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
 * @rule        Submit-without-phone fallback requires Telegram @username — without it, no completion path. See ADR [2026-04-25] Б-6/2 — submit-without-phone fallback.
 * @rule        Every lead attempt MUST be persisted via appendLeadLog() BEFORE bot.sendMessage to the operator group — silent delivery failures (Telegram rate-limit, network drop) used to lose leads without trace. See ADR [2026-04-25] Б-15 closed — lead audit log.
 * @lastModified 2026-04-25
 */
import TelegramBot from "node-telegram-bot-api";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
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

const STORAGE_PATH = process.env.STORAGE_PATH || "/var/www/jckauto/storage";
const LEADS_LOG_PATH = join(STORAGE_PATH, "leads", "leads.log");

interface LeadLogEntry {
  telegramUserId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  source: string;
  withoutPhone: boolean;
}

/**
 * Append-only audit trail of every lead attempt — one JSON line per
 * call. Persisted at `${STORAGE_PATH}/leads/leads.log` (default
 * `/var/www/jckauto/storage/leads/leads.log`). Independent of the
 * group-chat delivery path: written BEFORE `bot.sendMessage`, so a
 * Telegram-side delivery failure (rate-limit, network drop, group
 * deleted) is still recorded.
 *
 * @see ADR [2026-04-25] Б-15 closed — lead audit log
 */
// @rule Fail-open. Any FS error (missing dir, EACCES, EROFS, disk
// full) is caught, logged to stderr, and swallowed — the bot
// continues. Monitoring code that crashes the thing it monitors
// is worse than no monitoring (same rationale as cronAlert.ts).
function appendLeadLog(entry: LeadLogEntry): void {
  try {
    const dir = dirname(LEADS_LOG_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n";
    appendFileSync(LEADS_LOG_PATH, line, "utf-8");
  } catch (err) {
    console.error("[request] appendLeadLog failed (swallowed):", err instanceof Error ? err.message : err);
  }
}

export const pendingSource = new Map<number, string>();
export const pendingPhone = new Set<number>();

function finishRequest(
  bot: TelegramBot,
  groupChatId: string,
  user: BotUser,
  source?: string,
  options?: { withoutPhone?: boolean },
) {
  const username = user.username ? `@${user.username}` : "не указан";
  const withoutPhone = options?.withoutPhone === true;

  // @rule When withoutPhone is true, the contact-line is REPLACED (not
  // augmented) — the manager must see at a glance that no phone is
  // available. The "⚠️ Заявка без телефона" banner goes at the very
  // top so it's visible in group-chat preview snippets too. See ADR
  // [2026-04-25] Б-6/2 — submit-without-phone fallback.
  const lines: string[] = [];
  if (withoutPhone) {
    lines.push("\u26A0\uFE0F Заявка без телефона");
    lines.push("");
  }
  lines.push("\u{1F697} Новая заявка!");
  lines.push("");
  lines.push(`\u{1F464} Имя: ${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`);
  lines.push(`\u{1F4E8} Username: ${username}`);
  if (withoutPhone) {
    lines.push(`\u{1F4E8} Связь: ${username} (без телефона)`);
  } else {
    lines.push(`\u{1F4F1} Телефон: ${user.phone || "не указан"}`);
  }
  lines.push(`\u{1F517} Источник: ${source || "Telegram-бот (прямая заявка)"}`);
  lines.push("");
  lines.push("Источник: Telegram-бот");

  const text = lines.join("\n");

  // @rule Audit log goes BEFORE sendMessage — the lead attempt is
  // recorded even if Telegram delivery fails. See ADR [2026-04-25]
  // Б-15 closed — lead audit log.
  appendLeadLog({
    telegramUserId: user.id,
    username: user.username ?? null,
    firstName: user.firstName,
    lastName: user.lastName ?? null,
    phone: withoutPhone ? null : (user.phone ?? null),
    source: source || "Telegram-бот (прямая заявка)",
    withoutPhone,
  });

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
    `${user.firstName}, чтобы менеджер связался с вами — поделитесь номером телефона. Или нажмите «📝 Без телефона», если хотите общаться через Telegram:`,
    {
      reply_markup: {
        keyboard: [
          [{ text: "\u{1F4F1} Поделиться номером", request_contact: true }],
          [{ text: "\u{1F4DD} Без телефона (через Telegram)" }],
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

    // Skip cancel and without-phone buttons — both are handled by their
    // own onText listeners below. Without this skip, the message-handler
    // would race against the onText listener and reject the button text
    // as "this is not a phone" before the listener fires.
    if (msg.text.startsWith("\u2B05\uFE0F")) return;
    if (msg.text.startsWith("\u{1F4DD}")) return;

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

  bot.onText(/\u{1F4DD} Без телефона/u, async (msg) => {
    if (!msg.from) return;
    const chatId = msg.chat.id;

    // @rule Without-phone path REQUIRES @username on Telegram. If the
    // user has none, the operator group has no way to contact them
    // (they explicitly opted out of providing a phone). Refuse cleanly
    // with instructions, do NOT send a lead with "Связь: не указан".
    // See ADR [2026-04-25] Б-6/2 — submit-without-phone fallback.
    if (!msg.from.username) {
      bot.sendMessage(
        chatId,
        "Чтобы оставить заявку без номера, у вас должен быть установлен @username в настройках Telegram — иначе мы не сможем с вами связаться.\n\nУстановите @username в настройках Telegram → Edit Profile → Username, затем попробуйте снова. Или нажмите «📱 Поделиться номером», чтобы оставить заявку с телефоном.",
      );
      return;
    }

    await ensureUsersLoaded();
    const user = getUser(msg.from.id);
    if (!user) {
      // Same recovery pattern as the message-handler EP-4 fix in Б-6/1.
      console.error("[request] without-phone tap but getUser returned undefined", { telegramUserId: msg.from.id });
      bot.sendMessage(
        chatId,
        "Что-то пошло не так. Пожалуйста, нажмите /start и попробуйте снова.",
      );
      return;
    }

    pendingPhone.delete(chatId);
    const source = pendingSource.get(chatId) || "Telegram-бот (прямая заявка)";
    pendingSource.delete(chatId);
    finishRequest(bot, groupChatId, user, source, { withoutPhone: true });
    bot.sendMessage(
      chatId,
      "✅ Заявка принята! Менеджер свяжется с вами в Telegram.",
      {
        reply_markup: {
          keyboard: [[{ text: "\u{1F3E0} Главное меню" }]],
          resize_keyboard: true,
          persistent: true,
        },
      },
    );
  });
}
