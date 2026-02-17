import Anthropic from "@anthropic-ai/sdk";
import type { Car } from "@/types/car";
import { getAnthropicApiKey } from "./config";

const SYSTEM_PROMPT = `Ты — копирайтер автосалона JCK AUTO. Напиши короткое привлекательное описание автомобиля для карточки на сайте (3-4 предложения). Целевая аудитория: мужчины 28-50 лет, предприниматели, ценят прозрачность и факты. Тон: уверенный, но без восклицательных знаков и пустых обещаний. Акцент на конкретных преимуществах. НЕ упоминай JCK AUTO в тексте.`;

/**
 * Generate a template description when Anthropic API is unavailable.
 */
function generateFallbackDescription(car: Car): string {
  const parts: string[] = [];

  const name = `${car.brand} ${car.model}`.trim();
  if (name && car.year) {
    parts.push(`${name} ${car.year} года`);
  } else if (name) {
    parts.push(name);
  }

  const specs: string[] = [];
  if (car.engineVolume) specs.push(`${car.engineVolume}л`);
  if (car.power) specs.push(`${car.power} л.с.`);
  if (car.transmission === "AT") specs.push("автомат");
  if (car.transmission === "MT") specs.push("механика");
  if (car.drivetrain && car.drivetrain !== "2WD") specs.push(car.drivetrain);

  if (specs.length > 0) {
    parts.push(`Характеристики: ${specs.join(", ")}.`);
  }

  if (car.mileage) {
    parts.push(`Пробег ${car.mileage.toLocaleString("ru-RU")} км.`);
  }

  if (car.features && car.features.length > 0) {
    parts.push(`Оснащение: ${car.features.slice(0, 5).join(", ")}.`);
  }

  return parts.join(" ") || `${name || "Автомобиль"} в наличии. Подробности по запросу.`;
}

export async function generateCarDescription(car: Car): Promise<string> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });

  const carData = {
    brand: car.brand,
    model: car.model,
    year: car.year,
    price: car.price,
    currency: car.currency,
    mileage: car.mileage,
    engineVolume: car.engineVolume,
    transmission: car.transmission,
    drivetrain: car.drivetrain,
    fuelType: car.fuelType,
    power: car.power,
    bodyType: car.bodyType,
    color: car.color,
    condition: car.condition,
    features: car.features,
    country: car.country,
    isNativeMileage: car.isNativeMileage,
    hasInspectionReport: car.hasInspectionReport,
  };

  console.log(`[descriptionGenerator] Calling Anthropic API for "${car.brand} ${car.model}"...`);

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(carData, null, 2),
        },
      ],
    });
  } catch (err: unknown) {
    const apiErr = err as { status?: number; message?: string; body?: unknown; code?: string };
    console.error(
      `[descriptionGenerator] Anthropic API error:`,
      `status=${apiErr.status ?? "unknown"}`,
      `code=${apiErr.code ?? "none"}`,
      `message=${apiErr.message ?? "none"}`,
    );
    if (apiErr.body) {
      console.error("[descriptionGenerator] Response body:", JSON.stringify(apiErr.body).slice(0, 500));
    }

    // Fallback: generate template description
    console.warn("[descriptionGenerator] Falling back to template description.");
    return generateFallbackDescription(car);
  }

  console.log(`[descriptionGenerator] Anthropic API responded. usage: input=${response.usage.input_tokens} output=${response.usage.output_tokens}`);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.warn("[descriptionGenerator] No text in response, using fallback.");
    return generateFallbackDescription(car);
  }

  return textBlock.text.trim();
}
