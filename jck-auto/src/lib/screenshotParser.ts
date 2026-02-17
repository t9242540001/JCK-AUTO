import Anthropic from "@anthropic-ai/sdk";
import type { Car } from "@/types/car";
import { getAnthropicApiKey } from "./config";

const SYSTEM_PROMPT = `Ты — эксперт по автомобилям. Проанализируй скриншот с характеристиками автомобиля с китайской площадки. Извлеки ВСЕ данные и верни ТОЛЬКО валидный JSON без markdown-обёртки, без \`\`\`json\`\`\`, без пояснений. Формат:
{
  "brand": "марка (например Audi)",
  "model": "модель (например Q3)",
  "fullName": "полное название как на скрине",
  "year": 2021,
  "price": 186000,
  "currency": "CNY",
  "mileage": 39986,
  "engineVolume": 1.4,
  "transmission": "AT",
  "drivetrain": "2WD",
  "fuelType": "Бензин",
  "color": "Серый",
  "power": 150,
  "powerKw": 110,
  "bodyType": "Кроссовер",
  "location": "heilongjiang / haerbin",
  "isNativeMileage": true,
  "hasInspectionReport": false,
  "condition": "Оригинальная краска на металлических деталях",
  "features": ["Панорамная крыша", "Круиз-контроль", "LDWS"]
}
Правила:
- currency всегда "CNY" для китайских площадок
- transmission: "AT" для автомат, "MT" для механика
- drivetrain: "2WD", "4WD", "AWD"
- fuelType: "Бензин", "Дизель", "Электро", "Гибрид"
- features — извлеки все опции/оснащение из скрина
- IMPORTANT: Do NOT include the word "Used" in brand or model fields. Extract only the brand name (e.g. "Lexus", not "Used Lexus") and model name (e.g. "RX 350", not "Used RX 350").
- Если данные не видны — ставь null
- bodyType определи по внешнему виду если не указан явно
- Год определи из даты выпуска если указана как дата (2021-06-10 → 2021)
- isNativeMileage: true если указано "Да" у "Родной пробег", false если "Нет"
- hasInspectionReport: true если указано "Да" у "Отчет о проверке", false если "Нет"`;

function cleanCarName(value: string): string {
  return value.replace(/^Used\s+/i, "").trim();
}

function extractJson(text: string): string {
  // Remove ```json ... ``` wrapper if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

const RETRY_PROMPT = `Extract car data from this screenshot as JSON. Return ONLY valid JSON, no markdown. Format:
{"brand":"","model":"","fullName":"","year":0,"price":0,"currency":"CNY","mileage":0,"engineVolume":0,"transmission":"AT","drivetrain":"2WD","fuelType":"","color":"","power":0,"bodyType":"","location":"","isNativeMileage":false,"hasInspectionReport":false,"condition":"","features":[]}
Do NOT include "Used" in brand or model.`;

/**
 * Check if an error is a network/access issue (403, network timeout, etc.)
 * that means the API is unreachable from the current IP.
 */
function isBlockedOrNetworkError(err: unknown): boolean {
  const apiErr = err as { status?: number; code?: string; message?: string };
  if (apiErr.status === 403) return true;
  if (apiErr.code === "ECONNREFUSED" || apiErr.code === "ENOTFOUND") return true;
  if (apiErr.code === "ETIMEDOUT" || apiErr.code === "ECONNRESET") return true;
  const msg = apiErr.message?.toLowerCase() || "";
  if (msg.includes("forbidden") || msg.includes("blocked") || msg.includes("network")) return true;
  return false;
}

/**
 * Parse car data from folder name as a fallback when Anthropic API is unavailable.
 * Expected formats:
 *   "Kia K3 2021 1.5L Stylish Edition"
 *   "Hyundai Elantra 2022"
 *   "Audi Q3 2021 35TFSI"
 *   "Used Lexus RX 350 2020"
 */
export function parseFromFolderName(folderName: string): Partial<Car> {
  const cleaned = folderName.replace(/^Used\s+/i, "").trim();
  const parts = cleaned.split(/\s+/);

  const brand = parts[0] || "";

  // Find year: first 4-digit number between 2000-2099
  let year = 0;
  let yearIdx = -1;
  for (let i = 1; i < parts.length; i++) {
    const match = parts[i].match(/^(20\d{2})$/);
    if (match) {
      year = parseInt(match[1], 10);
      yearIdx = i;
      break;
    }
  }

  // Model: everything between brand and year
  const modelParts = yearIdx > 1 ? parts.slice(1, yearIdx) : parts.slice(1, 2);
  const model = modelParts.join(" ") || "";

  // Engine volume: look for patterns like "1.5L", "2.0T", "1.4"
  let engineVolume = 0;
  for (const part of parts) {
    const evMatch = part.match(/^(\d+\.\d+)[LlTt]?$/);
    if (evMatch) {
      engineVolume = parseFloat(evMatch[1]);
      break;
    }
  }

  console.log(`[screenshotParser] Parsed from folder name: brand="${brand}", model="${model}", year=${year}, engineVolume=${engineVolume}`);

  return {
    brand,
    model,
    folderName: cleaned,
    year,
    price: 0,
    currency: "CNY",
    mileage: 0,
    engineVolume,
    transmission: "AT",
    drivetrain: "2WD",
    fuelType: "Бензин",
    color: "",
    power: 0,
    bodyType: "",
    location: "",
    isNativeMileage: false,
    hasInspectionReport: false,
    condition: "",
    features: [],
  };
}

export async function parseCarScreenshot(
  imageBuffer: Buffer,
  folderName: string,
  retry = false,
  mimeType = "image/jpeg",
): Promise<Partial<Car> & { needsAiProcessing?: boolean }> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const base64 = imageBuffer.toString("base64");

  // Normalize MIME type to a value accepted by the Anthropic API
  const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const normalizedMime = allowedMime.includes(mimeType) ? mimeType : "image/jpeg";

  console.log(`[screenshotParser] Calling Anthropic Vision API for "${folderName}" (base64 size: ${base64.length}, mime: ${normalizedMime}, retry: ${retry})`);

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: retry ? RETRY_PROMPT : SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: normalizedMime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: base64 },
            },
            {
              type: "text",
              text: retry
                ? `Extract car data from screenshot. Folder: ${folderName}`
                : `Вот скриншот автомобиля. Название папки: ${folderName}. Извлеки все характеристики.`,
            },
          ],
        },
      ],
    });
  } catch (err: unknown) {
    const apiErr = err as { status?: number; message?: string; body?: unknown; code?: string };
    console.error(
      `[screenshotParser] Anthropic API error for "${folderName}":`,
      `status=${apiErr.status ?? "unknown"}`,
      `code=${apiErr.code ?? "none"}`,
      `message=${apiErr.message ?? "none"}`,
    );
    if (apiErr.body) {
      console.error("[screenshotParser] Response body:", JSON.stringify(apiErr.body).slice(0, 500));
    }

    if (apiErr.status === 401) {
      throw new Error(
        `[screenshotParser] Invalid API key (authentication_error). Check ANTHROPIC_API_KEY. Status: 401`,
      );
    }

    if (isBlockedOrNetworkError(err)) {
      console.warn("[screenshotParser] Anthropic API blocked from this IP (403). Falling back to folder name parsing.");
      console.warn("[screenshotParser] AI processing skipped, will retry from unblocked IP later.");
      return { ...parseFromFolderName(folderName), needsAiProcessing: true };
    }

    throw new Error(
      `[screenshotParser] Unexpected API error for "${folderName}": status=${apiErr.status ?? "unknown"}, message=${apiErr.message ?? "none"}`,
    );
  }

  console.log(`[screenshotParser] Anthropic API responded. stop_reason=${response.stop_reason}, usage: input=${response.usage.input_tokens} output=${response.usage.output_tokens}`);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude Vision API");
  }

  const jsonStr = extractJson(textBlock.text);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Failed to parse JSON from Claude response: ${textBlock.text.slice(0, 200)}`
    );
  }

  // Validate required fields
  if (!parsed.brand || !parsed.model || !parsed.year || !parsed.price) {
    throw new Error(
      `Missing required fields (brand, model, year, price) in parsed data for "${folderName}"`
    );
  }

  return {
    brand: cleanCarName(parsed.brand as string),
    model: cleanCarName(parsed.model as string),
    folderName: (parsed.fullName as string) || folderName,
    year: parsed.year as number,
    price: parsed.price as number,
    currency: (parsed.currency as Car["currency"]) || "CNY",
    mileage: (parsed.mileage as number) ?? 0,
    engineVolume: (parsed.engineVolume as number) ?? 0,
    transmission: (parsed.transmission as Car["transmission"]) || "AT",
    drivetrain: (parsed.drivetrain as string) || "2WD",
    fuelType: (parsed.fuelType as string) || "Бензин",
    color: (parsed.color as string) || "",
    power: (parsed.power as number) ?? 0,
    bodyType: (parsed.bodyType as string) || "",
    location: (parsed.location as string) || "",
    isNativeMileage: (parsed.isNativeMileage as boolean) ?? false,
    hasInspectionReport: (parsed.hasInspectionReport as boolean) ?? false,
    condition: (parsed.condition as string) || "",
    features: (parsed.features as string[]) || [],
  };
}
