import { put, del, list } from "@vercel/blob";

/**
 * Upload a car photo to Vercel Blob Storage.
 * Returns the public URL of the uploaded blob.
 */
export async function uploadCarPhoto(
  carSlug: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const pathname = `catalog/${carSlug}/${fileName}`;

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
  });

  return blob.url;
}

/**
 * Delete all photos for a specific car from Blob Storage.
 */
export async function deleteCarPhotos(carSlug: string): Promise<void> {
  const prefix = `catalog/${carSlug}/`;
  let cursor: string | undefined;

  do {
    const result = await list({ prefix, cursor });

    if (result.blobs.length > 0) {
      await Promise.all(result.blobs.map((blob) => del(blob.url)));
    }

    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
}

/**
 * Get all photo URLs for a specific car from Blob Storage.
 */
export async function getCarPhotoUrls(carSlug: string): Promise<string[]> {
  const prefix = `catalog/${carSlug}/`;
  const urls: string[] = [];
  let cursor: string | undefined;

  do {
    const result = await list({ prefix, cursor });
    urls.push(...result.blobs.map((blob) => blob.url));
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return urls;
}
