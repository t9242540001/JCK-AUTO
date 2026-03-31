/**
 * @file deepseek.ts
 * @description Универсальный клиент DeepSeek API для текстовой генерации
 * @runs VDS напрямую
 * @env DEEPSEEK_API_KEY
 * @cost input $0.28/M, output $0.42/M
 * @rule retry только на сетевые/5xx/429; не логировать промпты и ключ; проверять ключ при вызове, не при импорте
 * @lastModified 2026-03-31
 */

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface DeepSeekOptions {
  /** Модель DeepSeek (default: 'deepseek-chat') */
  model?: string;
  /** Температура генерации (default: 0.3) */
  temperature?: number;
  /** Максимум токенов в ответе (default: 2048) */
  maxTokens?: number;
  /** Системный промпт */
  systemPrompt?: string;
}

export interface DeepSeekResponse {
  /** Сгенерированный текст */
  content: string;
  /** Статистика использования токенов */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.3;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const RATE_LIMIT_PER_MINUTE = 10;
const INPUT_PRICE_PER_M = 0.28;
const OUTPUT_PRICE_PER_M = 0.42;

// ─── COST CALCULATION ─────────────────────────────────────────────────────

/**
 * Рассчитывает стоимость запроса к DeepSeek API
 * @input promptTokens — кол-во входных токенов, completionTokens — кол-во выходных токенов
 * @output стоимость в USD с точностью до 6 знаков
 */
export function calculateCost(promptTokens: number, completionTokens: number): number {
  const cost =
    (promptTokens / 1_000_000) * INPUT_PRICE_PER_M +
    (completionTokens / 1_000_000) * OUTPUT_PRICE_PER_M;
  return parseFloat(cost.toFixed(6));
}

// ─── RATE LIMITER ─────────────────────────────────────────────────────────

const requestTimestamps: number[] = [];

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  // Удалить timestamps старше 60 секунд
  while (requestTimestamps.length > 0 && requestTimestamps[0] <= now - 60_000) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= RATE_LIMIT_PER_MINUTE) {
    const oldestTimestamp = requestTimestamps[0];
    const waitMs = oldestTimestamp + 60_000 - now;
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    return waitForRateLimit();
  }
}

function recordRequest(): void {
  requestTimestamps.push(Date.now());
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

// будет добавлена на этапе 1.2

// ─── EXPORTS ──────────────────────────────────────────────────────────────

export {
  DEEPSEEK_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  REQUEST_TIMEOUT_MS,
  MAX_RETRIES,
  RATE_LIMIT_PER_MINUTE,
  INPUT_PRICE_PER_M,
  OUTPUT_PRICE_PER_M,
};
