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
import { fetchCBRRates } from "./currency";

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
  const driveFolders = await listCarFolders();
  console.log(`[sync] Found ${driveFolders.length} folders on Drive`);

  // 2. Load current catalog from Blob
  console.log("[sync] Loading current catalog from Blob...");
  const currentCatalog = await readCatalogJson();
  console.log(`[sync] Current catalog has ${currentCatalog.length} cars`);

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

  // 3.5. Fetch CBR rates for price calculation
  console.log("[sync] Fetching CBR exchange rates...");
  const rates = await fetchCBRRates();
  console.log(`[sync] Rates: CNY=${rates.CNY}, EUR=${rates.EUR}, date=${rates.date}`);

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
    console.log(`[sync] Processing folder: "${folder.name}" (${slug})`);

    try {
      // 4a. List files in folder
      const files = await listFolderFiles(folder.id);
      console.log(
        `[sync]   Screenshots: ${files.screenshots.length}, Photos: ${files.photos.length}`
      );

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
      console.log(`[sync]   Downloading screenshot: ${screenshot.name}`);
      const screenshotBuffer = await downloadFile(screenshot.id);

      console.log("[sync]   Parsing screenshot with Claude Vision...");
      const parsed = await parseCarScreenshot(screenshotBuffer, folder.name);

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
        createdAt: new Date().toISOString(),
      };

      // 4e. Generate description
      console.log("[sync]   Generating description with Claude...");
      const description = await generateCarDescription(partialCar);

      // 4f. Upload photos to Blob (cover photo first, then alphabetical)
      console.log(
        `[sync]   Uploading ${files.photos.length} photos to Blob...`
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
        const buffer = await downloadFile(photo.id);
        const url = await uploadCarPhoto(
          slug,
          photo.name,
          buffer,
          photo.mimeType
        );
        photoUrls.push(url);
      }

      // 4g. Assemble final Car object
      const car: Car = {
        ...partialCar,
        photos: photoUrls.length > 0 ? photoUrls : ["/images/cars/placeholder.jpg"],
        description,
      };

      // 4h. Calculate price in rubles
      try {
        console.log("[sync]   Calculating price in rubles...");
        const priceResult = calculateFullPriceWithRates(car, rates);
        car.priceRub = priceResult.totalRub;
        car.exchangeRate = priceResult.exchangeRate;
        car.priceCalculatedAt = new Date().toISOString();
        car.priceBreakdown = priceResult.breakdown;
        console.log(`[sync]   Price: ${priceResult.totalRub.toLocaleString("ru-RU")} ₽`);
      } catch (priceErr) {
        console.error("[sync]   Price calculation failed:", priceErr);
      }

      newCars.push(car);
      result.added.push(folder.name);
      console.log(`[sync]   Done: ${folder.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sync]   Error processing "${folder.name}": ${message}`);
      result.errors.push({ folder: folder.name, error: message });
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

  let recalcCount = 0;
  for (const car of remainingCars) {
    const needsRecalc =
      !car.priceRub ||
      !car.priceCalculatedAt ||
      Date.now() - new Date(car.priceCalculatedAt).getTime() >
        24 * 60 * 60 * 1000;

    if (needsRecalc && rates) {
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

  // 6. Build updated catalog
  const updatedCatalog = [...remainingCars, ...newCars];

  // 7. Save to Blob
  console.log(
    `[sync] Saving catalog (${updatedCatalog.length} cars) to Blob...`
  );
  await writeCatalogJson(updatedCatalog);
  console.log("[sync] Sync complete");

  return result;
}
