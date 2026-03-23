/**
 * @file warmup-bot-photos.ts
 * @description Прогрев кэша file_id: отправляет все фото каталога в Telegram,
 *              извлекает file_id, сохраняет в кэш. После прогрева бот отдаёт
 *              фото мгновенно без повторного скачивания.
 * @runs VDS (one-off script)
 * @input catalog.json, file-id-cache.json
 * @output file-id-cache.json (обновлённый)
 * @triggers manual
 *
 * Usage:
 *   npx tsx -r dotenv/config scripts/warmup-bot-photos.ts dotenv_config_path=.env.local
 *   npx tsx scripts/warmup-bot-photos.ts --chat-id=-1003706902240
 */

import TelegramBot from "node-telegram-bot-api";
import * as fs from "fs";
import * as path from "path";

/* ── CONFIG ────────────────────────────────────────────────────────────── */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = process.env.TELEGRAM_API_BASE_URL;
const CATALOG_PATH = "/var/www/jckauto/storage/catalog/catalog.json";
const CACHE_PATH = "/var/www/jckauto/storage/catalog/file-id-cache.json";
const PHOTO_BASE = API_BASE ? `${API_BASE}/photo` : "https://jckauto.ru";
const DELAY_MS = 1000; // 1 second between sends (Telegram rate limit)

/* ── PARSE ARGS ────────────────────────────────────────────────────────── */

function getChatId(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--chat-id" && args[i + 1]) {
      return parseInt(args[i + 1], 10);
    }
    if (args[i].startsWith("--chat-id=")) {
      return parseInt(args[i].split("=")[1], 10);
    }
  }
  const envId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (envId) return parseInt(envId, 10);
  console.error("ERROR: No chat_id provided. Use --chat-id=<id> or set TELEGRAM_GROUP_CHAT_ID");
  process.exit(1);
}

/* ── HELPERS ───────────────────────────────────────────────────────────── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCache(): Record<string, string> {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    }
  } catch (err: any) {
    console.error(`[warmup] Failed to load cache: ${err.message}`);
  }
  return {};
}

function saveCache(cache: Record<string, string>): void {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
}

interface CatalogCar {
  id: string;
  brand: string;
  model: string;
  photos: string[];
  priceRub?: number;
}

/* ── MAIN ──────────────────────────────────────────────────────────────── */

async function main() {
  if (!BOT_TOKEN) {
    console.error("ERROR: TELEGRAM_BOT_TOKEN is not set");
    process.exit(1);
  }

  const chatId = getChatId();
  console.log(`[warmup] Chat ID: ${chatId}`);
  console.log(`[warmup] Photo base: ${PHOTO_BASE}`);

  // Init bot
  const botOptions: TelegramBot.ConstructorOptions = { polling: false };
  if (API_BASE) {
    botOptions.baseApiUrl = API_BASE;
  }
  const bot = new TelegramBot(BOT_TOKEN, botOptions);

  // Load catalog
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`ERROR: catalog.json not found at ${CATALOG_PATH}`);
    process.exit(1);
  }
  const cars: CatalogCar[] = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
  const withPhotos = cars.filter((c) => c.photos && c.photos.length > 0 && c.priceRub && c.priceRub > 0);
  console.log(`[warmup] Cars with photos: ${withPhotos.length} / ${cars.length}`);

  // Load existing cache
  const cache = loadCache();
  const existingCount = Object.keys(cache).length;
  console.log(`[warmup] Existing cache entries: ${existingCount}`);

  let warmed = 0;
  let skipped = 0;
  let errors = 0;

  for (const car of withPhotos) {
    const photoPath = car.photos[0];

    // Already cached
    if (cache[photoPath]) {
      skipped++;
      continue;
    }

    const photoUrl = `${PHOTO_BASE}${photoPath}`;
    try {
      const sent = await bot.sendPhoto(chatId, photoUrl, {
        caption: `[warmup] ${car.brand} ${car.model}`,
      });

      // Extract file_id
      if (sent.photo && sent.photo.length > 0) {
        const fileId = sent.photo[sent.photo.length - 1].file_id;
        cache[photoPath] = fileId;
        warmed++;
        console.log(`[warmup] OK ${car.id} ${car.brand} ${car.model} → ${fileId.slice(0, 20)}...`);
      }

      // Delete the message to keep chat clean
      try {
        await bot.deleteMessage(chatId, sent.message_id);
      } catch {
        // ignore delete errors
      }
    } catch (err: any) {
      errors++;
      console.error(`[warmup] FAIL ${car.id} ${car.brand} ${car.model}: ${err?.message || err}`);
    }

    // Save cache after each successful warmup (in case of interruption)
    if (warmed % 5 === 0 && warmed > 0) {
      saveCache(cache);
    }

    await sleep(DELAY_MS);
  }

  // Final save
  saveCache(cache);

  console.log("\n═══════════════════════════════════════");
  console.log(`[warmup] Done!`);
  console.log(`  Warmed:   ${warmed}`);
  console.log(`  Skipped:  ${skipped} (already cached)`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Total cache entries: ${Object.keys(cache).length}`);
  console.log(`  Cache file: ${CACHE_PATH}`);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("[warmup] Fatal error:", err);
  process.exit(1);
});
