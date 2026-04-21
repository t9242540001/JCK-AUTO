import { promises as fs } from "fs";
import path from "path";
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
async function loadUsers(): Promise<void> {
  if (loaded) return;
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8");
    const arr = JSON.parse(data) as BotUser[];
    for (const u of arr) users.set(u.id, u);
  } catch {
    // file doesn't exist yet — ok
  }
  loaded = true;
}
/**
 * Public idempotent helper to hydrate the in-memory user store from disk.
 * Call once at the start of any sync code path that relies on `getUser`
 * returning real data. Second and later calls are no-op thanks to the
 * `loaded` flag inside `loadUsers`.
 *
 * @rule getUser() is synchronous and WILL return undefined until
 *       ensureUsersLoaded() has resolved at least once in the
 *       process lifetime.
 */
export async function ensureUsersLoaded(): Promise<void> {
  await loadUsers();
}
async function persistUsers(): Promise<void> {
  const arr = Array.from(users.values());
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(arr, null, 2), "utf-8");
}
export async function saveUser(from: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}): Promise<BotUser> {
  await loadUsers();
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
  await persistUsers();
  return user;
}
export async function savePhone(userId: number, phone: string): Promise<void> {
  await loadUsers();
  const user = users.get(userId);
  if (user) {
    user.phone = phone;
    await persistUsers();
  }
}
export function getUser(userId: number): BotUser | undefined {
  return users.get(userId);
}
export async function getAllUsers(): Promise<BotUser[]> {
  await loadUsers();
  return Array.from(users.values());
}
export async function getUsersStats(): Promise<{
  total: number;
  withPhone: number;
  today: number;
  thisWeek: number;
}> {
  await loadUsers();
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
