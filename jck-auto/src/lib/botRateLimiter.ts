/**
 * @file        botRateLimiter.ts
 * @description Rate limiting for Telegram bot. Three tiers: daily cap (20/day),
 *              AI cooldown (2 min), calculator cooldown (10 sec). Key = telegram_id.
 * @dependencies none (in-memory only)
 * @rule        checkBotLimit MUST be called BEFORE any external API call in handlers.
 *              recordBotUsage MUST be called AFTER successful execution, not before.
 *              Message text must NEVER disclose exact numeric limit values.
 * @lastModified 2026-04-10
 */

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type CommandType = 'ai' | 'calc' | 'other';

export interface BotLimitResult {
  allowed: boolean;
  reason?: 'daily_cap' | 'cooldown';
  waitSeconds?: number;
}

interface BotUsageRecord {
  dailyCount: number;
  dailyWindowStart: number;
  lastAiRequest: number | null;
  lastCalcRequest: number | null;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DAILY_CAP = 20;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const AI_COOLDOWN_MS = 120_000;
const CALC_COOLDOWN_MS = 10_000;

// ─── STATE ────────────────────────────────────────────────────────────────────

const records = new Map<string, BotUsageRecord>();

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function cleanupExpiredRecords(now: number): void {
  for (const [id, rec] of records.entries()) {
    const windowExpired = now - rec.dailyWindowStart > DAILY_WINDOW_MS;
    const aiExpired = rec.lastAiRequest === null || now - rec.lastAiRequest > AI_COOLDOWN_MS;
    const calcExpired = rec.lastCalcRequest === null || now - rec.lastCalcRequest > CALC_COOLDOWN_MS;
    if (windowExpired && aiExpired && calcExpired) {
      records.delete(id);
    }
  }
}

// ─── MAIN FUNCTIONS ───────────────────────────────────────────────────────────

/**
 * Read-only limit check. Call BEFORE executing any bot command.
 * Does NOT record usage — call recordBotUsage after successful execution.
 */
export function checkBotLimit(telegramId: string, commandType: CommandType): BotLimitResult {
  const now = Date.now();
  cleanupExpiredRecords(now);

  const rec = records.get(telegramId);

  if (rec) {
    const windowActive = now - rec.dailyWindowStart <= DAILY_WINDOW_MS;

    // Check daily cap first
    if (windowActive && rec.dailyCount >= DAILY_CAP) {
      return { allowed: false, reason: 'daily_cap' };
    }

    // Check cooldown by command type
    if (commandType === 'ai' && rec.lastAiRequest !== null) {
      const elapsed = now - rec.lastAiRequest;
      if (elapsed < AI_COOLDOWN_MS) {
        return {
          allowed: false,
          reason: 'cooldown',
          waitSeconds: Math.ceil((AI_COOLDOWN_MS - elapsed) / 1000),
        };
      }
    }

    if (commandType === 'calc' && rec.lastCalcRequest !== null) {
      const elapsed = now - rec.lastCalcRequest;
      if (elapsed < CALC_COOLDOWN_MS) {
        return {
          allowed: false,
          reason: 'cooldown',
          waitSeconds: Math.ceil((CALC_COOLDOWN_MS - elapsed) / 1000),
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Record usage AFTER successful command execution.
 * Resets daily window if 24h has elapsed since dailyWindowStart.
 */
export function recordBotUsage(telegramId: string, commandType: CommandType): void {
  const now = Date.now();
  const rec = records.get(telegramId);

  if (rec) {
    if (now - rec.dailyWindowStart > DAILY_WINDOW_MS) {
      // Window expired — reset
      rec.dailyCount = 1;
      rec.dailyWindowStart = now;
    } else {
      rec.dailyCount += 1;
    }
    if (commandType === 'ai') rec.lastAiRequest = now;
    if (commandType === 'calc') rec.lastCalcRequest = now;
  } else {
    records.set(telegramId, {
      dailyCount: 1,
      dailyWindowStart: now,
      lastAiRequest: commandType === 'ai' ? now : null,
      lastCalcRequest: commandType === 'calc' ? now : null,
    });
  }
}

/**
 * Returns a Russian-language message for a denied request.
 * Never discloses exact numeric limit values.
 */
export function getBotLimitMessage(result: BotLimitResult): string {
  if (result.reason === 'daily_cap') {
    return 'Лимит запросов на сегодня исчерпан. Попробуйте завтра.';
  }
  if (result.reason === 'cooldown') {
    if (result.waitSeconds !== undefined && result.waitSeconds > 60) {
      return `Подождите ещё ${Math.ceil(result.waitSeconds / 60)} мин. перед следующим запросом.`;
    }
    return 'Подождите немного перед следующим запросом.';
  }
  return 'Запрос временно недоступен. Попробуйте позже.';
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

export { BotUsageRecord };
