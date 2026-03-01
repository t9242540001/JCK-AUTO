/**
 * @file diagnose-photos.ts
 * @description Диагностика: находит авто с неправильной обложкой или скриншотом в галерее
 * @runs VDS
 * @triggers ручной запуск
 * @input /var/www/jckauto/storage/catalog/catalog.json
 * @output консольный отчёт
 */

import { readFileSync } from "fs";
import { resolve } from "path";

interface Car {
  id: string;
  folderName: string;
  photos: string[];
}

const catalogPath = process.argv[2] || "/var/www/jckauto/storage/catalog/catalog.json";
const resolvedPath = resolve(catalogPath);

console.log(`[diagnose] Reading catalog: ${resolvedPath}`);

let catalog: Car[];
try {
  catalog = JSON.parse(readFileSync(resolvedPath, "utf-8"));
} catch (err) {
  console.error(`[diagnose] Failed to read catalog:`, err instanceof Error ? err.message : err);
  process.exit(1);
}

console.log(`[diagnose] Total cars: ${catalog.length}\n`);

// --- DIAGNOSTICS ---

interface Problem {
  slug: string;
  folderName: string;
  currentCover: string;
  coverOk: boolean;
  screenshotInGallery: string | null;
}

const problems: Problem[] = [];

for (const car of catalog) {
  if (!car.photos || car.photos.length === 0) continue;

  // Extract filename from URL path: "/storage/catalog/slug/1.jpeg" → "1.jpeg"
  const getFileName = (url: string) => url.split("/").pop() || url;

  const coverFile = getFileName(car.photos[0]);
  const coverBaseName = coverFile.replace(/\.[^.]+$/, "");

  // Check 1: cover should start with "1"
  const coverOk = /^1($|[_\- ])/.test(coverBaseName);

  // Check 2: any file starting with "2" in photos[]?
  const screenshotInGallery = car.photos
    .map(getFileName)
    .find((f) => /^2\./i.test(f) || /^2[_\- ]/i.test(f.replace(/\.[^.]+$/, "")));

  if (!coverOk || screenshotInGallery) {
    problems.push({
      slug: car.id,
      folderName: car.folderName,
      currentCover: coverFile,
      coverOk,
      screenshotInGallery: screenshotInGallery || null,
    });
  }
}

// --- REPORT ---

if (problems.length === 0) {
  console.log("[diagnose] All cars OK — no cover or screenshot issues found.");
  process.exit(0);
}

console.log(`[diagnose] Found ${problems.length} problematic car(s):\n`);
console.log("─".repeat(90));
console.log(
  "  Slug".padEnd(45) +
  "Cover (photos[0])".padEnd(25) +
  "2.* in gallery?"
);
console.log("─".repeat(90));

for (const p of problems) {
  const coverStatus = p.coverOk ? "OK" : `BAD: ${p.currentCover}`;
  const scrStatus = p.screenshotInGallery ? `YES: ${p.screenshotInGallery}` : "no";
  console.log(
    `  ${p.slug.padEnd(43)} ${coverStatus.padEnd(23)} ${scrStatus}`
  );
}

console.log("─".repeat(90));

const badCovers = problems.filter((p) => !p.coverOk);
const leakedScreenshots = problems.filter((p) => p.screenshotInGallery);

console.log(`\n[diagnose] Summary:`);
console.log(`  Wrong cover (photos[0] is not "1.*"):  ${badCovers.length}`);
console.log(`  Screenshot leaked into gallery:        ${leakedScreenshots.length}`);
console.log(`\n[diagnose] These cars need resync-photos to fix the order.`);
