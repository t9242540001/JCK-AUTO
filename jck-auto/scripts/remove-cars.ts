/**
 * Remove 14 cars from catalog.json and delete their photo folders.
 *
 * Usage (on VDS):
 *   cd /var/www/jckauto
 *   npx tsx scripts/remove-cars.ts
 *
 * After running:
 *   npm run build && pm2 restart jckauto
 */

import { promises as fs } from "fs";
import path from "path";

const STORAGE_DIR = "/var/www/jckauto/storage";
const CATALOG_DIR = path.join(STORAGE_DIR, "catalog");
const CATALOG_JSON = path.join(CATALOG_DIR, "catalog.json");

const SLUGS_TO_REMOVE = new Set([
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
]);

interface Car {
  id: string;
  brand?: string;
  model?: string;
  [key: string]: unknown;
}

async function main() {
  // 1. Read catalog
  console.log("[remove-cars] Reading catalog.json...");
  const raw = await fs.readFile(CATALOG_JSON, "utf-8");
  const catalog: Car[] = JSON.parse(raw);
  console.log(`[remove-cars] Current catalog: ${catalog.length} cars`);

  // 2. Split into keep / remove
  const toRemove: Car[] = [];
  const toKeep: Car[] = [];
  for (const car of catalog) {
    if (SLUGS_TO_REMOVE.has(car.id)) {
      toRemove.push(car);
    } else {
      toKeep.push(car);
    }
  }

  // Warn about slugs not found
  const foundSlugs = new Set(toRemove.map((c) => c.id));
  for (const slug of SLUGS_TO_REMOVE) {
    if (!foundSlugs.has(slug)) {
      console.warn(`[remove-cars] WARNING: slug not found in catalog: ${slug}`);
    }
  }

  console.log(`[remove-cars] Removing ${toRemove.length} cars:`);
  for (const car of toRemove) {
    console.log(`  - ${car.id} (${car.brand} ${car.model})`);
  }

  // 3. Delete photo folders
  console.log("\n[remove-cars] Deleting photo folders...");
  for (const car of toRemove) {
    const dir = path.join(CATALOG_DIR, car.id);
    try {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`  deleted: ${dir}`);
    } catch (err) {
      console.error(
        `  FAILED to delete ${dir}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // 4. Save updated catalog
  console.log(`\n[remove-cars] Saving catalog.json (${toKeep.length} cars remaining)...`);
  await fs.writeFile(CATALOG_JSON, JSON.stringify(toKeep, null, 2), "utf-8");
  console.log("[remove-cars] catalog.json saved.");

  // 5. Show remaining
  console.log(`\n=== ${toKeep.length} cars remaining ===`);
  for (const car of toKeep) {
    console.log(`  ${car.id}`);
  }

  console.log("\n[remove-cars] Done. Now run:");
  console.log("  npm run build && pm2 restart jckauto");
}

main().catch((err) => {
  console.error("[remove-cars] Fatal:", err);
  process.exit(1);
});
