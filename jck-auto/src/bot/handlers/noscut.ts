/**
 * @file        noscut.ts
 * @description Telegram bot /noscut command — search noscut catalog by make/model.
 *              Usage: /noscut Toyota RAV4 or /noscut Toyota
 *              Returns up to 5 matching entries with price and request button.
 * @dependencies src/lib/botRateLimiter, /var/www/jckauto/storage/noscut/noscut-catalog.json,
 *              src/bot/lib/inlineKeyboards (noscutResultButtons),
 *              src/bot/handlers/request (pendingSource)
 * @rule        Catalog is loaded once into module-level cache on first call — never re-read per request.
 * @rule        checkBotLimit BEFORE file read and search.
 * @rule        recordBotUsage AFTER successful sendMessage only.
 * @rule        Bot result-message inline keyboards MUST be built via
 *              src/bot/lib/inlineKeyboards.ts helpers. Direct literal
 *              inline_keyboard objects in this file for result messages
 *              are FORBIDDEN. Empty-result branch is the documented
 *              exception — its single-button keyboard stays inline
 *              by helper design.
 * @lastModified 2026-04-28
 */

import fs from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import { checkBotLimit, recordBotUsage, getBotLimitMessage } from '../../lib/botRateLimiter';
import { incrementCommand } from '../store/botStats';
import { noscutResultButtons } from '../lib/inlineKeyboards';
import { pendingSource } from './request';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface NoscutEntry {
  slug: string;
  make: string;
  model: string;
  generation: string;
  yearStart: number;
  yearEnd: number;
  priceFrom: number;
  inStock: boolean;
  components: string[];
}

// ─── AWAITING-QUERY STATE ─────────────────────────────────────────────────────

interface AwaitingState {
  setAt: number; // ms epoch
}

const AWAITING_TTL_MS = 5 * 60 * 1000; // 5 minutes
const awaitingQuery = new Map<number, AwaitingState>();

function isAwaitingValid(state: AwaitingState | undefined): state is AwaitingState {
  if (!state) return false;
  if (Date.now() - state.setAt > AWAITING_TTL_MS) return false;
  return true;
}

// ─── INSTRUCTION + ARM STATE ──────────────────────────────────────────────────

/**
 * Sends the noscut instruction message and arms the awaiting-query state
 * for this chat. After this call, the next plain-text message from the
 * user (within AWAITING_TTL_MS) is consumed by the plain-text branch in
 * `bot.on('message', ...)` below and used as the search query.
 *
 * Used by:
 *   - start.ts callback `noscut_info` (the "🔧 Ноускаты" button in the main inline menu).
 *   - noscut.ts slash-handler `/noscut` without arguments (in this file).
 *
 * @rule This is the ONLY way to start a noscut search from a non-argument
 *       entry point. Sending the instruction text without arming the state
 *       breaks the user flow — bug introduced 2026-04-27 (Б-новый-A 2/6,
 *       commit `c9e2fed`) and fixed by introducing this helper 2026-04-28.
 *       Do NOT inline the instruction text into a callback or slash branch
 *       elsewhere — call this helper instead.
 */
export function sendNoscutInstructions(bot: TelegramBot, chatId: number): void {
  bot.sendMessage(
    chatId,
    [
      "🔧 *Поиск ноускатов*",
      "",
      "Отправьте марку и модель авто — я найду подходящий ноускат в наличии или подберу из доступных вариантов.",
      "",
      "Например: Toyota RAV4, Honda Accord, Nissan X-Trail.",
      "",
      "Можно также использовать команду /noscut <марка модель> для прямого поиска.",
    ].join("\n"),
    { parse_mode: "Markdown" },
  );
  awaitingQuery.set(chatId, { setAt: Date.now() });
}

// ─── CATALOG CACHE ────────────────────────────────────────────────────────────

let catalogCache: NoscutEntry[] | null = null;

function getCatalog(): NoscutEntry[] {
  if (catalogCache) return catalogCache;
  const raw = fs.readFileSync('/var/www/jckauto/storage/noscut/noscut-catalog.json', 'utf-8');
  catalogCache = JSON.parse(raw) as NoscutEntry[];
  return catalogCache;
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────

function searchNoscut(query: string): NoscutEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const catalog = getCatalog();
  return catalog
    .filter(e =>
      e.make.toLowerCase().includes(q) ||
      e.model.toLowerCase().includes(q) ||
      `${e.make} ${e.model}`.toLowerCase().includes(q)
    )
    .slice(0, 5);
}

// ─── FORMATTER ────────────────────────────────────────────────────────────────

function formatResults(entries: NoscutEntry[]): string {
  return entries.map((e, i) => {
    const stock = e.inStock ? '✅ В наличии' : '📦 Под заказ ~30 дней';
    const parts = e.components.join(', ');
    return [
      `${i + 1}. ${e.make} ${e.model} ${e.generation} (${e.yearStart}–${e.yearEnd})`,
      `   От ${e.priceFrom.toLocaleString('ru-RU')} ₽  •  ${stock}`,
      `   Состав: ${parts}`,
    ].join('\n');
  }).join('\n\n');
}

// ─── SOURCE STRING ────────────────────────────────────────────────────────────

/**
 * Builds the `🔗 Источник:` value written into `pendingSource` before
 * sending a result message. Truncates the user query at 50 characters
 * (with a one-character ellipsis) to keep the operator group lead
 * message readable, regardless of input length.
 *
 * @param query — original user query (already trimmed by caller).
 * @param found — true when results were returned, false for empty-result branch.
 */
function buildNoscutSource(query: string, found: boolean): string {
  const truncated = query.length > 50 ? query.slice(0, 50) + '…' : query;
  return `Telegram-бот: ноускаты (запрос: "${truncated}"${found ? '' : ', не найдено'})`;
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

/**
 * Registers the /noscut command handler for catalog search by make/model.
 */
export function registerNoscutHandler(bot: TelegramBot): void {
  bot.onText(/\/noscut(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from?.id ?? chatId);

    // 1. No arguments — show usage hint and arm state
    const query = (match?.[1] ?? '').trim();
    if (!query) {
      sendNoscutInstructions(bot, chatId);
      return;
    }

    // 2. Rate limit check — BEFORE file read and search
    const limitCheck = checkBotLimit(telegramId, 'calc');
    if (!limitCheck.allowed) {
      bot.sendMessage(chatId, getBotLimitMessage(limitCheck));
      return;
    }

    // 3. Search catalog
    let results: NoscutEntry[];
    try {
      results = searchNoscut(query);
    } catch (err) {
      console.error('[noscut] catalog read error:', err);
      bot.sendMessage(chatId, 'Не удалось загрузить каталог. Попробуйте позже.');
      return;
    }

    // 4. No results
    if (results.length === 0) {
      pendingSource.set(chatId, buildNoscutSource(query, false));
      await bot.sendMessage(
        chatId,
        `По запросу «${query}» ноускатов не найдено.\n\nОставьте заявку — менеджер подберёт вариант вручную.`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: 'Оставить заявку', callback_data: 'request_start' },
            ]],
          },
        },
      );
      recordBotUsage(telegramId, 'calc');
      incrementCommand('noscut');
      return;
    }

    // 5. Send results
    const header = results.length === 1
      ? `🔧 Найден 1 вариант по запросу «${query}»:\n\n`
      : `🔧 Найдено ${results.length} вариантов по запросу «${query}»:\n\n`;

    const text = header + formatResults(results);

    pendingSource.set(chatId, buildNoscutSource(query, true));
    await bot.sendMessage(chatId, text, {
      reply_markup: noscutResultButtons(),
    });

    // 6. Record usage AFTER successful send
    recordBotUsage(telegramId, 'calc');
    incrementCommand('noscut');
  });

  bot.on('message', async (msg) => {
    // Filter: must have text, must not be a command, must not be a photo,
    //         must not be an encar.com URL (those are handled elsewhere).
    if (!msg.text) return;
    if (msg.text.startsWith('/')) return;
    if (msg.photo) return;
    if (msg.text.includes('encar.com')) return;

    const chatId = msg.chat.id;
    const state = awaitingQuery.get(chatId);
    if (!isAwaitingValid(state)) {
      // Lazy cleanup of expired state.
      if (state) awaitingQuery.delete(chatId);
      return;
    }

    // State is valid — consume it and run the same search path.
    awaitingQuery.delete(chatId);

    const telegramId = String(msg.from?.id ?? chatId);
    const query = msg.text.trim();

    // Empty trimmed text — silently ignore (don't re-set state, don't reply).
    if (!query) return;

    // Rate limit check (same as the slash-command path).
    const limitCheck = checkBotLimit(telegramId, 'calc');
    if (!limitCheck.allowed) {
      bot.sendMessage(chatId, getBotLimitMessage(limitCheck));
      return;
    }

    // Search.
    let results: NoscutEntry[];
    try {
      results = searchNoscut(query);
    } catch (err) {
      console.error('[noscut] catalog read error:', err);
      bot.sendMessage(chatId, 'Не удалось загрузить каталог. Попробуйте позже.');
      return;
    }

    // No results.
    if (results.length === 0) {
      pendingSource.set(chatId, buildNoscutSource(query, false));
      await bot.sendMessage(
        chatId,
        `По запросу «${query}» ноускатов не найдено.\n\nОставьте заявку — менеджер подберёт вариант вручную.`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: 'Оставить заявку', callback_data: 'request_start' },
            ]],
          },
        },
      );
      recordBotUsage(telegramId, 'calc');
      incrementCommand('noscut');
      return;
    }

    // Send results.
    const header = results.length === 1
      ? `🔧 Найден 1 вариант по запросу «${query}»:\n\n`
      : `🔧 Найдено ${results.length} вариантов по запросу «${query}»:\n\n`;

    const text = header + formatResults(results);

    pendingSource.set(chatId, buildNoscutSource(query, true));
    await bot.sendMessage(chatId, text, {
      reply_markup: noscutResultButtons(),
    });

    recordBotUsage(telegramId, 'calc');
    incrementCommand('noscut');
  });
}
