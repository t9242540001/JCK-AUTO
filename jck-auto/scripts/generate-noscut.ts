/**
 * @file generate-noscut.ts
 * @description Generates noscut-catalog.json with descriptions (DeepSeek) and images (DashScope)
 * @run npx tsx -r dotenv/config scripts/generate-noscut.ts dotenv_config_path=.env.local
 * @run npx tsx -r dotenv/config scripts/generate-noscut.ts dotenv_config_path=.env.local --limit=5
 * @run npx tsx -r dotenv/config scripts/generate-noscut.ts dotenv_config_path=.env.local --force --limit=2
 * @run npx tsx -r dotenv/config scripts/generate-noscut.ts dotenv_config_path=.env.local --delay=10
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

function parseDelay(): number {
  const flag = process.argv.find((a) => a.startsWith("--delay="));
  if (!flag) return 0;
  const n = parseInt(flag.split("=")[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buffer);
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const start = Date.now();
  const limit = parseLimit();
  const force = parseForce();
  const delay = parseDelay();

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

    let wasGenerated = false;
    let description = "";
    let image = "/storage/noscut/placeholder.jpg";

    wasGenerated = true;
    // a. DeepSeek description
    try {
      const descPrompt = `Write a product page description for a noscut kit: ${m.make} ${m.model} ${m.generation} (${m.yearStart}–${m.yearEnd}).

Context: A noscut is a set of front-end parts for vehicle restoration after a front-end collision. Parts are sourced from China. The kit includes exactly six positions: front bumper, headlights with foglights, cooling radiator, front panel frame ("televizor"), parking sensors, front-facing camera.

Parts condition: the kit can be assembled from new parts, quality used parts, or a mix — selected based on the customer's budget and requirements. Do NOT imply that all parts are always new. The word "новые" is allowed only when describing the choice between new and used, not as the default.

Your task: write a natural, honest product description in Russian. No advertising language. Useful information that helps the reader understand what they are getting and whether it suits them.

The text should organically mention 3 to 4 different buyer types — do NOT list them as bullet points, weave them naturally into the prose. Choose from: car owners after a front-end accident, auto repair shops, car resellers, auto parts stores, wholesale buyers, entrepreneurs. Pick different combinations for each model to make texts feel unique.

Write in Russian. 80–150 words. Use short paragraphs or a dash-list where items start with "–". Write like a knowledgeable person, not a corporate catalog.

Required — all must appear in the text:
- all six kit components named
- compatibility with ${m.model} ${m.generation} modifications
- sourced from China, lead time approximately 30 days
- kit composition (new or used parts) and pricing are discussed individually with the manager

End with this exact sentence as a separate paragraph:
"Цвет и комплектация деталей на фото — ориентировочные. Точный подбор под ваш VIN и фотографии реального комплекта отправим при оформлении заказа."

Strictly forbidden:
- Markdown: no **, no *, no #. Only "–" is allowed for lists
- Superlatives: "лучший", "идеальный", "гарантированно", "всё необходимое"
- "из Азии" — write "из Китая" instead
- "задняя камера" — the camera is front-facing, not rear
- Bureaucratic words: "данный", "осуществляется", "предусмотрено", "в рамках"
- Invented facts not stated above
- Any promises not in our actual offer`;

      const { content } = await callDeepSeek(descPrompt, {
        temperature: 0.3,
        maxTokens: 500,
      });
      description = content.trim();
      console.log(`[${idx}] ${m.slug} — description OK`);
    } catch (err) {
      console.error(`[error] ${m.slug}: description failed — ${(err as Error).message}`);
    }

    // b. DashScope image
    try {
      const imagePrompt = `Product flat lay photograph on neutral light gray background. Six automotive parts neatly arranged: front bumper assembly at the top, headlights pair left and right in the second row, cooling radiator in the center, front panel frame below it, parking sensors set on the lower left, front camera on the lower right. Parts are for ${m.make} ${m.model} ${m.generation}. Professional product photography style, soft even lighting, top-down view, no shadows, no text, no labels, no watermarks.`;

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

    if (wasGenerated && delay > 0 && i < total - 1) {
      console.log(`[delay] waiting ${delay}s before next model...`);
      await sleep(delay);
    }
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
