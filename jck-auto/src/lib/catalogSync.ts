import type { Car, SyncResult } from "@/types/car";
import { listCarFolders, listFolderFiles, downloadFile } from "./googleDrive";
import {
  uploadCarPhoto,
  deleteCarPhotos,
  readCatalogJson,
  writeCatalogJson,
} from "./blobStorage";
import { parseCarScreenshot } from "./screenshotParser";
import { generateCarDescription } from "./descriptionGenerator";
import { generateSlug } from "./carUtils";
import { calculateFullPriceWithRates } from "./priceCalculator";
import { fetchCBRRates, type CBRRates } from "./currency";

const MAX_NEW_PER_RUN = 10;

const COVER_KEYWORDS = ["1", "front", "перед", "перёд", "обложка", "cover"];

/**
 * Find the index of the cover photo in a list of files.
 * Matches exact base name (without extension) or base name starting with a keyword
 * followed by a separator (_, -, space).
 * Returns -1 if no cover photo found.
 */
export function findCoverPhotoIndex(files: { name: string }[]): number {
  for (let i = 0; i < files.length; i++) {
    const baseName = files[i].name.replace(/\.[^.]+$/, "").toLowerCase();
    for (const kw of COVER_KEYWORDS) {
      if (baseName === kw) return i;
      if (baseName.startsWith(kw) && /^[_\- ]/.test(baseName.slice(kw.length))) {
        return i;
      }
    }
  }
  return -1;
}

export async function syncCatalog(): Promise<SyncResult> {
  const result: SyncResult = {
    added: [],
    removed: [],
    updated: [],
    errors: [],
  };

  // 1. Get folder list from Google Drive
  console.log("[sync] Listing car folders from Google Drive...");
  let driveFolders;
  try {
    driveFolders = await listCarFolders();
    console.log(`[sync] Found ${driveFolders.length} folders on Drive`);
  } catch (err) {
    console.error("[sync] FATAL: Failed to list Google Drive folders:", err instanceof Error ? err.stack : err);
    throw err;
  }

  // 2. Load current catalog
  console.log("[sync] Loading current catalog...");
  let currentCatalog: Car[];
  try {
    currentCatalog = await readCatalogJson();
    console.log(`[sync] Current catalog has ${currentCatalog.length} cars`);
  } catch (err) {
    console.error("[sync] FATAL: Failed to read catalog.json:", err instanceof Error ? err.stack : err);
    throw err;
  }

  // 3. Determine new, removed, existing
  const driveSlugMap = new Map(
    driveFolders.map((f) => [generateSlug(f.name), f])
  );
  const catalogSlugSet = new Set(currentCatalog.map((c) => c.id));

  const newFolders = driveFolders.filter(
    (f) => !catalogSlugSet.has(generateSlug(f.name))
  );
  const removedCars = currentCatalog.filter(
    (c) => !driveSlugMap.has(c.id)
  );

  console.log(
    `[sync] New: ${newFolders.length}, Removed: ${removedCars.length}`
  );
  if (newFolders.length > 0) {
    console.log(`[sync] New folders: ${newFolders.map((f) => f.name).join(", ")}`);
  }

  // 3.5. Fetch CBR rates for price calculation
  let rates: CBRRates | null = null;
  try {
    console.log("[sync] Fetching CBR exchange rates...");
    rates = await fetchCBRRates();
    console.log(`[sync] Rates: CNY=${rates.CNY}, EUR=${rates.EUR}, date=${rates.date}`);
  } catch (err) {
    console.error("[sync] WARNING: Failed to fetch CBR rates, prices won't be calculated:", err instanceof Error ? err.message : err);
  }

  // 4. Process new folders (limited to MAX_NEW_PER_RUN)
  const toProcess = newFolders.slice(0, MAX_NEW_PER_RUN);
  if (newFolders.length > MAX_NEW_PER_RUN) {
    console.log(
      `[sync] Processing first ${MAX_NEW_PER_RUN} of ${newFolders.length} new folders`
    );
  }

  const newCars: Car[] = [];

  for (const folder of toProcess) {
    const slug = generateSlug(folder.name);
    console.log(`\n[sync] === Processing folder: "${folder.name}" (${slug}) ===`);

    try {
      // 4a. List files in folder
      console.log(`[sync]   Listing files in folder "${folder.name}"...`);
      const files = await listFolderFiles(folder.id);
      console.log(
        `[sync]   Screenshots: ${files.screenshots.length}, Photos: ${files.photos.length}`
      );

      if (files.screenshots.length === 0 && files.photos.length === 0) {
        throw new Error("No image files found in folder");
      }

      // 4b. Find screenshot
      const screenshot =
        files.screenshots[0] ||
        files.photos.find((f) =>
          f.mimeType.toLowerCase().includes("png")
        );

      if (!screenshot) {
        throw new Error("No screenshot or PNG file found in folder");
      }

      // 4c. Download screenshot and parse
      console.log(`[sync]   Downloading screenshot: "${screenshot.name}" (${screenshot.mimeType})...`);
      let screenshotBuffer: Buffer;
      try {
        screenshotBuffer = await downloadFile(screenshot.id);
        console.log(`[sync]   Screenshot downloaded: ${screenshotBuffer.length} bytes, isBuffer: ${Buffer.isBuffer(screenshotBuffer)}`);
      } catch (dlErr) {
        console.error(`[sync]   Failed to download screenshot "${screenshot.name}":`, dlErr instanceof Error ? dlErr.stack : dlErr);
        throw dlErr;
      }

      console.log("[sync]   Parsing screenshot with Claude Vision...");
      const screenshotMime = screenshot.mimeType || "image/jpeg";
      let parsed: Partial<Car> & { needsAiProcessing?: boolean };
      try {
        parsed = await parseCarScreenshot(screenshotBuffer, folder.name, false, screenshotMime);
      } catch (firstErr) {
        console.warn(`[sync]   First parse attempt failed for "${folder.name}": ${firstErr instanceof Error ? firstErr.message : firstErr}`);
        console.warn("[sync]   Retrying in 2s...");
        await new Promise((r) => setTimeout(r, 2000));
        parsed = await parseCarScreenshot(screenshotBuffer, folder.name, true, screenshotMime);
      }

      const needsAi = parsed.needsAiProcessing === true;
      if (needsAi) {
        console.log(`[sync]   AI processing skipped for "${folder.name}", will retry from unblocked IP`);
      } else {
        console.log(`[sync]   Parsed: ${parsed.brand} ${parsed.model} ${parsed.year}, price: ${parsed.price} ${parsed.currency}`);
      }

      // 4d. Build partial car for description generation
      const partialCar: Car = {
        id: slug,
        folderName: parsed.folderName || folder.name,
        brand: parsed.brand || "",
        model: parsed.model || "",
        year: parsed.year || 0,
        price: parsed.price || 0,
        currency: parsed.currency || "CNY",
        country: "china",
        mileage: parsed.mileage || 0,
        engineVolume: parsed.engineVolume || 0,
        transmission: parsed.transmission || "AT",
        drivetrain: parsed.drivetrain || "2WD",
        fuelType: parsed.fuelType || "Бензин",
        color: parsed.color || "",
        power: parsed.power || 0,
        bodyType: parsed.bodyType || "",
        photos: [],
        features: parsed.features || [],
        condition: parsed.condition || "",
        location: parsed.location || "",
        isNativeMileage: parsed.isNativeMileage ?? false,
        hasInspectionReport: parsed.hasInspectionReport ?? false,
        needsAiProcessing: needsAi || undefined,
        createdAt: new Date().toISOString(),
      };

      // 4e. Generate description (has its own fallback)
      console.log("[sync]   Generating description...");
      const description = await generateCarDescription(partialCar);
      console.log(`[sync]   Description: "${description.slice(0, 80)}..."`);

      // 4f. Upload photos (cover photo first, then alphabetical)
      console.log(
        `[sync]   Uploading ${files.photos.length} photos...`
      );
      const photoUrls: string[] = [];

      const coverIdx = findCoverPhotoIndex(files.photos);
      let orderedPhotos: typeof files.photos;
      if (coverIdx >= 0) {
        const cover = files.photos[coverIdx];
        const rest = files.photos
          .filter((_, i) => i !== coverIdx)
          .sort((a, b) => a.name.localeCompare(b.name));
        orderedPhotos = [cover, ...rest];
        console.log(`[sync]   Cover photo: "${cover.name}"`);
      } else {
        orderedPhotos = [...files.photos];
      }

      for (const photo of orderedPhotos) {
        try {
          console.log(`[sync]   Downloading photo: "${photo.name}"...`);
          const buffer = await downloadFile(photo.id);
          console.log(`[sync]   Photo downloaded: ${buffer.length} bytes`);
          const url = await uploadCarPhoto(
            slug,
            photo.name,
            buffer,
            photo.mimeType
          );
          photoUrls.push(url);
        } catch (photoErr) {
          console.error(`[sync]   Failed to download/upload photo "${photo.name}":`, photoErr instanceof Error ? photoErr.message : photoErr);
          // Continue with other photos
        }
      }

      // 4g. Assemble final Car object
      const car: Car = {
        ...partialCar,
        photos: photoUrls.length > 0 ? photoUrls : ["/images/cars/placeholder.jpg"],
        description,
      };

      // 4h. Calculate price in rubles
      if (rates && car.price > 0) {
        try {
          console.log("[sync]   Calculating price in rubles...");
          const priceResult = calculateFullPriceWithRates(car, rates);
          car.priceRub = priceResult.totalRub;
          car.exchangeRate = priceResult.exchangeRate;
          car.priceCalculatedAt = new Date().toISOString();
          car.priceBreakdown = priceResult.breakdown;
          console.log(`[sync]   Price: ${priceResult.totalRub.toLocaleString("ru-RU")} ₽`);
        } catch (priceErr) {
          console.error("[sync]   Price calculation failed:", priceErr instanceof Error ? priceErr.message : priceErr);
        }
      } else if (!rates) {
        console.warn("[sync]   Skipping price calculation (no CBR rates)");
      } else {
        console.warn("[sync]   Skipping price calculation (price is 0, needs AI processing)");
      }

      newCars.push(car);
      result.added.push(folder.name);
      console.log(`[sync]   Done: "${folder.name}" (photos: ${photoUrls.length}, needsAi: ${needsAi})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error(`[sync]   ERROR processing "${folder.name}": ${message}`);
      if (stack) console.error(`[sync]   Stack: ${stack}`);
      result.errors.push({ folder: folder.name, error: message });
      // Continue with next folder
    }
  }

  // 5. Remove deleted cars
  for (const car of removedCars) {
    console.log(`[sync] Removing car: ${car.id}`);
    try {
      await deleteCarPhotos(car.id);
      result.removed.push(car.folderName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sync]   Error removing "${car.id}": ${message}`);
      result.errors.push({ folder: car.folderName, error: message });
    }
  }

  // 5.5. Recalculate prices for existing cars without priceRub or with stale rates (>24h)
  const remainingCars = currentCatalog.filter(
    (c) => !removedCars.some((r) => r.id === c.id)
  );

  // 5.6. Clean "Used" prefix from brand/model of existing cars
  let cleanedCount = 0;
  for (const car of remainingCars) {
    let cleaned = false;
    if (car.brand && /^Used\s+/i.test(car.brand)) {
      car.brand = car.brand.replace(/^Used\s+/i, "").trim();
      cleaned = true;
    }
    if (car.model && /^Used\s+/i.test(car.model)) {
      car.model = car.model.replace(/^Used\s+/i, "").trim();
      cleaned = true;
    }
    if (cleaned) cleanedCount++;
  }
  if (cleanedCount > 0) {
    console.log(`[sync] Cleaned "Used" prefix from ${cleanedCount} car names`);
  }

  let recalcCount = 0;
  if (rates) {
    for (const car of remainingCars) {
      const needsRecalc =
        !car.priceRub ||
        !car.priceCalculatedAt ||
        Date.now() - new Date(car.priceCalculatedAt).getTime() >
          24 * 60 * 60 * 1000;

      if (needsRecalc) {
        try {
          const priceResult = calculateFullPriceWithRates(car, rates);
          car.priceRub = priceResult.totalRub;
          car.exchangeRate = priceResult.exchangeRate;
          car.priceCalculatedAt = new Date().toISOString();
          car.priceBreakdown = priceResult.breakdown;
          recalcCount++;
        } catch (err) {
          console.error(
            `[sync] Price recalc failed for "${car.id}":`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }
    if (recalcCount > 0) {
      console.log(`[sync] Recalculated prices for ${recalcCount} existing cars`);
    }
  } else {
    console.warn("[sync] Skipping price recalculation (no CBR rates)");
  }

  // 6. Build updated catalog
  const updatedCatalog = [...remainingCars, ...newCars];

  // 7. Save catalog
  console.log(
    `[sync] Saving catalog (${updatedCatalog.length} cars)...`
  );
  try {
    await writeCatalogJson(updatedCatalog);
    console.log("[sync] Catalog saved successfully");
  } catch (err) {
    console.error("[sync] FATAL: Failed to write catalog.json:", err instanceof Error ? err.stack : err);
    throw err;
  }

  console.log("[sync] Sync complete");
  return result;
}
