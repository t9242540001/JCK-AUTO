/* eslint-disable @typescript-eslint/no-explicit-any */
// Global error handlers — must be FIRST, before any imports that might crash
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection:", reason);
  process.exit(1);
});

// Force unbuffered output for GitHub Actions log streaming
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
console.log = (...args: any[]) => {
  originalLog(...args);
  process.stdout.write("");
};
console.error = (...args: any[]) => {
  originalError(...args);
  process.stderr.write("");
};
console.warn = (...args: any[]) => {
  originalWarn(...args);
  process.stderr.write("");
};

/**
 * Process cars needing AI using Anthropic Vision API on GitHub Actions runner.
 *
 * Finds cars by TWO criteria:
 *   1. needsAiProcessing === true  (explicit flag from sync-catalog)
 *   2. price === 0 && !priceRub    (fallback: AI was blocked, folder-name parse gave price 0)
 *
 * For each: reads screenshot from ./screenshots/{carId}/, sends to Claude Vision,
 * generates description, calculates priceRub.
 *
 * Usage:
 *   npx tsx -r tsconfig-paths/register scripts/process-ai-pending.ts ./catalog.json
 *
 * Required env:
 *   ANTHROPIC_API_KEY
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { config as dotenvConfig } from "dotenv";

const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  dotenvConfig({ path: envLocalPath, override: false });
  console.log(`[process-pending] Loaded env from ${envLocalPath}`);
}

import type { Car } from "@/types/car";
import { parseCarScreenshot, parseCarMultipleScreenshots } from "@/lib/screenshotParser";
import { generateCarDescription } from "@/lib/descriptionGenerator";
import { fetchCBRRates } from "@/lib/currency";
import { calculateFullPriceWithRates } from "@/lib/priceCalculator";

const SCREENSHOTS_DIR = resolve(process.cwd(), "screenshots");

function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  switch (ext) {
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    default: return "image/jpeg";
  }
}

/**
 * Find the first screenshot file in ./screenshots/{carId}/
 * Also tries extracting carId from photos[0] path as fallback.
 */
function findScreenshot(car: Car): ScreenshotResult | null {
  // Primary: look in ./screenshots/{carId}/
  const primaryDir = join(SCREENSHOTS_DIR, car.id);
  console.log(`[process-pending]   Looking for screenshot in: ${primaryDir}`);

  if (existsSync(primaryDir)) {
    const found = findImageInDir(primaryDir);
    if (found) return found;
  }

  // Fallback: extract directory name from photos[0] path
  // photos[0] looks like "/storage/catalog/honda-crider-2019-180turbo-luxur/filename.jpeg"
  if (car.photos && car.photos.length > 0) {
    const photoPath = car.photos[0];
    const match = photoPath.match(/\/storage\/catalog\/([^/]+)\//);
    if (match) {
      const photoCarId = match[1];
      if (photoCarId !== car.id) {
        console.log(`[process-pending]   Trying photo path carId: ${photoCarId}`);
        const altDir = join(SCREENSHOTS_DIR, photoCarId);
        if (existsSync(altDir)) {
          const found = findImageInDir(altDir);
          if (found) return found;
        }
      }
    }
  }

  console.warn(`[process-pending]   No screenshot found for ${car.id}`);

  // List what's actually in screenshots/ for debugging
  if (existsSync(SCREENSHOTS_DIR)) {
    try {
      const dirs = readdirSync(SCREENSHOTS_DIR);
      console.warn(`[process-pending]   Available screenshot dirs: ${dirs.join(", ") || "(empty)"}`);
    } catch { /* ignore */ }
  }

  return null;
}

type ScreenshotResult = {
  buffer: Buffer;
  mimeType: string;
  isSingleScreenshot: true;
} | {
  images: { buffer: Buffer; mimeType: string; fileName: string }[];
  isSingleScreenshot: false;
};

function findImageInDir(dir: string): ScreenshotResult | null {
  try {
    const files = readdirSync(dir).filter((f) =>
      /\.(jpe?g|png|webp|gif)$/i.test(f)
    );
    if (files.length === 0) {
      console.warn(`[process-pending]   No image files in ${dir}`);
      return null;
    }

    console.log(`[process-pending]   Available files in dir: ${files.join(", ")}`);

    // Priority 1: file starting with "2" (marketplace listing screenshot with price/specs)
    let file = files.find((f) => /^2\./i.test(f));
    if (file) {
      const filePath = join(dir, file);
      const buffer = readFileSync(filePath);
      console.log(`[process-pending]   Using screenshot '${file}' (marketplace listing screenshot) — ${filePath} (${buffer.length} bytes)`);
      return { buffer, mimeType: getMimeType(file), isSingleScreenshot: true };
    }

    // Priority 2: file named "screenshot.*"
    file = files.find((f) => /^screenshot\./i.test(f));
    if (file) {
      const filePath = join(dir, file);
      const buffer = readFileSync(filePath);
      console.log(`[process-pending]   Using screenshot '${file}' (named screenshot) — ${filePath} (${buffer.length} bytes)`);
      return { buffer, mimeType: getMimeType(file), isSingleScreenshot: true };
    }

    // Priority 3: no clear screenshot — send ALL images for multi-image analysis
    console.log(`[process-pending]   No '2.*' or 'screenshot.*' found — using multi-image mode with ${files.length} images`);
    const images = files.map((f) => ({
      buffer: readFileSync(join(dir, f)),
      mimeType: getMimeType(f),
      fileName: f,
    }));
    return { images, isSingleScreenshot: false };
  } catch (err) {
    console.error(`[process-pending]   Error reading dir ${dir}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Determine if a car needs AI processing:
 *   1. needsAiProcessing === true (explicit flag)
 *   2. price === 0 && !priceRub   (fallback — AI was blocked, got folder-name defaults)
 */
function needsProcessing(car: Car): boolean {
  if (car.needsAiProcessing === true) return true;
  if (car.price === 0 && !car.priceRub) return true;
  return false;
}

async function main(): Promise<void> {
  console.log("[process-pending] === Script started ===");
  console.log(`[process-pending] Node: ${process.version}`);
  console.log(`[process-pending] CWD: ${process.cwd()}`);
  console.log(`[process-pending] Time: ${new Date().toISOString()}`);
  console.log(`[process-pending] argv: ${process.argv.join(" ")}`);

  const catalogPath = process.argv[2];
  if (!catalogPath) {
    console.error("Usage: process-ai-pending.ts <path-to-catalog.json>");
    process.exit(1);
  }

  const resolvedPath = resolve(catalogPath);
  console.log(`[process-pending] Catalog path: ${resolvedPath}`);
  console.log(`[process-pending] Screenshots dir: ${SCREENSHOTS_DIR}`);

  // Validate env
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[process-pending] ERROR: ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }
  const keyLen = process.env.ANTHROPIC_API_KEY.length;
  console.log(`[process-pending] ANTHROPIC_API_KEY: set (${keyLen} chars)`);
  if (keyLen < 50) {
    console.warn(`[process-pending] WARNING: ANTHROPIC_API_KEY is suspiciously short (${keyLen} chars)`);
  }

  // Validate catalog file
  if (!existsSync(resolvedPath)) {
    console.error(`[process-pending] ERROR: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // Debug: list screenshots directory
  console.log(`\n[process-pending] Screenshots directory contents:`);
  if (existsSync(SCREENSHOTS_DIR)) {
    try {
      const topLevel = readdirSync(SCREENSHOTS_DIR);
      console.log(`[process-pending]   ${SCREENSHOTS_DIR}: ${topLevel.join(", ") || "(empty)"}`);
      for (const d of topLevel) {
        const subDir = join(SCREENSHOTS_DIR, d);
        try {
          const files = readdirSync(subDir);
          console.log(`[process-pending]   ${d}/: ${files.join(", ") || "(empty)"}`);
        } catch { /* not a directory */ }
      }
    } catch (err) {
      console.error(`[process-pending]   Error listing: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    console.warn(`[process-pending]   Directory does not exist: ${SCREENSHOTS_DIR}`);
  }

  // 1. Read catalog
  console.log(`\n[process-pending] Reading catalog...`);
  let catalog: Car[];
  try {
    catalog = JSON.parse(readFileSync(resolvedPath, "utf-8"));
  } catch (err) {
    console.error(`[process-pending] ERROR: Failed to parse catalog.json:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
  console.log(`[process-pending] Catalog has ${catalog.length} cars`);

  // Find cars needing processing (two criteria)
  const pending = catalog.filter(needsProcessing);
  const byFlag = catalog.filter((c) => c.needsAiProcessing === true).length;
  const byPrice = catalog.filter((c) => c.price === 0 && !c.priceRub && !c.needsAiProcessing).length;
  console.log(`[process-pending] Found ${pending.length} cars needing processing:`);
  console.log(`[process-pending]   - needsAiProcessing: true → ${byFlag}`);
  console.log(`[process-pending]   - price=0 && no priceRub  → ${byPrice}`);

  for (const car of pending) {
    console.log(`[process-pending]   - ${car.id}: price=${car.price}, priceRub=${car.priceRub ?? "N/A"}, needsAi=${car.needsAiProcessing ?? false}`);
  }

  if (pending.length === 0) {
    console.log("[process-pending] Nothing to process. Exiting.");
    return;
  }

  // 2. Process each pending car with AI
  let processedCount = 0;
  let errorCount = 0;

  for (const car of pending) {
    console.log(`\n[process-pending] === Processing: ${car.id} ===`);
    console.log(`[process-pending]   folderName: "${car.folderName}"`);
    console.log(`[process-pending]   Before: brand="${car.brand}", model="${car.model}", year=${car.year}, price=${car.price} ${car.currency}`);
    console.log(`[process-pending]   photos: ${car.photos?.length ?? 0} (first: "${car.photos?.[0] ?? "none"}")`);

    const screenshot = findScreenshot(car);
    if (!screenshot) {
      console.warn(`[process-pending]   SKIP: no screenshot found for ${car.id}`);
      errorCount++;
      continue;
    }

    // Parse screenshot with Claude Vision API
    try {
      let parsed: Partial<Car> & { needsAiProcessing?: boolean };
      try {
        if (screenshot.isSingleScreenshot) {
          // Single identified screenshot (2.jpg or screenshot.*)
          console.log("[process-pending]   Calling Claude Vision API — single image mode (attempt 1)...");
          parsed = await parseCarScreenshot(screenshot.buffer, car.folderName, false, screenshot.mimeType);
        } else {
          // Multiple images — let Claude find the listing among them
          console.log(`[process-pending]   Calling Claude Vision API — multi-image mode (${screenshot.images.length} images)...`);
          parsed = await parseCarMultipleScreenshots(screenshot.images, car.folderName);
        }
        console.log("[process-pending]   API call succeeded (attempt 1)");
      } catch (firstErr) {
        console.warn(`[process-pending]   First attempt failed: ${firstErr instanceof Error ? firstErr.message : firstErr}`);
        if (firstErr instanceof Error && firstErr.stack) {
          console.warn(`[process-pending]   Stack: ${firstErr.stack}`);
        }
        console.warn("[process-pending]   Retrying in 2s with simplified prompt...");
        await new Promise((r) => setTimeout(r, 2000));
        if (screenshot.isSingleScreenshot) {
          parsed = await parseCarScreenshot(screenshot.buffer, car.folderName, true, screenshot.mimeType);
        } else {
          // Retry multi-image (same function, no separate retry mode needed)
          parsed = await parseCarMultipleScreenshots(screenshot.images, car.folderName);
        }
        console.log("[process-pending]   API call succeeded (attempt 2)");
      }

      if (parsed.needsAiProcessing) {
        console.error(`[process-pending]   AI still blocked for ${car.id} — this should not happen on runner!`);
        errorCount++;
        continue;
      }

      // Update car fields from AI response
      if (parsed.brand) car.brand = parsed.brand;
      if (parsed.model) car.model = parsed.model;
      if (parsed.year) car.year = parsed.year;
      if (parsed.price) car.price = parsed.price;
      if (parsed.currency) car.currency = parsed.currency;
      if (parsed.mileage) car.mileage = parsed.mileage;
      if (parsed.engineVolume) car.engineVolume = parsed.engineVolume;
      if (parsed.transmission) car.transmission = parsed.transmission;
      if (parsed.drivetrain) car.drivetrain = parsed.drivetrain;
      if (parsed.fuelType) car.fuelType = parsed.fuelType;
      if (parsed.color) car.color = parsed.color;
      if (parsed.power) car.power = parsed.power;
      if (parsed.bodyType) car.bodyType = parsed.bodyType;
      if (parsed.location) car.location = parsed.location;
      if (parsed.condition) car.condition = parsed.condition;
      if (parsed.features && parsed.features.length > 0) car.features = parsed.features;
      if (parsed.isNativeMileage !== undefined) car.isNativeMileage = parsed.isNativeMileage;
      if (parsed.hasInspectionReport !== undefined) car.hasInspectionReport = parsed.hasInspectionReport;
      if (parsed.folderName) car.folderName = parsed.folderName;

      console.log(`[process-pending]   Parsed: ${car.brand} ${car.model} ${car.year}, price: ${car.price} ${car.currency}`);

      // Generate description via AI
      if (!car.description || car.description.includes("в наличии. Подробности")) {
        console.log("[process-pending]   Generating description...");
        car.description = await generateCarDescription(car as Car);
        console.log(`[process-pending]   Description: "${car.description.slice(0, 80)}..."`);
      }

      // Clear the flag
      car.needsAiProcessing = undefined;
      processedCount++;

      console.log(`[process-pending]   After: brand="${car.brand}", model="${car.model}", year=${car.year}, price=${car.price}, engineVolume=${car.engineVolume}, power=${car.power}`);
    } catch (err) {
      console.error(`[process-pending]   ERROR processing ${car.id}:`, err instanceof Error ? err.message : err);
      if (err instanceof Error && err.stack) {
        console.error(`[process-pending]   Stack: ${err.stack}`);
      }
      errorCount++;
    }
  }

  // 3. Calculate prices for all processed cars + any missing priceRub
  console.log("\n[process-pending] Fetching CBR rates...");
  const rates = await fetchCBRRates();
  console.log(`[process-pending] Rates: CNY=${rates.CNY}, EUR=${rates.EUR}, KRW=${rates.KRW}, JPY=${rates.JPY}, date=${rates.date}`);

  let priceCount = 0;
  for (const car of catalog) {
    const needsPrice = !car.needsAiProcessing && car.price > 0 && car.year > 0 && car.engineVolume > 0 && !car.priceRub;
    if (needsPrice) {
      try {
        const priceResult = calculateFullPriceWithRates(car, rates);
        car.priceRub = priceResult.totalRub;
        car.exchangeRate = priceResult.exchangeRate;
        car.priceCalculatedAt = new Date().toISOString();
        car.priceBreakdown = priceResult.breakdown;
        priceCount++;
        console.log(`[process-pending]   Price for ${car.id}: ${priceResult.totalRub.toLocaleString("ru-RU")} ₽`);
      } catch (err) {
        console.error(`[process-pending]   Price calc failed for ${car.id}:`, err instanceof Error ? err.message : err);
      }
    }
  }
  console.log(`[process-pending] Calculated prices for ${priceCount} cars`);

  // 4. Save updated catalog
  console.log(`\n[process-pending] Saving catalog (${catalog.length} cars) to ${resolvedPath}...`);
  writeFileSync(resolvedPath, JSON.stringify(catalog, null, 2), "utf-8");
  console.log("[process-pending] Saved.");

  // Summary
  const stillPending = catalog.filter(needsProcessing);
  console.log("\n[process-pending] === Summary ===");
  console.log(`  AI processed: ${processedCount}`);
  console.log(`  Prices calculated: ${priceCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Still needing processing: ${stillPending.length}`);
  if (stillPending.length > 0) {
    for (const c of stillPending) {
      console.warn(`  - ${c.id}: price=${c.price}, priceRub=${c.priceRub ?? "N/A"}`);
    }
  }

  if (processedCount === 0 && errorCount > 0) {
    console.error("\n[process-pending] FATAL: All cars failed AI processing. Exiting with error.");
    process.exit(1);
  } else if (errorCount > 0) {
    console.warn("\n[process-pending] Finished with partial success (catalog saved).");
  }

  console.log("\n[process-pending] Done.");
}

main().catch((err) => {
  console.error("[process-pending] Fatal error:");
  if (err instanceof Error) {
    console.error(err.stack || err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
