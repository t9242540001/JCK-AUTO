/**
 * @file rateLimiter.ts
 * @description Rate limiting для AI-инструментов сайта (аукционные листы, Encar).
 *              In-memory хранение, 3 запроса/день с одного IP.
 * @rule Лимит общий для ВСЕХ AI-инструментов (аукционные листы + Encar суммарно)
 * @rule Очистка записей старше 24 часов при каждой проверке
 * @lastModified 2026-04-02
 */

// ─── TYPES ────────────────────────────────────────────────────────────────

interface UsageRecord {
  count: number;
  firstRequest: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn?: number; // секунд до сброса (только если allowed: false)
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const MAX_REQUESTS = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 часа

// ─── STATE ────────────────────────────────────────────────────────────────

const usageMap = new Map<string, UsageRecord>();

// ─── HELPERS ──────────────────────────────────────────────────────────────

function cleanup(): void {
  const now = Date.now();
  for (const [ip, record] of usageMap) {
    if (now - record.firstRequest > WINDOW_MS) {
      usageMap.delete(ip);
    }
  }
}

// ─── MAIN FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Проверить можно ли выполнить запрос.
 * @input ip — IP-адрес клиента
 * @output { allowed, remaining } или { allowed: false, resetIn }
 */
export function checkRateLimit(ip: string): RateLimitResult {
  cleanup();

  const record = usageMap.get(ip);
  if (!record) {
    return { allowed: true, remaining: MAX_REQUESTS };
  }

  const now = Date.now();
  if (now - record.firstRequest > WINDOW_MS) {
    usageMap.delete(ip);
    return { allowed: true, remaining: MAX_REQUESTS };
  }

  if (record.count >= MAX_REQUESTS) {
    const resetIn = Math.ceil((record.firstRequest + WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining: MAX_REQUESTS - record.count };
}

/**
 * Зарегистрировать использование (вызывать ПОСЛЕ успешного выполнения запроса).
 * @input ip — IP-адрес клиента
 */
export function recordUsage(ip: string): void {
  const now = Date.now();
  const record = usageMap.get(ip);

  if (!record || now - record.firstRequest > WINDOW_MS) {
    usageMap.set(ip, { count: 1, firstRequest: now });
  } else {
    record.count++;
  }
}
