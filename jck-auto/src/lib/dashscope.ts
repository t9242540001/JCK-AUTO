/**
 * @file dashscope.ts
 * @description Клиент DashScope API: генерация картинок (Qwen-Image) + Vision/OCR (Qwen-VL)
 * @runs VDS напрямую (без прокси)
 * @env DASHSCOPE_API_KEY в .env.local
 * @cost Qwen-Image-2.0-Pro ~$0.04/картинка | Qwen3-VL-Flash ~$0.001/запрос
 * @rule Два разных API: Qwen-Image = нативный DashScope, Qwen-VL = OpenAI-совместимый
 * @rule URL картинок от Qwen-Image валидны 24 часа — скачивать сразу
 * @rule Не логировать промпты и API-ключ — только модель, результат, стоимость
 * @rule DASHSCOPE_API_KEY проверять при вызове, не при импорте
 * @lastModified 2026-03-31
 */

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface ImageGenerateOptions {
  /** Модель генерации (default: 'qwen-image-2.0-pro') */
  model?: 'qwen-image-2.0-pro';
  /** Размер картинки, формат "1024*1024" (default: "1024*1024") */
  size?: string;
  /** Модель улучшает промпт (default: true) */
  promptExtend?: boolean;
  /** Водяной знак (default: false) */
  watermark?: boolean;
  /** Количество картинок, 1-6 (default: 1) */
  n?: number;
}

export interface ImageGenerateResponse {
  /** Временный URL картинки (валиден 24 часа) */
  imageUrl: string;
  /** Статистика */
  usage: { imageCount: number };
}

export interface VisionOptions {
  /** Модель Vision (default: 'qwen3-vl-flash') */
  model?: 'qwen3-vl-flash';
  /** Максимум токенов в ответе (default: 2048) */
  maxTokens?: number;
  /** Температура генерации (default: 0.3) */
  temperature?: number;
}

export interface VisionResponse {
  /** Текстовый ответ модели */
  content: string;
  /** Статистика использования токенов */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

/** Нативный API для Qwen-Image */
const DASHSCOPE_IMAGE_URL =
  'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
/** OpenAI-совместимый API для Qwen-VL */
const DASHSCOPE_CHAT_URL =
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEFAULT_IMAGE_MODEL = 'qwen-image-2.0-pro';
const DEFAULT_VISION_MODEL = 'qwen3-vl-flash';
const DEFAULT_IMAGE_SIZE = '1024*1024';
const DEFAULT_VISION_MAX_TOKENS = 2048;
const DEFAULT_VISION_TEMPERATURE = 0.3;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;
const RATE_LIMIT_PER_MINUTE = 6;

// ─── RATE LIMITER ─────────────────────────────────────────────────────────

const requestTimestamps: number[] = [];

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
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

// ─── RETRY HELPER ─────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) {
    throw new Error('DASHSCOPE_API_KEY is not set in environment variables');
  }
  return key;
}

async function fetchWithRetry(
  url: string,
  fetchOptions: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, 2000 * Math.pow(2, attempt)),
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseText = await response.text();
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`DashScope API error ${response.status}: ${responseText}`);
          continue;
        }
        throw new Error(`DashScope API error ${response.status}: ${responseText}`);
      }

      return response;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('DashScope API error')) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(
    `DashScope API failed after ${retries} retries: ${lastError?.message}`,
  );
}

// ─── IMAGE GENERATION ─────────────────────────────────────────────────────

/**
 * Генерация картинки через Qwen-Image (нативный DashScope API)
 * @input prompt — текстовое описание картинки, options — параметры генерации
 * @output ImageGenerateResponse с временным URL (валиден 24 часа) и usage
 * @important URL картинки протухает через 24 часа — скачивать сразу
 */
async function generateImage(
  prompt: string,
  options?: ImageGenerateOptions,
): Promise<ImageGenerateResponse> {
  const apiKey = getApiKey();
  const model = options?.model ?? DEFAULT_IMAGE_MODEL;
  const size = options?.size ?? DEFAULT_IMAGE_SIZE;
  const n = options?.n ?? 1;

  await waitForRateLimit();

  const payload = {
    model,
    input: {
      messages: [
        { role: 'user', content: [{ text: prompt }] },
      ],
    },
    parameters: {
      size,
      prompt_extend: options?.promptExtend ?? true,
      watermark: options?.watermark ?? false,
      n,
    },
  };

  const response = await fetchWithRetry(DASHSCOPE_IMAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error('Failed to parse DashScope image response as JSON');
  }

  const output = data.output as {
    choices?: Array<{
      message?: { content?: Array<{ image?: string }> };
    }>;
  } | undefined;
  const imageUrl = output?.choices?.[0]?.message?.content?.[0]?.image;

  if (!imageUrl) {
    throw new Error(
      `DashScope returned no image URL. output: ${JSON.stringify(data.output)}`,
    );
  }

  recordRequest();

  const usage = data.usage as { image_count?: number } | undefined;

  console.log(
    `[DashScope] model=${model} action=generateImage images=${n} size=${size}`,
  );

  return {
    imageUrl,
    usage: { imageCount: usage?.image_count ?? 1 },
  };
}

// ─── VISION / OCR ─────────────────────────────────────────────────────────

/**
 * Анализ картинки через Qwen-VL (OpenAI-совместимый API)
 * @input imageSource — URL или base64 (data:image/...;base64,...), prompt — что извлечь
 * @output VisionResponse с текстом ответа и usage
 */
async function analyzeImage(
  imageSource: string,
  prompt: string,
  options?: VisionOptions,
): Promise<VisionResponse> {
  const apiKey = getApiKey();
  const model = options?.model ?? DEFAULT_VISION_MODEL;
  const maxTokens = options?.maxTokens ?? DEFAULT_VISION_MAX_TOKENS;
  const temperature = options?.temperature ?? DEFAULT_VISION_TEMPERATURE;

  await waitForRateLimit();

  const payload = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageSource } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  };

  const response = await fetchWithRetry(DASHSCOPE_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error('Failed to parse DashScope Vision response as JSON');
  }

  const choices = data.choices as Array<{
    message?: { content?: string };
    finish_reason?: string;
  }> | undefined;
  const content = choices?.[0]?.message?.content;

  if (content == null) {
    throw new Error(
      `DashScope Vision returned empty response (finish_reason: ${choices?.[0]?.finish_reason})`,
    );
  }

  recordRequest();

  const usage = data.usage as {
    prompt_tokens?: number;
    completion_tokens?: number;
  } | undefined;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const totalTokens = promptTokens + completionTokens;

  console.log(
    `[DashScope] model=${model} action=analyzeImage tokens=${totalTokens} (in:${promptTokens}/out:${completionTokens})`,
  );

  return {
    content,
    usage: { promptTokens, completionTokens, totalTokens },
  };
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────

export {
  generateImage,
  analyzeImage,
  DASHSCOPE_IMAGE_URL,
  DASHSCOPE_CHAT_URL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VISION_MODEL,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_VISION_MAX_TOKENS,
  DEFAULT_VISION_TEMPERATURE,
  REQUEST_TIMEOUT_MS,
  MAX_RETRIES,
  RATE_LIMIT_PER_MINUTE,
};
