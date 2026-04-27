/**
 * @file        users.ts
 * @description In-memory user store, persisted to /var/www/jckauto/storage/users.json.
 *              Loaded synchronously at bot startup via loadUsers().
 * @rule        loadUsers() MUST be called from src/bot/index.ts BEFORE
 *              registering any handler. Public API is sync — there
 *              are no lazy-load fallbacks inside the store
 *              functions. If the bot starts up without calling
 *              loadUsers(), getUser() returns undefined for every
 *              user. This is intentional: a hard failure surfaces
 *              init-order regressions immediately, instead of
 *              hiding them behind an async race. See ADR
 *              [2026-04-26] users.ts sync-init two-phase refactor +
 *              ADR [2026-04-27] users.ts Phase 5b — honest sync
 *              API completed.
 * @lastModified 2026-04-27
 */

import * as fs from "fs";
import * as path from "path";

const USERS_FILE = "/var/www/jckauto/storage/users.json";

export interface BotUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
  registeredAt: string;
  lastSeenAt: string;
}

const users = new Map<number, BotUser>();
let loaded = false;

/**
 * Load users from disk into memory. Called once from src/bot/index.ts
 * at bot startup, BEFORE any handler is registered.
 *
 * Idempotent — second and later calls are no-ops thanks to the
 * `loaded` flag. Sync — uses fs.readFileSync. Same pattern as
 * fileIdCache.loadCache().
 *
 * @returns number of users loaded (0 if file did not exist yet)
 */
export function loadUsers(): number {
  if (loaded) return users.size;
  try {
    if (!fs.existsSync(USERS_FILE)) {
      // First run — directory may not exist yet either. Mirror
      // fileIdCache: create dir + empty file so subsequent writes
      // don't have to mkdir.
      const dir = path.dirname(USERS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(USERS_FILE, "[]", "utf-8");
      loaded = true;
      return 0;
    }
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    const arr = JSON.parse(raw) as BotUser[];
    users.clear();
    for (const u of arr) users.set(u.id, u);
    loaded = true;
    return users.size;
  } catch (err) {
    console.error(`[users] loadUsers error: ${err instanceof Error ? err.message : err}`);
    loaded = true; // mark loaded anyway — empty store is better than retry-loop
    return 0;
  }
}

/**
 * Persist current in-memory user map to disk. Sync — uses
 * fs.writeFileSync. Mirrors fileIdCache.saveCache() pattern.
 */
function persistUsers(): void {
  try {
    const arr = Array.from(users.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (err) {
    console.error(`[users] persistUsers error: ${err instanceof Error ? err.message : err}`);
  }
}

export function saveUser(from: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}): BotUser {
  const now = new Date().toISOString();
  const existing = users.get(from.id);
  const user: BotUser = {
    id: from.id,
    firstName: from.first_name,
    lastName: from.last_name,
    username: from.username,
    phone: existing?.phone,
    registeredAt: existing?.registeredAt ?? now,
    lastSeenAt: now,
  };
  users.set(from.id, user);
  persistUsers();
  return user;
}

export function savePhone(userId: number, phone: string): void {
  const user = users.get(userId);
  if (user) {
    user.phone = phone;
    persistUsers();
  }
}

export function getUser(userId: number): BotUser | undefined {
  return users.get(userId);
}

export function getAllUsers(): BotUser[] {
  return Array.from(users.values());
}

export function getUsersStats(): {
  total: number;
  withPhone: number;
  today: number;
  thisWeek: number;
} {
  const all = Array.from(users.values());
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  return {
    total: all.length,
    withPhone: all.filter((u) => u.phone).length,
    today: all.filter((u) => new Date(u.registeredAt) >= todayStart).length,
    thisWeek: all.filter((u) => new Date(u.registeredAt) >= weekStart).length,
  };
}
