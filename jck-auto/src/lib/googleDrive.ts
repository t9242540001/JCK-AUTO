import { google } from "googleapis";
import {
  getGoogleServiceAccountKey,
  getGoogleDriveFolderId,
} from "./config";

function getAuthClient() {
  const credentials = getGoogleServiceAccountKey();
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

function getDrive() {
  const auth = getAuthClient();
  return google.drive({ version: "v3", auth });
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface DriveCarFiles {
  screenshots: DriveFile[];
  photos: DriveFile[];
}

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

function isScreenshot(name: string): boolean {
  const lower = name.toLowerCase();
  const baseName = lower.replace(/\.[^.]+$/, "");

  // Convention: file "2.*" = marketplace listing screenshot (price, specs)
  if (baseName === "2") return true;

  return (
    lower.includes("скрин") ||
    lower.includes("screen") ||
    lower.includes("характеристик") ||
    lower.includes("spec") ||
    lower.includes("info")
  );
}

/**
 * List car subfolders inside the root Google Drive folder.
 */
export async function listCarFolders(): Promise<DriveFolder[]> {
  const drive = getDrive();
  const folderId = getGoogleDriveFolderId();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    orderBy: "name",
    pageSize: 1000,
  });

  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
  }));
}

/**
 * List files inside a car folder, split into screenshots and photos.
 */
export async function listFolderFiles(
  folderId: string
): Promise<DriveCarFiles> {
  const drive = getDrive();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    pageSize: 1000,
  });

  const allFiles = (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
  }));

  const images = allFiles.filter((f) =>
    IMAGE_MIME_TYPES.includes(f.mimeType.toLowerCase())
  );

  let screenshots = images.filter((f) => isScreenshot(f.name));
  let photos = images.filter((f) => !isScreenshot(f.name));

  // Fallback: if no screenshot detected, treat the first image as screenshot
  if (screenshots.length === 0 && images.length > 0) {
    screenshots = [images[0]];
    photos = images.slice(1);
    console.log(`[drive] Screenshot fallback (first image): ${images[0].name}`);
  } else {
    for (const s of screenshots) {
      console.log(`[drive] Screenshot detected: ${s.name}`);
    }
  }

  return { screenshots, photos };
}

/**
 * Download a file from Google Drive as a Buffer.
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDrive();

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  const data = res.data;

  // googleapis (gaxios) may return different types depending on Node.js version
  // and response headers. Handle all cases to guarantee a proper Buffer.
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (typeof data === "string") {
    // gaxios sometimes returns a string even with responseType: "arraybuffer".
    // Use "latin1" encoding to preserve raw byte values (each char maps 1:1 to a byte).
    return Buffer.from(data, "latin1");
  }
  // Fallback for ArrayBuffer-like objects (e.g. Uint8Array)
  return Buffer.from(data as ArrayBuffer);
}
