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

const MAX_NEW_PER_RUN = 10;

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

      // 4f. Upload photos to Blob
      console.log(
        `[sync]   Uploading ${files.photos.length} photos to Blob...`
      );
      const photoUrls: string[] = [];

      for (const photo of files.photos) {
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

  // 6. Build updated catalog
  const remainingCars = currentCatalog.filter(
    (c) => !removedCars.some((r) => r.id === c.id)
  );
  const updatedCatalog = [...remainingCars, ...newCars];

  // 7. Save to Blob
  console.log(
    `[sync] Saving catalog (${updatedCatalog.length} cars) to Blob...`
  );
  await writeCatalogJson(updatedCatalog);
  console.log("[sync] Sync complete");

  return result;
}
