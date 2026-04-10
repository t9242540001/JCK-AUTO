/**
 * @file rateLimiter.ts
 * @description Rate limiting для AI-инструментов сайта (аукционные листы, Encar).
 *              Two modes: anonymous (permanent ip-key quota) and authenticated (daily tg-key quota).
 * @rule ANONYMOUS: 3 запроса ВСЕГО (lifetime, не сбрасывается). ip-key записи НИКОГДА не удаляются.
 *       Удаление ip-key = пользователь получает 3 бесплатных попытки снова = обход auth-gate.
 * @rule AUTHENTICATED: 10 запросов/день с telegramId (сбрасывается каждые 24h).
 * @rule Лимит общий для ВСЕХ AI-инструментов (аукционные листы + Encar суммарно)
 * @rule cleanup() итерирует ТОЛЬКО tgMap — никогда ipMap
 * @lastModified 2026-04-10
 */

// ─── TYPES ────────────────────────────────────────────────────────────────

interface IpRecord {
  count: number;
  lastRequest: number;
}

interface TgRecord {
  count: number;
  windowStart: number;
  lastRequest: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  usedCount: number;
  resetIn?: number;          // секунд до сброса (только если allowed: false)
  isLifetimeLimit?: boolean; // true — анонимный лимит исчерпан, нужна авторизация
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

export const MAX_ANONYMOUS_REQUESTS = 3;
const MAX_AUTHENTICATED_REQUESTS = 10;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 часа
const AI_COOLDOWN_MS = 2 * 60 * 1000;  // 2 минуты между AI-запросами

// ─── STATE ────────────────────────────────────────────────────────────────

const ipMap = new Map<string, IpRecord>(); // anonymous — NEVER deleted (permanent lifetime counter)
const tgMap = new Map<string, TgRecord>(); // authenticated — cleaned after window expiry

// ─── HELPERS ──────────────────────────────────────────────────────────────

function cleanup(): void {
  const now = Date.now();
  for (const [key, record] of tgMap) {
    if (now - record.windowStart > WINDOW_MS) {
      tgMap.delete(key);
    }
  }
  // ipMap is NEVER cleaned — records are permanent lifetime counters
}

// ─── MAIN FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Проверить можно ли выполнить запрос.
 * @param ip — IP-адрес клиента (всегда передаётся)
 * @param telegramId — telegram_id из JWT cookie (если пользователь авторизован)
 * @returns { allowed, remaining, usedCount } или { allowed: false, resetIn, isLifetimeLimit }
 */
export function checkRateLimit(ip: string, telegramId?: string): RateLimitResult {
  cleanup();
  const now = Date.now();

  if (telegramId) {
    // AUTHENTICATED mode: daily quota, resets every 24h
    const key = `tg:${telegramId}`;
    const record = tgMap.get(key);

    if (!record || now - record.windowStart > WINDOW_MS) {
      return { allowed: true, remaining: MAX_AUTHENTICATED_REQUESTS, usedCount: 0 };
    }

    if (record.count >= MAX_AUTHENTICATED_REQUESTS) {
      const resetIn = Math.ceil((record.windowStart + WINDOW_MS - now) / 1000);
      return { allowed: false, remaining: 0, usedCount: record.count, resetIn };
    }

    // AI cooldown check
    if (record.lastRequest > 0 && now - record.lastRequest < AI_COOLDOWN_MS) {
      const resetIn = Math.ceil((record.lastRequest + AI_COOLDOWN_MS - now) / 1000);
      return {
        allowed: false,
        remaining: MAX_AUTHENTICATED_REQUESTS - record.count,
        usedCount: record.count,
        resetIn,
      };
    }

    return {
      allowed: true,
      remaining: MAX_AUTHENTICATED_REQUESTS - record.count,
      usedCount: record.count,
    };
  }

  // ANONYMOUS mode: lifetime quota, NEVER resets
  const key = `ip:${ip}`;
  const record = ipMap.get(key);

  if (!record) {
    return { allowed: true, remaining: MAX_ANONYMOUS_REQUESTS, usedCount: 0 };
  }

  if (record.count >= MAX_ANONYMOUS_REQUESTS) {
    return { allowed: false, remaining: 0, usedCount: record.count, isLifetimeLimit: true };
  }

  // AI cooldown check
  if (record.lastRequest > 0 && now - record.lastRequest < AI_COOLDOWN_MS) {
    const resetIn = Math.ceil((record.lastRequest + AI_COOLDOWN_MS - now) / 1000);
    return {
      allowed: false,
      remaining: MAX_ANONYMOUS_REQUESTS - record.count,
      usedCount: record.count,
      resetIn,
    };
  }

  return {
    allowed: true,
    remaining: MAX_ANONYMOUS_REQUESTS - record.count,
    usedCount: record.count,
  };
}

/**
 * Зарегистрировать использование (вызывать ПОСЛЕ успешного выполнения запроса).
 * @param ip — IP-адрес клиента
 * @param telegramId — telegram_id из JWT cookie (если авторизован)
 */
export function recordUsage(ip: string, telegramId?: string): void {
  const now = Date.now();

  if (telegramId) {
    const key = `tg:${telegramId}`;
    const record = tgMap.get(key);

    if (!record || now - record.windowStart > WINDOW_MS) {
      tgMap.set(key, { count: 1, windowStart: now, lastRequest: now });
    } else {
      record.count++;
      record.lastRequest = now;
    }
    return;
  }

  // Anonymous — permanent, never reset
  const key = `ip:${ip}`;
  const record = ipMap.get(key);

  if (!record) {
    ipMap.set(key, { count: 1, lastRequest: now });
  } else {
    record.count++;
    record.lastRequest = now;
  }
}
