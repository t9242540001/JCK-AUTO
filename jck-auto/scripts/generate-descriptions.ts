import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";

interface Car {
  id: string;
  brand: string;
  model: string;
  year: number;
  country: string;
  engineVolume: number;
  power: number;
  transmission: string;
  drivetrain: string;
  mileage: number;
  color: string;
  bodyType: string;
  condition: string;
  features: string[];
  description?: string;
  [key: string]: unknown;
}

const CATALOG_PATH =
  process.env.CATALOG_PATH ||
  "/var/www/jckauto/storage/catalog/catalog.json";

function buildPrompt(car: Car): string {
  return `Ты — копирайтер автомобильного импортёра JCK AUTO. Напиши продающее описание автомобиля для карточки на сайте.

Автомобиль: ${car.brand} ${car.model} ${car.year}
Страна: ${car.country}
Двигатель: ${car.engineVolume} л, ${car.power} л.с.
КПП: ${car.transmission}
Привод: ${car.drivetrain}
Пробег: ${car.mileage} км
Цвет: ${car.color}
Кузов: ${car.bodyType}
Состояние: ${car.condition || "не указано"}
Оснащение: ${car.features.length > 0 ? car.features.join(", ") : "не указано"}

Требования к тексту:
- 2-3 коротких абзаца, 80-150 слов максимум
- Первый абзац: чем этот автомобиль интересен (1-2 предложения)
- Второй абзац: ключевые характеристики и для кого подходит (2-3 предложения)
- Третий абзац (опционально): особенности если есть (малый пробег, экономичность, редкая комплектация)
- Если мощность ≤160 л.с. — кратко упомяни льготный утильсбор
- Тон: уверенный, экспертный, лаконичный
- Язык: русский
- НЕ используй: "не упустите", "спешите", "только сегодня", "звоните"
- НЕ указывай цену
- Разделяй абзацы через \\n\\n`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ERROR: ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }

  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`ERROR: catalog.json not found at ${CATALOG_PATH}`);
    process.exit(1);
  }

  const cars: Car[] = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
  console.log(`Total cars in catalog: ${cars.length}`);

  const pending = cars.filter(
    (c) => !c.description || String(c.description).trim() === ""
  );
  console.log(`Cars needing description: ${pending.length}`);
  console.log(
    `Skipping: ${cars.length - pending.length} (already have description)`
  );

  if (pending.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const client = new Anthropic({ apiKey });

  let processed = 0;
  let errors = 0;

  for (const car of pending) {
    console.log(
      `\n--- Processing: ${car.brand} ${car.model} ${car.year} (${car.id}) ---`
    );

    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: buildPrompt(car),
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        console.error(`  No text in response for ${car.id}`);
        errors++;
        continue;
      }

      const description = textBlock.text.trim();
      car.description = description;
      processed++;
      console.log(
        `  OK: ${description.length} chars, ${description.split("\n\n").length} paragraphs`
      );
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 401) {
        console.error("ERROR: Invalid API key");
        process.exit(1);
      }
      if (error.status === 403) {
        console.error(
          "ERROR: API blocked (geo-restriction), run on GitHub Actions"
        );
        process.exit(1);
      }
      console.error(
        `  ERROR for ${car.id}: ${error.message || String(err)}`
      );
      errors++;
    }

    // Rate limit: 2s pause between requests
    if (car !== pending[pending.length - 1]) {
      await sleep(2000);
    }
  }

  // Save updated catalog
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(cars, null, 2), "utf-8");

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Skipped: ${cars.length - pending.length}`);

  if (processed === 0 && errors > 0) {
    console.error("All attempts failed");
    process.exit(1);
  }
}

main();
