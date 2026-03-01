/**
 * Fix photo order for 14 cars with the old cover/screenshot bug.
 *
 * New logic:
 *   - file "1.*" → cover (photos[0])
 *   - file "2.*" → excluded from photos[] (it's a screenshot)
 *   - remaining files → sorted alphabetically
 *
 * Usage (on VDS):
 *   npx tsx scripts/fix-photo-order.ts
 *
 * After running:
 *   npm run build && pm2 restart jckauto
 */

import { promises as fs } from "fs";
import path from "path";

const STORAGE_DIR = "/var/www/jckauto/storage";
const CATALOG_DIR = path.join(STORAGE_DIR, "catalog");
const CATALOG_JSON = path.join(CATALOG_DIR, "catalog.json");

const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

const TARGET_SLUGS = [
  "bmw-x1-2021-sdrive20li-premium-edition",
  "bmw-x1-2021-sdrive20li-exclusive-edition",
  "bmw-320li-2022-m-sport",
  "bmw-120i-2022-sport",
  "audi-q3l-2021-35-tfsi-progressive-dynamic-edition",
  "audi-q2l-2022-35-tfsi-stylish-dynamic-edition",
  "audi-a3l-35-tfsi-sporty-fashion-edition-2021-",
  "audi-a3-2023-sportback-35-tfsi-sporty-fashion-edition",
  "audi-a3-sport-package2021-35tfsi-sporty-fashion-edition",
  "audi-2021-35-tfsi-progressive-s-line",
  "volkswagen-tayron-gte-2020-14t-premium-edition",
  "mercedes-benz-gla-180",
  "bmw-x1-2021-xdrive25li",
  "honda-crider-2019-180turbo",
];

interface Car {
  id: string;
  photos: string[];
  [key: string]: unknown;
}

function isCover(fileName: string): boolean {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base === "1" || /^1[_\- ]/.test(base);
}

function isScreenshot(fileName: string): boolean {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base === "2" || /^2[_\- ]/.test(base);
}

async function main() {
  console.log("[fix-photo-order] Reading catalog.json...");
  const raw = await fs.readFile(CATALOG_JSON, "utf-8");
  const catalog: Car[] = JSON.parse(raw);
  console.log(`[fix-photo-order] Catalog has ${catalog.length} cars`);

  const carMap = new Map(catalog.map((c) => [c.id, c]));

  let fixedCount = 0;

  for (const slug of TARGET_SLUGS) {
    const car = carMap.get(slug);
    if (!car) {
      console.error(`[fix-photo-order] CAR NOT FOUND: ${slug}`);
      continue;
    }

    const carDir = path.join(CATALOG_DIR, slug);
    let files: string[];
    try {
      files = (await fs.readdir(carDir)).filter((f) => IMAGE_EXT.test(f));
    } catch {
      console.error(`[fix-photo-order] DIR NOT FOUND: ${carDir}`);
      continue;
    }

    if (files.length === 0) {
      console.error(`[fix-photo-order] NO IMAGES: ${slug}`);
      continue;
    }

    // Split into cover, screenshot, and gallery
    const coverFile = files.find((f) => isCover(f));
    const galleryFiles = files
      .filter((f) => !isCover(f) && !isScreenshot(f))
      .sort((a, b) => a.localeCompare(b));

    const newPhotos: string[] = [];

    if (coverFile) {
      newPhotos.push(`/storage/catalog/${slug}/${coverFile}`);
    }

    for (const f of galleryFiles) {
      newPhotos.push(`/storage/catalog/${slug}/${f}`);
    }

    if (newPhotos.length === 0) {
      console.error(`[fix-photo-order] NO GALLERY PHOTOS after filtering: ${slug}`);
      continue;
    }

    const oldFirst = car.photos[0] || "(empty)";
    const oldCount = car.photos.length;
    car.photos = newPhotos;
    fixedCount++;

    console.log(
      `[fix-photo-order] ✓ ${slug}\n` +
        `    old: ${oldCount} photos, cover: ${oldFirst}\n` +
        `    new: ${newPhotos.length} photos, cover: ${newPhotos[0]}\n` +
        `    excluded screenshot: ${files.find((f) => isScreenshot(f)) || "(none)"}`,
    );
  }

  // Write back
  console.log(`\n[fix-photo-order] Writing catalog.json (${fixedCount} cars fixed)...`);
  await fs.writeFile(CATALOG_JSON, JSON.stringify(catalog, null, 2), "utf-8");
  console.log("[fix-photo-order] Done.");

  // Summary
  console.log("\n=== SUMMARY: photos[0] for each fixed car ===");
  for (const slug of TARGET_SLUGS) {
    const car = carMap.get(slug);
    if (car) {
      console.log(`  ${slug}: ${car.photos[0]}`);
    }
  }
}

main().catch((err) => {
  console.error("[fix-photo-order] Fatal:", err);
  process.exit(1);
});
