/**
 * @file update-noscut-prices.ts
 * @description Updates marketPriceRu in noscut-catalog.json via DeepSeek market research
 * @run npx tsx -r dotenv/config scripts/update-noscut-prices.ts dotenv_config_path=.env.local
 * @run npx tsx -r dotenv/config scripts/update-noscut-prices.ts dotenv_config_path=.env.local --limit=5
 */

import fs from "fs";
import { callDeepSeek } from "../src/lib/deepseek";

// ─── TYPES ────────────────────────────────────────────────────────────────

interface NoscutEntry {
  slug: string;
  make: string;
  model: string;
  generation: string;
  [key: string]: unknown;
  marketPriceRu: number | null;
  marketPriceSource: string | null;
  marketPriceUpdated: string | null;
}

interface PriceResult {
  price: number | null;
  sources: string[];
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const CATALOG_PATH = "/var/www/jckauto/storage/noscut/noscut-catalog.json";
const BATCH_SIZE = 5;

// ─── CLI FLAGS ────────────────────────────────────────────────────────────

function parseLimit(): number | undefined {
  const flag = process.argv.find((a) => a.startsWith("--limit="));
  if (!flag) return undefined;
  const n = parseInt(flag.split("=")[1], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// ─── PRICE LOOKUP ─────────────────────────────────────────────────────────

async function fetchPrice(entry: NoscutEntry): Promise<PriceResult | null> {
  const prompt = `Найди суммарную стоимость покупки запасных частей для восстановления передней части ${entry.make} ${entry.model} ${entry.generation} на российском рынке.\nНас интересует суммарная цена этих 6 деталей, купленных по отдельности:\n1. Передний бампер в сборе\n2. Фары (комплект: левая + правая)\n3. Радиатор охлаждения\n4. Телевизор (рамка передней части / front panel)\n5. Парктроники / датчики парковки\n6. Камера переднего вида\nИсточники: exist.ru, autodoc.ru, Авито, oem.ru.\nВерни ТОЛЬКО JSON: { "price": number | null, "sources": string[] }\nгде price — суммарная медианная цена в рублях за все 6 позиций (null если меньше 2 источников дали данные хотя бы по 4 из 6 позиций), sources — список источников (1–3 строки). Без markdown, только JSON.`;

  const { content } = await callDeepSeek(prompt, {
    temperature: 0.2,
    maxTokens: 512,
  });

  const cleaned = content.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned) as PriceResult;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const start = Date.now();
  const limit = parseLimit();

  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`[prices] noscut-catalog.json not found at ${CATALOG_PATH}`);
    process.exit(1);
  }

  const catalog: NoscutEntry[] = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
  const toProcess = limit ? catalog.slice(0, limit) : catalog;
  const total = toProcess.length;
  const today = new Date().toISOString().split("T")[0];

  console.log(`[prices] Processing ${total} entries (limit=${limit ?? "none"})...`);

  // Process in batches of BATCH_SIZE
  for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
    const batch = toProcess.slice(batchStart, batchStart + BATCH_SIZE);

    const settled = await Promise.allSettled(
      batch.map(async (entry, batchIdx) => {
        const idx = batchStart + batchIdx + 1;

        try {
          const result = await fetchPrice(entry);

          if (result && result.price != null && result.sources && result.sources.length >= 2) {
            entry.marketPriceRu = result.price;
            entry.marketPriceSource = result.sources.join(", ");
            entry.marketPriceUpdated = today;
            console.log(`[prices] ${idx}/${total} ${entry.slug} → ${result.price} ₽`);
          } else {
            entry.marketPriceRu = null;
            entry.marketPriceSource = null;
            entry.marketPriceUpdated = null;
            console.log(`[prices] ${idx}/${total} ${entry.slug} → null`);
          }
        } catch (err) {
          console.error(`[prices] ${entry.slug} parse error: ${(err as Error).message}`);
          // Keep existing values on error
        }
      }),
    );

    // Log any unexpected rejections
    for (const result of settled) {
      if (result.status === "rejected") {
        console.error(`[prices] batch rejection: ${result.reason}`);
      }
    }
  }

  // Write updated catalog
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");

  const filled = catalog.filter((e) => e.marketPriceRu != null).length;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`[prices] done: ${filled}/${catalog.length} entries have marketPriceRu (${elapsed}s)`);

  if (filled / catalog.length < 0.6) {
    console.warn(`[prices] WARNING: fill rate below 60% (${Math.round((filled / catalog.length) * 100)}%)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[prices] Fatal error:", err);
    process.exit(1);
  });
