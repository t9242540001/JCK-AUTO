/**
 * @file        noscut.ts
 * @description Telegram bot /noscut command — search noscut catalog by make/model.
 *              Usage: /noscut Toyota RAV4 or /noscut Toyota
 *              Returns up to 5 matching entries with price and request button.
 * @dependencies src/lib/botRateLimiter, /var/www/jckauto/storage/noscut/noscut-catalog.json
 * @rule        Catalog is loaded once into module-level cache on first call — never re-read per request.
 * @rule        checkBotLimit BEFORE file read and search.
 * @rule        recordBotUsage AFTER successful sendMessage only.
 * @lastModified 2026-04-10
 */

import fs from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import { checkBotLimit, recordBotUsage, getBotLimitMessage } from '../../lib/botRateLimiter';

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

// ─── HANDLER ──────────────────────────────────────────────────────────────────

/**
 * Registers the /noscut command handler for catalog search by make/model.
 */
export function registerNoscutHandler(bot: TelegramBot): void {
  bot.onText(/\/noscut(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from?.id ?? chatId);

    // 1. No arguments — show usage hint
    const query = (match?.[1] ?? '').trim();
    if (!query) {
      bot.sendMessage(
        chatId,
        'Укажите марку или модель после команды.\n\nПримеры:\n/noscut Toyota RAV4\n/noscut Hyundai\n/noscut BMW X5',
      );
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
      return;
    }

    // 5. Send results
    const header = results.length === 1
      ? `🔧 Найден 1 вариант по запросу «${query}»:\n\n`
      : `🔧 Найдено ${results.length} вариантов по запросу «${query}»:\n\n`;

    const text = header + formatResults(results);

    await bot.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Оставить заявку', callback_data: 'request_start' }],
          [{ text: 'Смотреть каталог', url: 'https://jckauto.ru/catalog/noscut' }],
        ],
      },
    });

    // 6. Record usage AFTER successful send
    recordBotUsage(telegramId, 'calc');
  });
}
