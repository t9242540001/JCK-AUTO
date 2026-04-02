import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { listCarFolders, listFolderFiles, downloadFile } from "@/lib/googleDrive";
import {
  readCatalogJson,
  writeCatalogJson,
  uploadCarPhoto,
  deleteCarPhotos,
} from "@/lib/blobStorage";
import { findCoverPhotoIndex } from "@/lib/catalogSync";
import { generateSlug } from "@/lib/carUtils";
import { calculateFullPriceWithRates } from "@/lib/priceCalculator";
import { fetchCBRRates } from "@/lib/currencyRates";

export const maxDuration = 300;

const MAX_PER_RUN = 20;

export async function POST(request: NextRequest) {
  const secret = process.env.CATALOG_SYNC_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    console.log("[resync-photos] Starting photo resync...");

    // 1. Load current catalog
    const catalog = await readCatalogJson();
    if (catalog.length === 0) {
      return NextResponse.json({ updated: 0, errors: ["Catalog is empty"] });
    }
    console.log(`[resync-photos] Catalog has ${catalog.length} cars`);

    // 2. Get Drive folders and CBR rates
    const [driveFolders, rates] = await Promise.all([
      listCarFolders(),
      fetchCBRRates(),
    ]);
    console.log(`[resync-photos] Found ${driveFolders.length} Drive folders`);

    // Build a map: slug → Drive folder
    const slugToFolder = new Map(
      driveFolders.map((f) => [generateSlug(f.name), f]),
    );

    // 3. Process each car (limited to MAX_PER_RUN)
    const toProcess = catalog.slice(0, MAX_PER_RUN);
    let updatedCount = 0;
    const errors: string[] = [];

    for (const car of toProcess) {
      try {
        const driveFolder = slugToFolder.get(car.id);
        if (!driveFolder) {
          errors.push(`Drive folder not found for "${car.folderName}" (${car.id})`);
          continue;
        }

        console.log(`[resync-photos] Resyncing photos for ${car.folderName}...`);

        // Get files from Drive
        const files = await listFolderFiles(driveFolder.id);
        if (files.photos.length === 0) {
          errors.push(`No photos in Drive folder for "${car.folderName}"`);
          continue;
        }

        // Determine cover photo ordering
        const coverIdx = findCoverPhotoIndex(files.photos);
        let orderedPhotos: typeof files.photos;
        if (coverIdx >= 0) {
          const cover = files.photos[coverIdx];
          const rest = files.photos
            .filter((_, i) => i !== coverIdx)
            .sort((a, b) => a.name.localeCompare(b.name));
          orderedPhotos = [cover, ...rest];
          console.log(`[resync-photos]   Cover photo: "${cover.name}"`);
        } else {
          orderedPhotos = [...files.photos].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        }

        // Delete old photos from Blob
        console.log(`[resync-photos]   Deleting old photos...`);
        await deleteCarPhotos(car.id);

        // Upload new photos in correct order
        console.log(
          `[resync-photos]   Uploading ${orderedPhotos.length} photos...`,
        );
        const photoUrls: string[] = [];
        for (const photo of orderedPhotos) {
          const buffer = await downloadFile(photo.id);
          const url = await uploadCarPhoto(
            car.id,
            photo.name,
            buffer,
            photo.mimeType,
          );
          photoUrls.push(url);
        }

        // Update car
        car.photos =
          photoUrls.length > 0
            ? photoUrls
            : ["/images/cars/placeholder.jpg"];

        // Recalculate price if needed
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
          } catch (priceErr) {
            console.error(
              `[resync-photos]   Price recalc failed for "${car.id}":`,
              priceErr,
            );
          }
        }

        updatedCount++;
        console.log(
          `[resync-photos]   Done: ${car.folderName} (${photoUrls.length} photos)`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[resync-photos]   Error for "${car.folderName}": ${message}`,
        );
        errors.push(`${car.folderName}: ${message}`);
      }
    }

    // 4. Save updated catalog
    console.log(
      `[resync-photos] Saving catalog (${catalog.length} cars) to Blob...`,
    );
    await writeCatalogJson(catalog);

    // 5. Revalidate Next.js cache
    revalidatePath("/catalog", "page");
    revalidatePath("/", "page");
    for (const car of catalog) {
      revalidatePath(`/catalog/${car.id}`, "page");
    }
    console.log("[resync-photos] Cache revalidated");

    const skipped = catalog.length > MAX_PER_RUN ? catalog.length - MAX_PER_RUN : 0;
    console.log(
      `[resync-photos] Complete: ${updatedCount} updated, ${errors.length} errors, ${skipped} skipped`,
    );

    return NextResponse.json({ updated: updatedCount, errors, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resync-photos] Fatal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
