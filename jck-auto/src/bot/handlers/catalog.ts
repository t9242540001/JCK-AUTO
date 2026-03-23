import TelegramBot from "node-telegram-bot-api";
import { existsSync } from "fs";
import * as path from "path";
import { readCatalogJson } from "../../lib/blobStorage";
import { pendingSource, handleRequestCommand } from "./request";
import { getFileId, setFileId, deleteFileId } from "../fileIdCache";
import type { Car } from "../../types/car";

/* ── CONSTANTS ─────────────────────────────────────────────────────────── */

const CATALOG_STORAGE_PATH = "/var/www/jckauto/storage/catalog";
const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const PHOTO_BASE = process.env.TELEGRAM_API_BASE_URL
  ? `${process.env.TELEGRAM_API_BASE_URL}/photo`
  : "https://jckauto.ru";

/* ── HELPERS ──────────────────────────────────────────────────────────── */

function logTs(level: "log" | "error", ...args: unknown[]): void {
  const ts = new Date().toISOString();
  if (level === "error") {
    console.error(`[${ts}]`, ...args);
  } else {
    console.log(`[${ts}]`, ...args);
  }
}

/**
 * Resolve car.photos[0] (e.g. "/storage/catalog/slug/1.jpg") to an absolute
 * path on disk. If the exact file doesn't exist, try alternative extensions.
 * Returns null if no file found.
 */
function resolvePhotoPath(photoRelative: string): string | null {
  // Strip leading "/storage/catalog/" to get "slug/filename.ext"
  const stripped = photoRelative.replace(/^\/storage\/catalog\//, "");
  const absolute = path.join(CATALOG_STORAGE_PATH, stripped);

  if (existsSync(absolute)) return absolute;

  // Try alternative extensions
  const parsed = path.parse(absolute);
  for (const ext of PHOTO_EXTENSIONS) {
    if (ext === parsed.ext) continue;
    const alt = path.join(parsed.dir, parsed.name + ext);
    if (existsSync(alt)) return alt;
  }

  return null;
}

function toTitleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function normalizeBrand(brand: string): string {
  return brand.trim().toLowerCase();
}

function formatCarCaption(car: Car): string {
  const vol = car.engineVolume < 100
    ? car.engineVolume.toFixed(1)
    : (car.engineVolume / 1000).toFixed(1);
  const price = car.priceRub
    ? `${car.priceRub.toLocaleString("ru-RU")} \u20BD`
    : "цена уточняется";
  return [
    `\u{1F697} ${car.brand} ${car.model} ${car.year}`,
    `\u2699\uFE0F ${vol} л, ${car.power} л.с., ${car.transmission}`,
    `\u{1F4CF} ${car.mileage.toLocaleString("ru-RU")} км`,
    `\u{1F4B0} ${price}`,
  ].join("\n");
}

function carKeyboard(
  brand: string,
  carId: string,
  index: number,
  total: number,
): TelegramBot.InlineKeyboardButton[][] {
  const nav: TelegramBot.InlineKeyboardButton[] = [];
  if (total > 1) {
    nav.push({ text: "\u25C0\uFE0F", callback_data: `cat_${brand}_prev_${index}` });
  }
  nav.push({ text: `${index + 1}/${total}`, callback_data: "noop" });
  if (total > 1) {
    nav.push({ text: "\u25B6\uFE0F", callback_data: `cat_${brand}_next_${index}` });
  }

  return [
    nav,
    [
      { text: "\u{1F517} На сайте", url: `https://jckauto.ru/catalog/${carId}` },
      { text: "\u{1F697} Заказать", callback_data: `order_${carId}` },
    ],
    [{ text: "\u21A9\uFE0F К списку марок", callback_data: "catalog_brands" }],
  ];
}

async function getAvailableCars(): Promise<Car[]> {
  const cars = await readCatalogJson();
  return cars.filter((c) => c.priceRub && c.priceRub > 0);
}

function groupByBrand(cars: Car[]): Map<string, Car[]> {
  const map = new Map<string, Car[]>();
  for (const car of cars) {
    const key = normalizeBrand(car.brand);
    const arr = map.get(key) || [];
    arr.push(car);
    map.set(key, arr);
  }
  return map;
}

function brandButtons(groups: Map<string, Car[]>): TelegramBot.InlineKeyboardButton[][] {
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const rows: TelegramBot.InlineKeyboardButton[][] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const row: TelegramBot.InlineKeyboardButton[] = [];
    row.push({
      text: `${toTitleCase(sorted[i][0])} (${sorted[i][1].length})`,
      callback_data: `brand_${sorted[i][0]}`,
    });
    if (i + 1 < sorted.length) {
      row.push({
        text: `${toTitleCase(sorted[i + 1][0])} (${sorted[i + 1][1].length})`,
        callback_data: `brand_${sorted[i + 1][0]}`,
      });
    }
    rows.push(row);
  }
  return rows;
}

/* ── MAIN LOGIC ───────────────────────────────────────────────────────── */

export async function handleCatalogCommand(bot: TelegramBot, chatId: number): Promise<void> {
  try {
    const available = await getAvailableCars();
    if (available.length === 0) {
      bot.sendMessage(chatId, "Каталог пока пуст. Загляните позже или напишите менеджеру /contact");
      return;
    }

    const groups = groupByBrand(available);
    await bot.sendMessage(chatId, `\u{1F697} Выберите марку автомобиля (${available.length} авто):`, {
      reply_markup: { inline_keyboard: brandButtons(groups) },
    });
  } catch (err) {
    logTs("error", "[catalog] handleCatalogCommand error:", err);
    bot.sendMessage(chatId, "Не удалось загрузить каталог. Попробуйте позже.");
  }
}

async function sendCarCard(
  bot: TelegramBot,
  chatId: number,
  brand: string,
  index: number,
): Promise<void> {
  const available = await getAvailableCars();
  const groups = groupByBrand(available);
  const cars = groups.get(brand);
  if (!cars || cars.length === 0) return;

  const i = ((index % cars.length) + cars.length) % cars.length;
  const car = cars[i];
  const caption = formatCarCaption(car);
  const keyboard = carKeyboard(brand, car.id, i, cars.length);
  const opts = { caption, reply_markup: { inline_keyboard: keyboard } };

  if (car.photos.length > 0 && resolvePhotoPath(car.photos[0])) {
    const photoPath = car.photos[0];
    const cachedId = getFileId(photoPath);

    // Try file_id first (instant delivery)
    if (cachedId) {
      try {
        const sent = await bot.sendPhoto(chatId, cachedId, opts);
        logTs("log", `[catalog] sendPhoto via file_id car=${car.id}`);
        extractAndCacheFileId(sent, photoPath);
        return;
      } catch (err: any) {
        logTs("error", `[catalog] sendPhoto file_id FAILED car=${car.id}, fallback to URL. error=${err?.message || err}`);
        deleteFileId(photoPath);
      }
    }

    // Fallback: send by URL
    const photoUrl = `${PHOTO_BASE}${photoPath}`;
    try {
      const sent = await bot.sendPhoto(chatId, photoUrl, opts);
      logTs("log", `[catalog] sendPhoto via URL car=${car.id}`);
      extractAndCacheFileId(sent, photoPath);
      return;
    } catch (photoErr: any) {
      logTs("error", `[catalog] sendPhoto URL FAILED car=${car.id} url=${photoUrl} error=${photoErr?.message || photoErr}`);
    }
  } else if (car.photos.length > 0) {
    logTs("log", `[catalog] photo not found on disk car=${car.id} path=${car.photos[0]}`);
  }

  // Text fallback
  try {
    await bot.sendMessage(chatId, caption, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (err: any) {
    logTs("error", `[catalog] sendMessage FAILED car=${car.id} error=${err?.message || err}`);
  }
}

/**
 * Extract file_id from Telegram Message response and cache it
 */
function extractAndCacheFileId(msg: TelegramBot.Message, photoPath: string): void {
  if (msg.photo && msg.photo.length > 0) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    setFileId(photoPath, fileId);
    logTs("log", `[catalog] cached file_id for ${photoPath}`);
  }
}

async function editCarCard(
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  brand: string,
  index: number,
): Promise<void> {
  const available = await getAvailableCars();
  const groups = groupByBrand(available);
  const cars = groups.get(brand);
  if (!cars || cars.length === 0) return;

  const i = ((index % cars.length) + cars.length) % cars.length;
  const car = cars[i];
  const caption = formatCarCaption(car);
  const keyboard = carKeyboard(brand, car.id, i, cars.length);
  const editOpts = { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: keyboard } };

  if (car.photos.length > 0 && resolvePhotoPath(car.photos[0])) {
    const photoPath = car.photos[0];
    const cachedId = getFileId(photoPath);

    // Try file_id first
    if (cachedId) {
      try {
        const result = await bot.editMessageMedia(
          { type: "photo", media: cachedId, caption },
          editOpts,
        );
        logTs("log", `[catalog] editMedia via file_id car=${car.id}`);
        if (result && typeof result === "object" && "photo" in result) {
          extractAndCacheFileId(result as TelegramBot.Message, photoPath);
        }
        return;
      } catch (err: any) {
        logTs("error", `[catalog] editMedia file_id FAILED car=${car.id}, fallback to URL. error=${err?.message || err}`);
        deleteFileId(photoPath);
      }
    }

    // Fallback: URL
    const photoUrl = `${PHOTO_BASE}${photoPath}`;
    try {
      const result = await bot.editMessageMedia(
        { type: "photo", media: photoUrl, caption },
        editOpts,
      );
      logTs("log", `[catalog] editMedia via URL car=${car.id}`);
      if (result && typeof result === "object" && "photo" in result) {
        extractAndCacheFileId(result as TelegramBot.Message, photoPath);
      }
      return;
    } catch (editErr: any) {
      logTs("error", `[catalog] editMedia URL FAILED car=${car.id} url=${photoUrl} error=${editErr?.message || editErr}`);
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      await sendCarCard(bot, chatId, brand, i);
      return;
    }
  } else if (car.photos.length > 0) {
    logTs("log", `[catalog] photo not found on disk car=${car.id} path=${car.photos[0]}`);
  }

  try {
    await bot.editMessageText(caption, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (editErr: any) {
    logTs("error", `[catalog] editText FAILED car=${car.id} error=${editErr?.message || editErr}`);
    try { await bot.deleteMessage(chatId, messageId); } catch {}
    await sendCarCard(bot, chatId, brand, i);
  }
}

/* ── EXPORTS ──────────────────────────────────────────────────────────── */

export function registerCatalogHandler(bot: TelegramBot, groupChatId: string) {
  bot.onText(/\/catalog/, async (msg) => {
    await handleCatalogCommand(bot, msg.chat.id);
  });

  bot.on("callback_query", async (query) => {
    if (!query.data || !query.message) return;
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data;

    // noop — just dismiss spinner
    if (data === "noop") {
      bot.answerCallbackQuery(query.id);
      return;
    }

    // Back to brand list
    if (data === "catalog_brands") {
      bot.answerCallbackQuery(query.id);
      try {
        await bot.deleteMessage(chatId, msgId);
      } catch (err) {
        logTs("error", "[catalog] deleteMessage error:", err);
      }
      await handleCatalogCommand(bot, chatId);
      return;
    }

    // Select brand → show first car
    if (data.startsWith("brand_")) {
      bot.answerCallbackQuery(query.id);
      const brand = data.replace("brand_", "");
      await sendCarCard(bot, chatId, brand, 0);
      return;
    }

    // Navigate prev/next
    const navMatch = data.match(/^cat_(.+)_(prev|next)_(\d+)$/);
    if (navMatch) {
      bot.answerCallbackQuery(query.id);
      const brand = navMatch[1];
      const dir = navMatch[2];
      const currentIndex = parseInt(navMatch[3], 10);
      const newIndex = dir === "next" ? currentIndex + 1 : currentIndex - 1;
      await editCarCard(bot, chatId, msgId, brand, newIndex);
      return;
    }

    // Order car
    if (data.startsWith("order_")) {
      bot.answerCallbackQuery(query.id);
      const carId = data.replace("order_", "");
      pendingSource.set(chatId, `https://jckauto.ru/catalog/${carId}`);
      handleRequestCommand(bot, chatId, groupChatId);
      return;
    }
  });
}
