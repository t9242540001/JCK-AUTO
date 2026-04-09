/**
 * @file generate-noscut.ts
 * @description Generates noscut-catalog.json with descriptions (DeepSeek) and images (DashScope)
 * @run npx tsx -r dotenv/config scripts/generate-noscut.ts dotenv_config_path=.env.local
 * @run npx tsx -r dotenv/config scripts/generate-noscut.ts dotenv_config_path=.env.local --limit=5
 * @run npx tsx -r dotenv/config scripts/generate-noscut.ts dotenv_config_path=.env.local --force --limit=2
 */

import fs from "fs";
import path from "path";
import { callDeepSeek } from "../src/lib/deepseek";
import { generateImage } from "../src/lib/dashscope";

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

interface NoscutEntry {
  slug: string;
  make: string;
  model: string;
  generation: string;
  yearStart: number;
  yearEnd: number;
  country: "japan" | "china" | "korea";
  priceFrom: 199000;
  inStock: boolean;
  components: string[];
  description: string;
  image: string;
  marketPriceRu: null;
  marketPriceSource: null;
  marketPriceUpdated: null;
  updatedAt: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const STORAGE_DIR = "/var/www/jckauto/storage/noscut";
const MODELS_PATH = path.join(STORAGE_DIR, "models.json");
const INSTOCK_PATH = path.join(STORAGE_DIR, "noscut-instock.json");
const CATALOG_PATH = path.join(STORAGE_DIR, "noscut-catalog.json");

const COMPONENTS = ["бампер", "оптика", "радиатор", "телевизор", "датчики", "камера"];

// ─── CLI FLAGS ────────────────────────────────────────────────────────────

function parseLimit(): number | undefined {
  const flag = process.argv.find((a) => a.startsWith("--limit="));
  if (!flag) return undefined;
  const n = parseInt(flag.split("=")[1], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseForce(): boolean {
  return process.argv.includes("--force");
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buffer);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const start = Date.now();
  const limit = parseLimit();
  const force = parseForce();

  // 1. Read source data
  const models: NoscutModel[] = JSON.parse(fs.readFileSync(MODELS_PATH, "utf-8"));
  const instockList: string[] = JSON.parse(fs.readFileSync(INSTOCK_PATH, "utf-8"));
  const instockSet = new Set(instockList);

  // 2. Load existing catalog for resume
  let existingCatalog: NoscutEntry[] = [];
  if (fs.existsSync(CATALOG_PATH)) {
    try {
      existingCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
    } catch {
      console.warn("[catalog] Failed to parse existing catalog, starting fresh");
    }
  }
  const existingMap = new Map(existingCatalog.map((e) => [e.slug, e]));

  const toProcess = limit ? models.slice(0, limit) : models;
  const total = toProcess.length;
  console.log(`[catalog] Processing ${total} models (limit=${limit ?? "none"})...`);

  const catalog: NoscutEntry[] = [];
  const today = new Date().toISOString().split("T")[0];

  // 3. Process sequentially
  for (let i = 0; i < total; i++) {
    const m = toProcess[i];
    const idx = `${i + 1}/${total}`;
    const imagePath = path.join(STORAGE_DIR, `${m.slug}.jpg`);

    // Resume check
    if (!force && fs.existsSync(imagePath)) {
      const existing = existingMap.get(m.slug);
      if (existing) {
        catalog.push(existing);
        console.log(`[skip] ${m.slug}`);
        continue;
      }
    }

    console.log(`[${idx}] ${m.slug} — generating...`);

    let description = "";
    let image = "/storage/noscut/placeholder.jpg";

    // a. DeepSeek description
    try {
      const descPrompt = `Write a product page description for a noscut kit: ${m.make} ${m.model} ${m.generation} (${m.yearStart}–${m.yearEnd}).

Context: a noscut is a ready-made set of front-end parts for vehicle restoration. We supply it from Asia to order in approximately 30 days. The kit has a fixed composition — exactly six items: front bumper, headlights with foglights, cooling radiator, front panel frame (called "televizor"), parking sensors, front-facing camera.

Your task: calmly explain to the visitor what they get, what it is for, and why they should order from us. No advertising rhetoric — facts only, honest description.

Write in Russian. 80–150 words. You may use short paragraphs or a bullet list — whichever reads more naturally. Write like a real person, not a corporate catalog.

You must mention:
- all six kit components by name
- compatibility with ${m.model} ${m.generation} modifications
- ~30 day lead time on order
- wholesale pricing is available (one sentence, no specific promises)

Strictly forbidden:
- superlatives or hyperbole ("best", "perfect", "guaranteed", "everything you need")
- invented facts — mention only what is explicitly stated above
- tables
- bureaucratic filler words in Russian: "данный", "осуществляется", "предусмотрено", "в рамках"
- "rear camera" — the camera in this kit is front-facing, not rear
- any promises not present in our actual offer`;

      const { content } = await callDeepSeek(descPrompt, {
        temperature: 0.3,
        maxTokens: 300,
      });
      description = content.trim();
      console.log(`[${idx}] ${m.slug} — description OK`);
    } catch (err) {
      console.error(`[error] ${m.slug}: description failed — ${(err as Error).message}`);
    }

    // b. DashScope image
    try {
      const imagePrompt = `Technical exploded-view illustration of ${m.make} ${m.model} ${m.generation} front end noscut kit. Light gray neutral background. Show the vehicle silhouette in 3/4 front angle. The 6 noscut components are visually separated and floating slightly away from the car body: front bumper, headlights pair, radiator, front panel frame, parking sensors, front camera. All other parts of the car body are faded/transparent. Clean technical product illustration style. No text, no numbers, no labels, no callouts whatsoever. High quality, sharp edges, professional catalog look.`;

      const { imageUrl } = await generateImage(imagePrompt, {
        size: "1024*1024",
        promptExtend: false,
        watermark: false,
      });

      await downloadImage(imageUrl, imagePath);
      image = `/storage/noscut/${m.slug}.jpg`;
      console.log(`[${idx}] ${m.slug} — image OK`);
    } catch (err) {
      console.error(`[error] ${m.slug}: image failed — ${(err as Error).message}`);
    }

    // c. Build entry
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
      description,
      image,
      marketPriceRu: null,
      marketPriceSource: null,
      marketPriceUpdated: null,
      updatedAt: today,
    });
  }

  // 4. Write catalog
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[done] noscut-catalog.json written: ${catalog.length} entries in ${elapsed}s`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[fatal]", err);
    process.exit(1);
  });
