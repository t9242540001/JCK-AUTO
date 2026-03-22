import { promises as fs } from "fs";
import path from "path";
import type { Car } from "@/types/car";

const STORAGE_DIR = "/var/www/jckauto/storage";
const CATALOG_DIR = path.join(STORAGE_DIR, "catalog");
const CATALOG_JSON_PATH = path.join(CATALOG_DIR, "catalog.json");

/**
 * Upload a car photo to local storage.
 * Returns the public URL path.
 */
export async function uploadCarPhoto(
  carSlug: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const dir = path.join(CATALOG_DIR, carSlug);
  await fs.mkdir(dir, { recursive: true });
  // Normalize .jpeg → .jpg for consistency
  const normalizedName = fileName.replace(/\.jpeg$/i, ".jpg");
  const filePath = path.join(dir, normalizedName);
  await fs.writeFile(filePath, buffer);
  return `/storage/catalog/${carSlug}/${normalizedName}`;
}

/**
 * Delete all photos for a specific car.
 */
export async function deleteCarPhotos(carSlug: string): Promise<void> {
  const dir = path.join(CATALOG_DIR, carSlug);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
}

/**
 * Get all photo URLs for a specific car.
 */
export async function getCarPhotoUrls(carSlug: string): Promise<string[]> {
  const dir = path.join(CATALOG_DIR, carSlug);
  try {
    const files = await fs.readdir(dir);
    return files
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map((f) => `/storage/catalog/${carSlug}/${f}`);
  } catch {
    return [];
  }
}

/**
 * Read the catalog.json from local storage.
 * Returns empty array if file doesn't exist.
 */
export async function readCatalogJson(): Promise<Car[]> {
  try {
    const data = await fs.readFile(CATALOG_JSON_PATH, "utf-8");
    return JSON.parse(data) as Car[];
  } catch {
    return [];
  }
}

/**
 * Write the catalog.json to local storage.
 */
export async function writeCatalogJson(cars: Car[]): Promise<void> {
  await fs.mkdir(CATALOG_DIR, { recursive: true });
  const json = JSON.stringify(cars, null, 2);
  await fs.writeFile(CATALOG_JSON_PATH, json, "utf-8");
}
