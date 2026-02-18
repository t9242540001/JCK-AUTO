/* eslint-disable @typescript-eslint/no-explicit-any */
// Global error handlers — must be FIRST, before any imports that might crash
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection:", reason);
  process.exit(1);
});

// Force unbuffered output for SSH piping
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
console.log = (...args: any[]) => {
  originalLog(...args);
  process.stdout.write("");
};
console.error = (...args: any[]) => {
  originalError(...args);
  process.stderr.write("");
};
console.warn = (...args: any[]) => {
  originalWarn(...args);
  process.stderr.write("");
};

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

const SYNC_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[sync-catalog] Missing env variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  // Log which env vars are present (without values for security)
  for (const key of REQUIRED_ENV) {
    const val = process.env[key] || "";
    console.log(`[sync-catalog] ${key}: ${val ? `set (${val.length} chars)` : "NOT SET"}`);

    // Warn about suspiciously short API key
    if (key === "ANTHROPIC_API_KEY" && val.length > 0 && val.length < 50) {
      console.warn(`[sync-catalog] WARNING: ANTHROPIC_API_KEY is suspiciously short (${val.length} chars). Expected ~108 chars. AI features will use fallback mode.`);
    }
  }
}

async function main(): Promise<void> {
  console.log("[sync-catalog] Starting catalog sync...");
  console.log(`[sync-catalog] CWD: ${process.cwd()}`);
  console.log(`[sync-catalog] Node: ${process.version}`);
  console.log(`[sync-catalog] Time: ${new Date().toISOString()}`);

  validateEnv();

  let syncSucceeded = false;
  let hasChanges = false;
  let result: any;

  console.log("\n[sync-catalog] About to call syncCatalog()...");

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`syncCatalog timed out after ${SYNC_TIMEOUT_MS / 1000}s`)), SYNC_TIMEOUT_MS)
    );
    result = await Promise.race([syncCatalog(), timeout]);

    console.log("[sync-catalog] syncCatalog() returned");
    syncSucceeded = true;
    hasChanges = result.added.length > 0 || result.removed.length > 0;

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
  } catch (err) {
    console.error("\n[sync-catalog] Sync failed with error:");
    console.error(err instanceof Error ? err.stack : err);
    // Still try to build if catalog.json might have been partially updated
    hasChanges = true;
  }

  // Rebuild the site if there were any changes (even partial)
  if (process.env.SKIP_BUILD === "true") {
    console.log("\n[sync-catalog] SKIP_BUILD=true, skipping build.");
  } else if (hasChanges || !syncSucceeded) {
    console.log("\n[sync-catalog] Running npm run build...\n");
    try {
      execSync("npm run build", { stdio: "inherit", cwd: process.cwd() });
      console.log("\n[sync-catalog] Build complete.");
    } catch {
      console.error("\n[sync-catalog] Build failed!");
      process.exit(1);
    }
  } else {
    console.log("\n[sync-catalog] No changes detected, skipping build.");
  }

  if (result && result.errors.length > 0) {
    console.warn("\n[sync-catalog] Finished with errors.");
    process.exit(1);
  }

  if (!syncSucceeded) {
    process.exit(1);
  }

  console.log("\n[sync-catalog] Done.");
}

main().catch((err) => {
  console.error("[sync-catalog] Fatal error:");
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
