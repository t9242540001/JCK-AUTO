import Anthropic from "@anthropic-ai/sdk";
import type { Car } from "@/types/car";
import { getAnthropicApiKey } from "./config";
const SYSTEM_PROMPT = `You are an expert at extracting car data from Chinese car marketplace screenshots.
Analyze the screenshot and return ONLY valid JSON (no markdown, no \`\`\`json\`\`\`, no explanations).
The screenshot is from a Chinese used car platform (e.g. 瓜子二手车, 懂车帝, 二手车之家, 优信). Look for:
- Price — VERY IMPORTANT! Chinese car prices use 万 (wàn = 10,000). Examples:
  * "11.28万" = 112800 yuan
  * "7.28万" = 72800 yuan
  * "21.38万" = 213800 yuan
  * "5.6万" = 56000 yuan
  * "¥11.28万" = 112800 yuan
  The price is usually the LARGEST prominent number on the page, often in red/orange.
  ALWAYS convert 万 to full yuan: multiply by 10000 and return as INTEGER.
- Brand and model name
- Year/date of manufacture (上牌 = registration date, 年款 = model year)
- Engine volume (in liters, e.g. "1.0" means 1.0L, "1.5T" means 1.5L turbo)
- Mileage (万公里 means x10000 km, e.g. "2.9万公里" = 29000 km)
- Transmission type (AT/MT/CVT/DCT)
- Drive type (2WD/4WD/AWD)
- Fuel type
- Power (kW and hp/л.с.)
- Color
- Location (city/province)
Return this exact JSON structure:
{
  "brand": "Honda",
  "model": "Crider",
  "fullName": "Honda Crider 2019 180TURBO Luxury",
  "year": 2019,
  "price": 62000,
  "currency": "CNY",
  "mileage": 29000,
  "engineVolume": 1.0,
  "transmission": "AT",
  "drivetrain": "2WD",
  "fuelType": "Бензин",
  "color": "Белый",
  "power": 122,
  "powerKw": 90,
  "bodyType": "Седан",
  "location": "heilongjiang / haerbin",
  "isNativeMileage": true,
  "hasInspectionReport": false,
  "condition": "",
  "features": []
}
CRITICAL RULES:
- price MUST be an INTEGER in full yuan (NOT in 万). "7.28万" → 72800, "11.28万" → 112800
- If you see a number like 7.28 or 11.28 next to 万, multiply by 10000
- mileage MUST be in km. "2.9万公里" → 29000
- engineVolume is in LITERS as a DECIMAL number (e.g. 1.0, 1.4, 2.0)
- year is a 4-digit integer (e.g. 2021)
- Do NOT include "Used" or "二手" in brand or model
- If a value is not visible on the screenshot, use null
- All number fields must be numbers, not strings
- NEVER return price as null if you can see ANY price number on the screenshot`;
function cleanCarName(value: string): string {
  return value.replace(/^Used\s+/i, "").trim();
}
function extractJson(text: string): string {
  const fenced = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0].trim();
  return text.trim();
}
const RETRY_PROMPT = `Extract car data from this Chinese car marketplace screenshot. Return ONLY a JSON object.
PRICE: Chinese prices use 万 (=10000). "7.28万" = 72800, "11.28万" = 112800. Return price as INTEGER in full yuan.
MILEAGE: "2.9万公里" = 29000 km. Return as INTEGER in km.
Engine volume is in liters (1.0 = 1.0L, 1.5T = 1.5L turbo).
Format: {"brand":"","model":"","fullName":"","year":0,"price":72800,"currency":"CNY","mileage":29000,"engineVolume":1.5,"transmission":"AT","drivetrain":"2WD","fuelType":"","color":"","power":0,"bodyType":"","location":""}
Do NOT include "Used" in brand or model. All numbers must be integers or decimals, not strings.`;
function isBlockedOrNetworkError(err: unknown): boolean {
  const apiErr = err as { status?: number; code?: string; message?: string };
  if (apiErr.status === 403) return true;
  if (apiErr.code === "ECONNREFUSED" || apiErr.code === "ENOTFOUND") return true;
  if (apiErr.code === "ETIMEDOUT" || apiErr.code === "ECONNRESET") return true;
  const msg = apiErr.message?.toLowerCase() || "";
  if (msg.includes("forbidden") || msg.includes("blocked") || msg.includes("network")) return true;
  return false;
}
export function parseFromFolderName(folderName: string): Partial<Car> {
  const cleaned = folderName.replace(/^Used\s+/i, "").trim();
  const parts = cleaned.split(/\s+/);
  const brand = parts[0] || "";
  let year = 0;
  let yearIdx = -1;
  for (let i = 1; i < parts.length; i++) {
    const match = parts[i].match(/^(20\d{2})$/);
    if (match) { year = parseInt(match[1], 10); yearIdx = i; break; }
  }
  const modelParts = yearIdx > 1 ? parts.slice(1, yearIdx) : parts.slice(1, 2);
  const model = modelParts.join(" ") || "";
  let engineVolume = 0;
  for (const part of parts) {
    const evMatch = part.match(/^(\d+\.\d+)[LlTt]?$/);
    if (evMatch) { engineVolume = parseFloat(evMatch[1]); break; }
    const compactMatch = part.match(/^(\d)(\d)[Ll]$/);
    if (compactMatch) { engineVolume = parseFloat(`${compactMatch[1]}.${compactMatch[2]}`); break; }
  }
  console.log(`[screenshotParser] Parsed from folder name: brand="${brand}", model="${model}", year=${year}, engineVolume=${engineVolume}`);
  return {
    brand, model, folderName: cleaned, year, price: 0, currency: "CNY",
    mileage: 0, engineVolume, transmission: "AT", drivetrain: "2WD",
    fuelType: "Бензин", color: "", power: 0, bodyType: "", location: "",
    isNativeMileage: false, hasInspectionReport: false, condition: "", features: [],
  };
}
export async function parseCarScreenshot(
  imageBuffer: Buffer, folderName: string, retry = false, mimeType = "image/jpeg",
): Promise<Partial<Car> & { needsAiProcessing?: boolean }> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const base64 = imageBuffer.toString("base64");
  const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const normalizedMime = allowedMime.includes(mimeType) ? mimeType : "image/jpeg";
  console.log(`[screenshotParser] Calling Anthropic Vision API for "${folderName}" (base64 size: ${base64.length}, mime: ${normalizedMime}, retry: ${retry})`);
  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: retry ? RETRY_PROMPT : SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: normalizedMime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: base64 } },
          { type: "text", text: retry
            ? `Extract car data from this screenshot. Folder name hint: "${folderName}". Return ONLY JSON.`
            : `Extract all car data from this Chinese car marketplace screenshot. The folder name is "${folderName}". Return ONLY a JSON object with the car details.` },
        ],
      }],
    });
  } catch (err: unknown) {
    const apiErr = err as { status?: number; message?: string; body?: unknown; code?: string };
    console.error(`[screenshotParser] Anthropic API error for "${folderName}":`, `status=${apiErr.status ?? "unknown"}`, `code=${apiErr.code ?? "none"}`, `message=${apiErr.message ?? "none"}`);
    if (apiErr.body) console.error("[screenshotParser] Response body:", JSON.stringify(apiErr.body).slice(0, 500));
    if (apiErr.status === 401) throw new Error(`[screenshotParser] Invalid API key (authentication_error). Check ANTHROPIC_API_KEY. Status: 401`);
    if (isBlockedOrNetworkError(err)) {
      console.warn("[screenshotParser] Anthropic API blocked from this IP (403). Falling back to folder name parsing.");
      return { ...parseFromFolderName(folderName), needsAiProcessing: true };
    }
    throw new Error(`[screenshotParser] Unexpected API error for "${folderName}": status=${apiErr.status ?? "unknown"}, message=${apiErr.message ?? "none"}`);
  }
  console.log(`[screenshotParser] Anthropic API responded. stop_reason=${response.stop_reason}, usage: input=${response.usage.input_tokens} output=${response.usage.output_tokens}`);
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error("[screenshotParser] No text block in response. Falling back to folder name.");
    return { ...parseFromFolderName(folderName), needsAiProcessing: true };
  }
  // CRITICAL: Log raw response for debugging
  console.log(`[screenshotParser] Raw Claude response for "${folderName}":\n${textBlock.text.slice(0, 500)}`);
  const jsonStr = extractJson(textBlock.text);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error(`[screenshotParser] JSON parse failed for "${folderName}". Raw text: ${textBlock.text.slice(0, 300)}`);
    console.warn(`[screenshotParser] Using folder name fallback due to JSON parse failure.`);
    return { ...parseFromFolderName(folderName), needsAiProcessing: true };
  }
  console.log(`[screenshotParser] Parsed JSON for "${folderName}": ${JSON.stringify(parsed).slice(0, 400)}`);
  // MERGE with folder name fallback instead of throwing
  const folderData = parseFromFolderName(folderName);
  const pick = <T>(aiVal: T | undefined | null, fallbackVal: T | undefined | null, defaultVal: T): T => {
    if (aiVal !== undefined && aiVal !== null && aiVal !== "" && aiVal !== 0) return aiVal;
    if (fallbackVal !== undefined && fallbackVal !== null && fallbackVal !== "" && fallbackVal !== 0) return fallbackVal;
    return defaultVal;
  };
  const brand = cleanCarName(pick(parsed.brand as string, folderData.brand, ""));
  const model = cleanCarName(pick(parsed.model as string, folderData.model, ""));
  const year = pick(parsed.year as number, folderData.year, 0);
  let price = (parsed.price as number) ?? 0;
  // Safety: if model returned price in 万 units (e.g. 7.28 instead of 72800), convert
  if (price > 0 && price < 500) {
    console.log(`[screenshotParser] Price ${price} looks like 万 units, converting to yuan: ${Math.round(price * 10000)}`);
    price = Math.round(price * 10000);
  }
  const engineVolume = pick(parsed.engineVolume as number, folderData.engineVolume, 0);
  const mileage = (parsed.mileage as number) ?? 0;
  // Safety: if model returned mileage in 万公里 units (e.g. 2.9 instead of 29000), convert
  let safeMileage = mileage;
  if (mileage > 0 && mileage < 100) {
    console.log(`[screenshotParser] Mileage ${mileage} looks like 万km, converting: ${Math.round(mileage * 10000)}`);
    safeMileage = Math.round(mileage * 10000);
  }
  const hasMinimumData = brand.length > 0 && model.length > 0;
  const hasGoodData = hasMinimumData && price > 0 && year > 0;
  if (!hasMinimumData) {
    console.warn(`[screenshotParser] Could not extract brand+model for "${folderName}". Falling back.`);
    return { ...folderData, needsAiProcessing: true };
  }
  console.log(`[screenshotParser] OK "${folderName}": brand="${brand}", model="${model}", year=${year}, price=${price}, engineVolume=${engineVolume}, needsAi=${!hasGoodData}`);
  return {
    brand, model,
    folderName: (parsed.fullName as string) || folderName,
    year, price,
    currency: (parsed.currency as Car["currency"]) || "CNY",
    mileage: safeMileage,
    engineVolume,
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
    needsAiProcessing: !hasGoodData,
  };
}
