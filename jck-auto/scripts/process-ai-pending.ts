/* eslint-disable @typescript-eslint/no-explicit-any */
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection:", reason);
  process.exit(1);
});

/**
 * Process cars with needsAiProcessing: true using Anthropic Vision API.
 *
 * This script is designed to run on a GitHub Actions runner (non-Russian IP)
 * where Anthropic API is accessible. It reads a local catalog.json,
 * finds cars needing AI processing, parses their screenshots via Claude Vision,
 * calculates prices, and saves the updated catalog.
 *
 * Usage:
 *   npx tsx -r tsconfig-paths/register scripts/process-ai-pending.ts ./catalog.json
 *
 * Prerequisites:
 *   - catalog.json downloaded from VDS via SCP
 *   - Screenshots downloaded to ./screenshots/{carId}/ via SCP
 *   - ANTHROPIC_API_KEY env variable set
 *
 * Required env:
 *   ANTHROPIC_API_KEY — for Claude Vision & description generation
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
import { parseCarScreenshot } from "@/lib/screenshotParser";
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
 */
function findScreenshot(carId: string): { buffer: Buffer; mimeType: string } | null {
  const dir = join(SCREENSHOTS_DIR, carId);
  if (!existsSync(dir)) {
    console.warn(`[process-pending]   No screenshot dir: ${dir}`);
    return null;
  }

  const files = readdirSync(dir).filter((f) =>
    /\.(jpe?g|png|webp|gif)$/i.test(f)
  );

  if (files.length === 0) {
    console.warn(`[process-pending]   No image files in ${dir}`);
    return null;
  }

  const file = files[0];
  const filePath = join(dir, file);
  console.log(`[process-pending]   Using screenshot: ${filePath}`);
  return {
    buffer: readFileSync(filePath),
    mimeType: getMimeType(file),
  };
}

async function main(): Promise<void> {
  const catalogPath = process.argv[2];
  if (!catalogPath) {
    console.error("Usage: process-ai-pending.ts <path-to-catalog.json>");
    process.exit(1);
  }

  const resolvedPath = resolve(catalogPath);
  console.log(`[process-pending] Catalog path: ${resolvedPath}`);
  console.log(`[process-pending] Screenshots dir: ${SCREENSHOTS_DIR}`);
  console.log(`[process-pending] Time: ${new Date().toISOString()}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[process-pending] ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }
  console.log(`[process-pending] ANTHROPIC_API_KEY: set (${process.env.ANTHROPIC_API_KEY.length} chars)`);

  if (!existsSync(resolvedPath)) {
    console.error(`[process-pending] File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // 1. Read catalog
  const catalog: Car[] = JSON.parse(readFileSync(resolvedPath, "utf-8"));
  console.log(`[process-pending] Catalog has ${catalog.length} cars`);

  const pending = catalog.filter((c) => c.needsAiProcessing === true);
  console.log(`[process-pending] Found ${pending.length} cars with needsAiProcessing: true`);

  if (pending.length === 0) {
    console.log("[process-pending] Nothing to process. Exiting.");
    return;
  }

  // 2. Process each pending car with AI
  let processedCount = 0;
  let errorCount = 0;

  for (const car of pending) {
    console.log(`\n[process-pending] === Processing: ${car.id} (folder: "${car.folderName}") ===`);
    console.log(`[process-pending]   Before: brand="${car.brand}", model="${car.model}", year=${car.year}, price=${car.price}`);

    const screenshot = findScreenshot(car.id);
    if (!screenshot) {
      console.warn(`[process-pending]   SKIP: no screenshot found for ${car.id}`);
      errorCount++;
      continue;
    }

    // Parse screenshot with Claude Vision API
    try {
      let parsed: Partial<Car> & { needsAiProcessing?: boolean };
      try {
        console.log("[process-pending]   Calling Claude Vision API (attempt 1)...");
        parsed = await parseCarScreenshot(screenshot.buffer, car.folderName, false, screenshot.mimeType);
      } catch (firstErr) {
        console.warn(`[process-pending]   First attempt failed: ${firstErr instanceof Error ? firstErr.message : firstErr}`);
        console.warn("[process-pending]   Retrying in 2s with simplified prompt...");
        await new Promise((r) => setTimeout(r, 2000));
        parsed = await parseCarScreenshot(screenshot.buffer, car.folderName, true, screenshot.mimeType);
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

      console.log(`[process-pending]   After: brand="${car.brand}", model="${car.model}", year=${car.year}, price=${car.price}, engineVolume=${car.engineVolume}`);
    } catch (err) {
      console.error(`[process-pending]   ERROR processing ${car.id}:`, err instanceof Error ? err.message : err);
      errorCount++;
    }
  }

  // 3. Calculate prices for all processed cars
  console.log("\n[process-pending] Fetching CBR rates...");
  const rates = await fetchCBRRates();
  console.log(`[process-pending] Rates: CNY=${rates.CNY}, EUR=${rates.EUR}, date=${rates.date}`);

  let priceCount = 0;
  for (const car of catalog) {
    // Recalculate for cars that were just processed, or any car missing priceRub
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
  console.log("\n[process-pending] === Summary ===");
  console.log(`  AI processed: ${processedCount}`);
  console.log(`  Prices calculated: ${priceCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Still pending: ${catalog.filter((c) => c.needsAiProcessing).length}`);

  if (errorCount > 0) {
    console.warn("\n[process-pending] Finished with errors.");
    process.exit(1);
  }

  console.log("\n[process-pending] Done.");
}

main().catch((err) => {
  console.error("[process-pending] Fatal error:");
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
