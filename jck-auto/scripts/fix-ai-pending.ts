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
 * Fix cars with needsAiProcessing: true.
 *
 * - Re-parses folder name for brand/model/year/engineVolume
 * - Applies known overrides (country, engineVolume, price from folder context)
 * - Calculates priceRub via CBR rates + priceCalculator
 * - Removes duplicates by id (slug)
 * - Sets needsAiProcessing: false
 * - Does NOT call Anthropic API
 *
 * Usage:
 *   npm run fix-pending
 */

import { existsSync } from "fs";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";

const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  dotenvConfig({ path: envLocalPath, override: false });
  console.log(`[fix-pending] Loaded env from ${envLocalPath}`);
}

import type { Car } from "@/types/car";
import { readCatalogJson, writeCatalogJson } from "@/lib/blobStorage";
import { fetchCBRRates } from "@/lib/currency";
import { calculateFullPriceWithRates } from "@/lib/priceCalculator";
import { parseFromFolderName } from "@/lib/screenshotParser";

/**
 * Known overrides for cars that are regularly imported.
 * Key: lowercase slug prefix to match against car.id
 */
interface CarOverride {
  country?: Car["country"];
  currency?: Car["currency"];
  engineVolume?: number;
  power?: number;
  bodyType?: string;
  transmission?: Car["transmission"];
  fuelType?: string;
}

const KNOWN_OVERRIDES: Record<string, CarOverride> = {
  // Korean brands sold via Chinese platforms
  "kia-k3": { country: "china", currency: "CNY", engineVolume: 1.5, power: 115, bodyType: "Седан", fuelType: "Бензин" },
  "kia-k5": { country: "china", currency: "CNY", engineVolume: 1.5, power: 170, bodyType: "Седан" },
  "hyundai-elantra": { country: "china", currency: "CNY", engineVolume: 1.5, power: 115, bodyType: "Седан", fuelType: "Бензин" },
  "hyundai-tucson": { country: "china", currency: "CNY", engineVolume: 1.5, power: 160, bodyType: "Кроссовер" },
  "hyundai-sonata": { country: "china", currency: "CNY", engineVolume: 1.5, power: 160, bodyType: "Седан" },
  // Chinese brands
  "honda-crider": { country: "china", currency: "CNY", engineVolume: 1.0, power: 122, bodyType: "Седан", fuelType: "Бензин" },
  "honda-cr-v": { country: "china", currency: "CNY", engineVolume: 1.5, power: 193, bodyType: "Кроссовер" },
  "honda-xrv": { country: "china", currency: "CNY", engineVolume: 1.5, power: 177, bodyType: "Кроссовер" },
  // Lexus (Chinese market)
  "lexus-nx200": { country: "china", currency: "CNY", engineVolume: 2.0, power: 150, bodyType: "Кроссовер", fuelType: "Бензин" },
  "lexus-nx300": { country: "china", currency: "CNY", engineVolume: 2.0, power: 238, bodyType: "Кроссовер" },
  "lexus-rx350": { country: "china", currency: "CNY", engineVolume: 3.5, power: 300, bodyType: "Кроссовер" },
};

function findOverride(carId: string): CarOverride | undefined {
  // Try exact match first, then prefix match
  for (const [prefix, override] of Object.entries(KNOWN_OVERRIDES)) {
    if (carId.startsWith(prefix)) {
      return override;
    }
  }
  return undefined;
}

function generateDescription(car: Car): string {
  const parts: string[] = [];
  const name = `${car.brand} ${car.model}`.trim();

  if (name && car.year) {
    parts.push(`${name} ${car.year} года.`);
  } else if (name) {
    parts.push(`${name}.`);
  }

  const specs: string[] = [];
  if (car.engineVolume) specs.push(`${car.engineVolume}л`);
  if (car.power) specs.push(`${car.power} л.с.`);
  if (car.transmission === "AT") specs.push("автомат");
  if (car.transmission === "MT") specs.push("механика");
  if (car.drivetrain && car.drivetrain !== "2WD") specs.push(car.drivetrain);
  if (car.fuelType) specs.push(car.fuelType.toLowerCase());

  if (specs.length > 0) {
    parts.push(`Характеристики: ${specs.join(", ")}.`);
  }

  if (car.mileage) {
    parts.push(`Пробег ${car.mileage.toLocaleString("ru-RU")} км.`);
  }

  if (car.bodyType) {
    parts.push(`Тип кузова: ${car.bodyType}.`);
  }

  return parts.join(" ") || `${name || "Автомобиль"} в наличии. Подробности по запросу.`;
}

async function main(): Promise<void> {
  console.log("[fix-pending] Starting...\n");

  // 1. Read catalog
  const catalog = await readCatalogJson();
  console.log(`[fix-pending] Catalog has ${catalog.length} cars total`);

  const pending = catalog.filter((c) => c.needsAiProcessing === true);
  console.log(`[fix-pending] Found ${pending.length} cars with needsAiProcessing: true`);

  if (pending.length === 0) {
    console.log("[fix-pending] Nothing to fix. Exiting.");
    return;
  }

  for (const car of pending) {
    console.log(`\n[fix-pending] --- ${car.id} (folder: "${car.folderName}") ---`);
    console.log(`[fix-pending]   Before: brand="${car.brand}", model="${car.model}", year=${car.year}, price=${car.price}, engineVolume=${car.engineVolume}, country="${car.country}"`);
  }

  // 2. Fetch CBR rates
  console.log("\n[fix-pending] Fetching CBR rates...");
  const rates = await fetchCBRRates();
  console.log(`[fix-pending] Rates: CNY=${rates.CNY}, EUR=${rates.EUR}, date=${rates.date}`);

  // 3. Fix each pending car
  for (const car of pending) {
    console.log(`\n[fix-pending] Fixing: ${car.id}`);

    // Re-parse from folder name for any missing fields
    const parsed = parseFromFolderName(car.folderName || car.id);

    // Fill in missing basic fields from folder name
    if (!car.brand && parsed.brand) car.brand = parsed.brand;
    if (!car.model && parsed.model) car.model = parsed.model;
    if (!car.year && parsed.year) car.year = parsed.year;
    if (!car.engineVolume && parsed.engineVolume) car.engineVolume = parsed.engineVolume;

    // Apply known overrides
    const override = findOverride(car.id);
    if (override) {
      console.log(`[fix-pending]   Applying known override for "${car.id}"`);
      if (override.country) car.country = override.country;
      if (override.currency) car.currency = override.currency;
      if (override.engineVolume && !car.engineVolume) car.engineVolume = override.engineVolume;
      if (override.power && !car.power) car.power = override.power;
      if (override.bodyType && !car.bodyType) car.bodyType = override.bodyType;
      if (override.transmission) car.transmission = override.transmission;
      if (override.fuelType && !car.fuelType) car.fuelType = override.fuelType;
    }

    // Generate a better description
    if (!car.description || car.description.includes("в наличии. Подробности")) {
      car.description = generateDescription(car);
      console.log(`[fix-pending]   Generated description: "${car.description.slice(0, 80)}..."`);
    }

    // Calculate price if possible
    if (car.price > 0 && car.year > 0 && car.engineVolume > 0) {
      try {
        const priceResult = calculateFullPriceWithRates(car, rates);
        car.priceRub = priceResult.totalRub;
        car.exchangeRate = priceResult.exchangeRate;
        car.priceCalculatedAt = new Date().toISOString();
        car.priceBreakdown = priceResult.breakdown;
        console.log(`[fix-pending]   Price calculated: ${priceResult.totalRub.toLocaleString("ru-RU")} ₽`);
      } catch (err) {
        console.error(`[fix-pending]   Price calculation failed:`, err instanceof Error ? err.message : err);
      }
    } else {
      console.warn(`[fix-pending]   Cannot calculate price: price=${car.price}, year=${car.year}, engineVolume=${car.engineVolume}`);
      console.warn(`[fix-pending]   This car needs AI processing or manual price entry.`);
    }

    // Mark as processed
    car.needsAiProcessing = undefined;

    console.log(`[fix-pending]   After: brand="${car.brand}", model="${car.model}", year=${car.year}, price=${car.price}, engineVolume=${car.engineVolume}, country="${car.country}", priceRub=${car.priceRub ?? "N/A"}`);
  }

  // 4. Remove duplicates by id
  const seen = new Set<string>();
  const deduped: Car[] = [];
  let dupCount = 0;

  for (const car of catalog) {
    if (seen.has(car.id)) {
      console.log(`[fix-pending] Removing duplicate: ${car.id} ("${car.folderName}")`);
      dupCount++;
      continue;
    }
    seen.add(car.id);
    deduped.push(car);
  }

  if (dupCount > 0) {
    console.log(`\n[fix-pending] Removed ${dupCount} duplicate(s)`);
  }

  // 5. Save
  console.log(`\n[fix-pending] Saving catalog (${deduped.length} cars)...`);
  await writeCatalogJson(deduped);
  console.log("[fix-pending] Done!");

  // Summary
  console.log("\n[fix-pending] === Summary ===");
  console.log(`  Fixed: ${pending.length} cars`);
  console.log(`  Duplicates removed: ${dupCount}`);
  console.log(`  Final catalog size: ${deduped.length}`);

  const stillMissingPrice = deduped.filter((c) => !c.priceRub || c.priceRub === 0);
  if (stillMissingPrice.length > 0) {
    console.warn(`\n[fix-pending] WARNING: ${stillMissingPrice.length} car(s) still have no priceRub:`);
    for (const c of stillMissingPrice) {
      console.warn(`  - ${c.id}: price=${c.price} ${c.currency}`);
    }
  }
}

main().catch((err) => {
  console.error("[fix-pending] Fatal error:");
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
