/**
 * @file research-noscut-models.ts
 * @description Generates models.json (noscut catalog seed) and deliveryConfig.ts via DeepSeek
 * @run npx tsx -r dotenv/config scripts/research-noscut-models.ts dotenv_config_path=.env.local
 */

import fs from "fs";
import path from "path";
import { callDeepSeek } from "../src/lib/deepseek";

// ─── TYPES ────────────────────────────────────────────────────────────────

interface NoscutModel {
  make: string;
  model: string;
  generation: string;
  yearStart: number;
  yearEnd: number;
  slug: string;
  country: "japan" | "china" | "korea";
}

interface DeliveryCity {
  name: string;
  priceFrom: number;
  daysMin: number;
  daysMax: number;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const STORAGE_DIR = "/var/www/jckauto/storage/noscut";
const MODELS_PATH = path.join(STORAGE_DIR, "models.json");
const INSTOCK_PATH = path.join(STORAGE_DIR, "noscut-instock.json");
const DELIVERY_CONFIG_PATH = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "deliveryConfig.ts",
);

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR_END = CURRENT_YEAR - 5;

const SEED_LIST: NoscutModel[] = [
  { make: "Toyota", model: "Land Cruiser Prado", generation: "J150", yearStart: 2009, yearEnd: 2024, slug: "toyota-land-cruiser-prado-j150", country: "japan" },
  { make: "Lexus", model: "RX", generation: "AL20", yearStart: 2015, yearEnd: 2022, slug: "lexus-rx-al20", country: "japan" },
  { make: "Lexus", model: "RX", generation: "AL30", yearStart: 2022, yearEnd: 2026, slug: "lexus-rx-al30", country: "japan" },
  { make: "Lexus", model: "LX", generation: "J300", yearStart: 2021, yearEnd: 2026, slug: "lexus-lx-j300", country: "japan" },
  { make: "Lexus", model: "NX", generation: "AZ20", yearStart: 2021, yearEnd: 2026, slug: "lexus-nx-az20", country: "japan" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────

function makeSlug(make: string, model: string, generation: string): string {
  return `${make}-${model}-${generation}`.toLowerCase().replace(/[\s\/]+/g, "-");
}

// ─── TASK A: models.json ──────────────────────────────────────────────────

async function buildModels(): Promise<void> {
  console.log("[models] Requesting model list from DeepSeek...");

  const prompt = `Return a JSON array of 100–120 unique car models popular as imports in Russia.
Each object must have: make (string), model (string), generation (string, e.g. "XA50"),
yearStart (number), yearEnd (number — use ${CURRENT_YEAR} if still in production),
country ("japan"|"korea"|"china").

Cover these brands:
- Japan: Toyota, Lexus, Honda, Nissan, Mitsubishi
- Korea: Hyundai, Kia, Genesis
- China: Haval, Chery, Geely, BYD, Li Auto, NIO, Changan

Include multiple generations per model where relevant.
Response must be ONLY a valid JSON array, no markdown fences, no explanation.`;

  let researchModels: NoscutModel[] = [];
  try {
    const { content } = await callDeepSeek(prompt, {
      temperature: 0.4,
      maxTokens: 8192,
      systemPrompt: "You are a car data expert. Return only valid JSON.",
    });

    const cleaned = content.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as Array<{
      make: string;
      model: string;
      generation: string;
      yearStart: number;
      yearEnd: number;
      country: "japan" | "china" | "korea";
    }>;

    researchModels = parsed
      .filter((r) => r.yearEnd >= MIN_YEAR_END)
      .map((r) => ({
        ...r,
        slug: makeSlug(r.make, r.model, r.generation),
      }));

    console.log(`[models] DeepSeek returned ${parsed.length} records, ${researchModels.length} after year filter`);
  } catch (err) {
    console.error("[models] DeepSeek parse failed, using seed only:", (err as Error).message);
  }

  // Merge: seed first, then research — deduplicate by slug
  const seen = new Set<string>();
  const merged: NoscutModel[] = [];

  for (const item of [...SEED_LIST, ...researchModels]) {
    if (!seen.has(item.slug)) {
      seen.add(item.slug);
      merged.push(item);
    }
  }

  if (merged.length < 50) {
    console.warn(`[models] WARNING: Low model count: ${merged.length}`);
  }

  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  fs.writeFileSync(MODELS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  console.log(`[models] models.json written: ${merged.length} records`);
}

// ─── TASK B: deliveryConfig.ts ────────────────────────────────────────────

async function buildDeliveryConfig(): Promise<void> {
  console.log("[delivery] Requesting delivery cities from DeepSeek...");

  const prompt = `Return a JSON array of 8 delivery destinations for auto parts from Asia to Russia/CIS.
Include 5 major Russian cities and 3 CIS capitals (Minsk, Almaty, Tashkent).
Each object: name (Russian string), priceFrom (number, RUB, round thousands), daysMin (number), daysMax (number).
Response must be ONLY a valid JSON array, no markdown fences, no explanation.`;

  let cities: DeliveryCity[] = [];
  try {
    const { content } = await callDeepSeek(prompt, {
      temperature: 0.3,
      maxTokens: 1024,
      systemPrompt: "You are a logistics expert. Return only valid JSON.",
    });

    const cleaned = content.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
    cities = JSON.parse(cleaned) as DeliveryCity[];
    console.log(`[delivery] DeepSeek returned ${cities.length} cities`);
  } catch (err) {
    console.error("[delivery] DeepSeek parse failed:", (err as Error).message);
    // Fallback so the file is still generated
    cities = [
      { name: "Москва", priceFrom: 15000, daysMin: 25, daysMax: 35 },
      { name: "Санкт-Петербург", priceFrom: 16000, daysMin: 27, daysMax: 37 },
      { name: "Новосибирск", priceFrom: 12000, daysMin: 20, daysMax: 30 },
      { name: "Владивосток", priceFrom: 8000, daysMin: 14, daysMax: 21 },
      { name: "Екатеринбург", priceFrom: 14000, daysMin: 23, daysMax: 33 },
      { name: "Минск", priceFrom: 20000, daysMin: 30, daysMax: 40 },
      { name: "Алматы", priceFrom: 18000, daysMin: 28, daysMax: 38 },
      { name: "Ташкент", priceFrom: 22000, daysMin: 32, daysMax: 42 },
    ];
  }

  const citiesLiteral = cities
    .map(
      (c) =>
        `  { name: "${c.name}", priceFrom: ${c.priceFrom}, daysMin: ${c.daysMin}, daysMax: ${c.daysMax} },`,
    )
    .join("\n");

  const fileContent = `/**
 * @file deliveryConfig.ts
 * @description Auto-generated delivery destinations for noscut catalog
 * @generated by scripts/research-noscut-models.ts
 * @rule Do NOT edit manually — regenerate with the script
 */

export interface DeliveryCity {
  name: string;
  priceFrom: number;
  daysMin: number;
  daysMax: number;
}

export const DELIVERY_CITIES: DeliveryCity[] = [
${citiesLiteral}
];

export const DELIVERY_DISCLAIMER =
  "Сроки и стоимость доставки ориентировочные и зависят от загрузки транспорта. " +
  "Точные условия уточняйте у менеджера.";

export const DELIVERY_NOTE = "Отправим в любой город России и СНГ — уточните у менеджера.";
`;

  fs.writeFileSync(DELIVERY_CONFIG_PATH, fileContent, "utf-8");
  console.log(`[delivery] deliveryConfig.ts written: ${cities.length} cities`);
}

// ─── INSTOCK SEED ─────────────────────────────────────────────────────────

function writeInstockSeed(): void {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(INSTOCK_PATH)) {
    const seed = ["toyota-land-cruiser-prado-j150", "lexus-rx-al20"];
    fs.writeFileSync(INSTOCK_PATH, JSON.stringify(seed, null, 2), "utf-8");
    console.log(`[instock] noscut-instock.json written: ${seed.length} entries`);
  } else {
    console.log("[instock] noscut-instock.json already exists, skipping");
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const start = Date.now();
  console.log(`[research] Starting noscut model research (currentYear=${CURRENT_YEAR}, minYearEnd=${MIN_YEAR_END})...`);

  writeInstockSeed();

  await Promise.all([buildModels(), buildDeliveryConfig()]);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[research] Done in ${elapsed}s`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[research] Fatal error:", err);
    process.exit(1);
  });
