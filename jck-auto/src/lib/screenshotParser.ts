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
- Если данные не видны — ставь null
- bodyType определи по внешнему виду если не указан явно
- Год определи из даты выпуска если указана как дата (2021-06-10 → 2021)
- isNativeMileage: true если указано "Да" у "Родной пробег", false если "Нет"
- hasInspectionReport: true если указано "Да" у "Отчет о проверке", false если "Нет"`;

function extractJson(text: string): string {
  // Remove ```json ... ``` wrapper if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export async function parseCarScreenshot(
  imageBuffer: Buffer,
  folderName: string
): Promise<Partial<Car>> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const base64 = imageBuffer.toString("base64");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: base64 },
          },
          {
            type: "text",
            text: `Вот скриншот автомобиля. Название папки: ${folderName}. Извлеки все характеристики.`,
          },
        ],
      },
    ],
  });

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
    brand: parsed.brand as string,
    model: parsed.model as string,
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
