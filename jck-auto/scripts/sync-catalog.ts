/**
 * CLI wrapper for catalog sync.
 *
 * Usage:
 *   npx tsx -r tsconfig-paths/register scripts/sync-catalog.ts
 *
 * Or via package.json script:
 *   npm run sync-catalog
 *
 * Required env variables:
 *   GOOGLE_SERVICE_ACCOUNT_KEY  — JSON string of service account credentials
 *   GOOGLE_DRIVE_FOLDER_ID     — root folder with car subfolders
 *   ANTHROPIC_API_KEY           — for Claude Vision & description generation
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import { syncCatalog } from "@/lib/catalogSync";

// Load .env.local if it exists and env vars are not already set (VDS local run).
// GitHub Actions passes env vars directly, so dotenv is a no-op there.
const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  dotenvConfig({ path: envLocalPath, override: false });
  console.log(`[sync-catalog] Loaded env from ${envLocalPath}`);
}

const REQUIRED_ENV = [
  "GOOGLE_SERVICE_ACCOUNT_KEY",
  "GOOGLE_DRIVE_FOLDER_ID",
  "ANTHROPIC_API_KEY",
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[sync-catalog] Missing env variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log("[sync-catalog] Starting catalog sync...\n");

  validateEnv();

  const result = await syncCatalog();

  console.log("\n[sync-catalog] === Sync result ===");
  console.log(`  Added:   ${result.added.length} (${result.added.join(", ") || "none"})`);
  console.log(`  Removed: ${result.removed.length} (${result.removed.join(", ") || "none"})`);
  console.log(`  Updated: ${result.updated.length}`);
  console.log(`  Errors:  ${result.errors.length}`);

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.error(`    - ${err.folder}: ${err.error}`);
    }
  }

  // Rebuild the site so new cars appear on the frontend
  console.log("\n[sync-catalog] Running npm run build...\n");
  try {
    execSync("npm run build", { stdio: "inherit", cwd: process.cwd() });
    console.log("\n[sync-catalog] Build complete.");
  } catch {
    console.error("\n[sync-catalog] Build failed!");
    process.exit(1);
  }

  if (result.errors.length > 0) {
    console.warn("\n[sync-catalog] Finished with errors.");
    process.exit(1);
  }

  console.log("\n[sync-catalog] Done.");
}

main().catch((err) => {
  console.error("[sync-catalog] Fatal error:", err);
  process.exit(1);
});
