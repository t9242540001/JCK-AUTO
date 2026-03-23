/**
 * @file fileIdCache.ts
 * @description Кэш Telegram file_id для мгновенной отправки фото без повторного скачивания
 * @runs VDS (bot process)
 * @input car.photos[] paths from catalog.json
 * @output file_id strings from Telegram API
 * @reads /var/www/jckauto/storage/catalog/file-id-cache.json
 * @writes /var/www/jckauto/storage/catalog/file-id-cache.json
 */

import * as fs from "fs";
import * as path from "path";

/* ── CONSTANTS ─────────────────────────────────────────────────────────── */

const CACHE_PATH = "/var/www/jckauto/storage/catalog/file-id-cache.json";

/* ── STATE ─────────────────────────────────────────────────────────────── */

const cache = new Map<string, string>();

/* ── EXPORTS ───────────────────────────────────────────────────────────── */

/**
 * Get cached file_id for a photo path
 * @input photoPath — e.g. "/storage/catalog/slug/1.jpg"
 * @output file_id string or null if not cached
 */
export function getFileId(photoPath: string): string | null {
  return cache.get(photoPath) ?? null;
}

/**
 * Store file_id for a photo path and persist to disk
 * @input photoPath — e.g. "/storage/catalog/slug/1.jpg"
 * @input fileId — Telegram file_id string
 */
export function setFileId(photoPath: string, fileId: string): void {
  cache.set(photoPath, fileId);
  saveCache();
}

/**
 * Remove a file_id from cache (e.g. when it becomes invalid)
 * @input photoPath — e.g. "/storage/catalog/slug/1.jpg"
 */
export function deleteFileId(photoPath: string): void {
  cache.delete(photoPath);
  saveCache();
}

/**
 * Load cache from disk into memory. Call once at bot startup.
 * @output number of entries loaded
 */
export function loadCache(): number {
  try {
    if (!fs.existsSync(CACHE_PATH)) {
      // Ensure directory exists
      const dir = path.dirname(CACHE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CACHE_PATH, "{}", "utf-8");
      return 0;
    }
    const raw = fs.readFileSync(CACHE_PATH, "utf-8");
    const data = JSON.parse(raw) as Record<string, string>;
    cache.clear();
    for (const [key, value] of Object.entries(data)) {
      cache.set(key, value);
    }
    return cache.size;
  } catch (err: any) {
    console.error(`[fileIdCache] loadCache error: ${err?.message || err}`);
    return 0;
  }
}

/**
 * Persist current cache to disk
 */
export function saveCache(): void {
  try {
    const obj: Record<string, string> = {};
    for (const [key, value] of cache.entries()) {
      obj[key] = value;
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err: any) {
    console.error(`[fileIdCache] saveCache error: ${err?.message || err}`);
  }
}

/**
 * Get total number of cached entries
 */
export function cacheSize(): number {
  return cache.size;
}
