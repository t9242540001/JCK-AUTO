import Anthropic from "@anthropic-ai/sdk";
import type { Car } from "@/types/car";
import { getAnthropicApiKey } from "./config";

const SYSTEM_PROMPT = `Ты — копирайтер автосалона JCK AUTO. Напиши короткое привлекательное описание автомобиля для карточки на сайте (3-4 предложения). Целевая аудитория: мужчины 28-50 лет, предприниматели, ценят прозрачность и факты. Тон: уверенный, но без восклицательных знаков и пустых обещаний. Акцент на конкретных преимуществах. НЕ упоминай JCK AUTO в тексте.`;

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

  const response = await client.messages.create({
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

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  return textBlock.text.trim();
}
