/**
 * @file deepseek.ts
 * @description Универсальный клиент DeepSeek API для текстовой генерации
 * @runs VDS напрямую
 * @env DEEPSEEK_API_KEY
 * @cost input $0.28/M, output $0.42/M
 * @rule retry only on network/5xx/429; max 2 attempts; 180s timeout per attempt; never log prompts or API key; check key at call-time, not at import
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
const REQUEST_TIMEOUT_MS = 180_000;
const MAX_RETRIES = 2;
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

/**
 * Универсальный вызов DeepSeek API для текстовой генерации
 * @input userPrompt — текст запроса, options — параметры модели и системный промпт
 * @output DeepSeekResponse с текстом, usage и стоимостью
 * @important retry только на сетевые/5xx/429; не логирует промпты и ключ
 */
async function callDeepSeek(
  userPrompt: string,
  options?: DeepSeekOptions,
): Promise<DeepSeekResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not set in environment variables');
  }

  const model = options?.model ?? DEFAULT_MODEL;
  const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

  const messages: Array<{ role: string; content: string }> = [];
  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  await waitForRateLimit();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt)),
      );
    }

    const attemptStart = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error(
          `[DeepSeek] HTTP ${response.status} on attempt ${attempt + 1}/${MAX_RETRIES}: ${responseText.slice(0, 200)}`,
        );
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`DeepSeek API error ${response.status}`);
          continue;
        }
        throw new Error(`DeepSeek API error ${response.status}`);
      }

      let rawText: string;
      try {
        rawText = await response.text();
      } catch (bodyErr) {
        const underlyingMsg = bodyErr instanceof Error ? bodyErr.message : String(bodyErr);
        console.error(
          `[DeepSeek] failed to read response body on attempt ${attempt + 1}/${MAX_RETRIES}: ${underlyingMsg}`,
        );
        lastError = new Error('Failed to read DeepSeek response body');
        continue;
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        const preview = rawText.slice(0, 500);
        console.error(
          `[DeepSeek] JSON parse failed on attempt ${attempt + 1}/${MAX_RETRIES}. ` +
          `Raw response (first 500 chars): ${preview}`
        );
        lastError = new Error('Failed to parse DeepSeek API response as JSON');
        continue;
      }

      const choices = data.choices as Array<{
        message?: { content?: string };
        finish_reason?: string;
      }> | undefined;
      const content = choices?.[0]?.message?.content;
      if (content == null) {
        throw new Error(
          `DeepSeek returned empty response (finish_reason: ${choices?.[0]?.finish_reason})`,
        );
      }

      recordRequest();

      const usage = data.usage as {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      const promptTokens = usage?.prompt_tokens ?? 0;
      const completionTokens = usage?.completion_tokens ?? 0;
      const totalTokens = usage?.total_tokens ?? 0;
      const cost = calculateCost(promptTokens, completionTokens);

      console.log(
        `[DeepSeek] model=${model} tokens=${totalTokens} (in:${promptTokens}/out:${completionTokens}) cost=$${cost}`,
      );

      return {
        content,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: cost,
        },
      };
    } catch (err) {
      // Preserve: DeepSeek-logical errors (empty response, HTTP 4xx non-retryable)
      // propagate without retry. MUST remain the first check so we don't waste
      // 2 × 180s on hopeless cases.
      if (err instanceof Error && err.message.startsWith('DeepSeek')) {
        throw err;
      }

      const elapsedSec = ((Date.now() - attemptStart) / 1000).toFixed(1);
      const isAbort =
        (err instanceof Error && err.name === 'AbortError') ||
        (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError');

      if (isAbort) {
        console.error(
          `[DeepSeek] request aborted after ${elapsedSec}s (timeout=${REQUEST_TIMEOUT_MS / 1000}s, attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        lastError = new Error(`DeepSeek request timeout after ${elapsedSec}s`);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[DeepSeek] network error on attempt ${attempt + 1}/${MAX_RETRIES} after ${elapsedSec}s: ${msg}`,
        );
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  console.error(
    `[DeepSeek] all ${MAX_RETRIES} retries exhausted. Last error: ${lastError?.message ?? 'unknown'}`,
  );
  throw new Error(
    `DeepSeek API failed after ${MAX_RETRIES} retries: ${lastError?.message}`,
  );
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────

export {
  callDeepSeek,
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
