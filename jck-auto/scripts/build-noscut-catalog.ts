/**
 * @file build-noscut-catalog.ts
 * @description Builds noscut-catalog.json from jpg files already on disk.
 *              Preserves existing descriptions. No API calls.
 * @run npx tsx scripts/build-noscut-catalog.ts
 */

import fs from "fs";
import path from "path";

const STORAGE_DIR = "/var/www/jckauto/storage/noscut";
const MODELS_PATH = path.join(STORAGE_DIR, "models.json");
const CATALOG_PATH = path.join(STORAGE_DIR, "noscut-catalog.json");
const INSTOCK_PATH = path.join(STORAGE_DIR, "noscut-instock.json");
const COMPONENTS = ["бампер", "оптика", "радиатор", "телевизор", "датчики", "камера"];

interface NoscutModel {
  make: string; model: string; generation: string;
  yearStart: number; yearEnd: number; slug: string;
  country: "japan" | "china" | "korea";
}

const models: NoscutModel[] = JSON.parse(fs.readFileSync(MODELS_PATH, "utf-8"));
const instockList: string[] = JSON.parse(fs.readFileSync(INSTOCK_PATH, "utf-8"));
const instockSet = new Set(instockList);

const existing = fs.existsSync(CATALOG_PATH)
  ? JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"))
  : [];
const existingMap = new Map(existing.map((e: any) => [e.slug, e]));

const today = new Date().toISOString().split("T")[0];
const catalog = [];

for (const m of models) {
  const imagePath = path.join(STORAGE_DIR, `${m.slug}.jpg`);
  if (!fs.existsSync(imagePath)) continue;

  const prev = existingMap.get(m.slug) as any;
  catalog.push({
    slug: m.slug,
    make: m.make,
    model: m.model,
    generation: m.generation,
    yearStart: m.yearStart,
    yearEnd: m.yearEnd,
    country: m.country,
    priceFrom: 199000,
    inStock: instockSet.has(m.slug),
    components: COMPONENTS,
    description: prev?.description || "",
    image: `/storage/noscut/${m.slug}.jpg`,
    marketPriceRu: prev?.marketPriceRu || null,
    marketPriceSource: null,
    marketPriceUpdated: null,
    updatedAt: today,
  });
}

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");
console.log(`[build] Written ${catalog.length} entries to noscut-catalog.json`);
