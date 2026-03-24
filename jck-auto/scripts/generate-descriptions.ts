/**
 * @file generate-descriptions.ts
 * @description Генерация описаний авто через Claude API с экспертным промптом
 * @runs GitHub Actions runner (US IP — Anthropic API заблокирован с RU)
 * @triggers GitHub Actions workflow / manual
 * @input /var/www/jckauto/storage/catalog/catalog.json
 * @output /var/www/jckauto/storage/catalog/catalog.json (поле description)
 * @cost Claude Haiku ~$0.001-0.002 per car
 * @section description-gen
 */

import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

/* ── TYPES ─────────────────────────────────────────────────────────────── */

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
  fuelType?: string;
  description?: string;
  priceRub?: number;
  [key: string]: unknown;
}

/* ── CONSTANTS ─────────────────────────────────────────────────────────── */

const CATALOG_PATH =
  process.env.CATALOG_PATH ||
  "/var/www/jckauto/storage/catalog/catalog.json";

const PREMIUM_BRANDS = ["bmw", "audi", "lexus", "mercedes", "mercedes-benz", "porsche", "infiniti", "genesis"];

const CROSSOVER_KEYWORDS = [
  "x-trail", "ix35", "ix25", "vezel", "xr-v", "hr-v", "cr-v",
  "cx-5", "cx-4", "cx-30", "tiggo", "forester", "tayron", "tharu",
  "t-roc", "kx1", "kx3", "stonic", "karoq", "x1", "x3", "q2", "q3",
  "nx", "rx", "gla", "glb", "glc", "gle", "tucson", "sportage",
  "seltos", "creta", "rav4", "outlander", "qashqai", "juke",
  "tiguan", "atlas", "kodiaq", "santa fe", "sorento",
];

const COUNTRY_NAMES: Record<string, string> = {
  china: "Китай",
  korea: "Корея",
  japan: "Япония",
};

/* ── SYSTEM PROMPT ─────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `Ты — Андрей, эксперт по подбору автомобилей из Азии. За последние годы ты лично проверил сотни машин в Китае, Корее и Японии. Ты пишешь описание для карточки авто на сайте jckauto.ru — его прочитает человек, который прямо сейчас выбирает машину и сомневается.

Прежде чем писать, задай себе три вопроса:

1. «Что в этой конкретной машине зацепило бы меня,
   если бы я выбирал её для себя или для семьи?»
   Это может быть пробег, комплектация, двигатель,
   цена относительно рынка, состояние, редкость модели —
   что угодно, но конкретное для этого экземпляра.

2. «Какие опции в этой комплектации реально пригодятся
   в повседневной жизни, а какие просто строчка в списке?»
   Панорамная крыша — это не "опция", это светлый салон
   для всей семьи. Адаптивный круиз — это не "функция",
   это возможность не уставать в пробках. Перескажи опции
   языком пользы.

3. «Кто обычно покупает эту модель, и что для этого
   человека важно?»
   Honda Fit берут как второй авто в семью или как
   первую машину. BMW 320Li — для тех кто хочет премиум
   без переплаты за новый. Hyundai ix35 — семейный
   кроссовер для тех кто считает деньги. Пиши так,
   чтобы покупатель узнал в тексте себя.

Как выбрать с чего начать текст — зависит от того что в этой машине главное:

Если пробег меньше 10 тысяч — начни с этого, это главный аргумент: машина практически новая по цене б/у.

Если это премиум-бренд — начни со сравнения цены: сколько стоит аналог в России и сколько с доставкой из Азии. Разница — это то что цепляет.

Если это кроссовер — начни с того зачем его берут: семья, дороги, багажник, клиренс.

Если компактный авто — начни с экономики: расход, стоимость владения, манёвренность в городе.

Если свежий год (2023+) — начни с технологий: какие системы безопасности и комфорта есть в этой комплектации.

Можешь начать с вопроса, с цифры, с эмоции, со сравнения, с экспертной оценки — главное чтобы первое предложение давало причину читать дальше.

Вот шесть примеров как может начинаться текст:

«Ищете компактный кроссовер для города, который не разорит на обслуживании?»

«За 2.3 миллиона рублей — полноприводный Lexus с пробегом 30 тысяч. В России аналог от 4 миллионов.»

«Чёрный BMW 320Li с М-пакетом — машина, на которую оборачиваются. И она стоит вдвое меньше чем у дилера.»

«Расход 6.3 литра на трассе, 170 мм клиренса, багажник 400 литров — цифры, которые важны каждый день.»

«Мы проверили эту Honda перед покупкой: родная краска на всех элементах, ни одного перекраса.»

«В российских автосалонах Audi Q3 этого года — от 3.5 миллионов. Из Китая с доставкой под ключ — 2.1.»

В каждом описании естественно упомяни:
- Что машина прошла проверку перед отправкой (скажи это
  своими словами, каждый раз по-разному — ты же эксперт
  который реально проверяет машины)
- Страну откуда везётся авто и что доставка под ключ —
  это одно-два слова в контексте, не рекламный лозунг
- Цену в рублях (данные передаются в запросе как priceRub)

Думай о читателе: он сравнивает 5-10 вариантов на разных сайтах. Твой текст должен дать ему ощущение «эти ребята разбираются и говорят по делу». Не продавай — консультируй.

Формат: 80-150 слов, 2-3 абзаца. Без заголовков, без списков, без эмодзи.`;

/* ── HELPERS ───────────────────────────────────────────────────────────── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Определяет основной "угол" для описания на основе данных авто
 * @input car — данные авто из catalog.json
 * @output строка с описанием угла
 */
function determineAngle(car: Car): string {
  // 1. Минимальный пробег — главный аргумент
  if (car.mileage < 10000) {
    return "минимальный пробег — машина практически новая по цене б/у";
  }

  // 2. Премиум-бренд — сравнение цены
  if (PREMIUM_BRANDS.includes(car.brand.toLowerCase())) {
    return "премиум-бренд — акцент на разницу цены с российским рынком";
  }

  // 3. Кроссовер/SUV
  const modelLower = car.model.toLowerCase();
  const isCrossover = CROSSOVER_KEYWORDS.some((kw) => modelLower.includes(kw.toLowerCase()));
  if (isCrossover || car.bodyType?.toLowerCase().includes("suv") || car.bodyType?.toLowerCase().includes("кроссовер")) {
    return "семейный кроссовер — семья, дороги, багажник, клиренс";
  }

  // 4. Компактный городской авто
  const vol = car.engineVolume < 100 ? car.engineVolume * 1000 : car.engineVolume;
  if (vol <= 1500 && ["sedan", "hatchback", "седан", "хэтчбек"].some((t) => (car.bodyType || "").toLowerCase().includes(t))) {
    return "городской компактный авто — экономика, расход, манёвренность";
  }

  // 5. Свежий год
  if (car.year >= 2023) {
    return "современные технологии — системы безопасности и комфорта";
  }

  // 6. Универсальный
  return "универсальный — надёжность, соотношение цена/качество";
}

/**
 * Проверяет описание на "плохое" качество
 * @input description — текст описания
 * @output true если описание сломанное/короткое
 */
function isBadDescription(description: string): boolean {
  const words = wordCount(description);
  if (words < 50) return true;
  if (description.includes("Характеристики:")) return true;
  return false;
}

/**
 * Формирует user message с данными авто и углом
 * @input car — данные авто
 * @input angle — определённый угол описания
 * @output строка для user message
 */
function buildUserMessage(car: Car, angle: string): string {
  const vol = car.engineVolume < 100
    ? car.engineVolume.toFixed(1)
    : (car.engineVolume / 1000).toFixed(1);

  const countryName = COUNTRY_NAMES[car.country] || car.country;

  const priceFormatted = car.priceRub
    ? `${car.priceRub.toLocaleString("ru-RU")} руб.`
    : "не указана";

  const lines = [
    `Основной угол для описания: ${angle}.`,
    "",
    `Данные автомобиля:`,
    `- Марка: ${car.brand}`,
    `- Модель: ${car.model}`,
    `- Год: ${car.year}`,
    `- Страна: ${countryName}`,
    `- Объём двигателя: ${vol} л`,
    `- Мощность: ${car.power} л.с.`,
    `- КПП: ${car.transmission === "AT" ? "автомат" : car.transmission === "MT" ? "механика" : car.transmission}`,
    `- Привод: ${car.drivetrain || "не указан"}`,
    `- Пробег: ${car.mileage.toLocaleString("ru-RU")} км`,
    `- Цвет: ${car.color || "не указан"}`,
    `- Кузов: ${car.bodyType || "не указан"}`,
    `- Топливо: ${car.fuelType || "не указано"}`,
    `- Состояние: ${car.condition || "не указано"}`,
    `- Цена под ключ (priceRub): ${priceFormatted}`,
  ];

  if (car.features && car.features.length > 0) {
    lines.push(`- Оснащение: ${car.features.join(", ")}`);
  }

  return lines.join("\n");
}

function saveCatalog(cars: Car[]): void {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(cars, null, 2), "utf-8");
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

/* ── MAIN LOGIC ────────────────────────────────────────────────────────── */

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

  const args = process.argv.slice(2);
  const regenerateBad = args.includes("--regenerate-bad");
  const regenerateAll = args.includes("--regenerate-all");

  const cars: Car[] = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
  console.log(`Total cars in catalog: ${cars.length}`);

  // Filter cars to process
  let pending: Car[];

  if (regenerateAll) {
    pending = cars.filter((c) => c.priceRub && c.priceRub > 0);
    console.log(`--regenerate-all: ${pending.length} cars with price`);
    const confirmed = await askConfirmation(`Перегенерировать описания для ${pending.length} авто?`);
    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }
  } else if (regenerateBad) {
    pending = cars.filter((c) => {
      if (!c.priceRub || c.priceRub <= 0) return false;
      if (!c.description || String(c.description).trim() === "") return true;
      return isBadDescription(String(c.description));
    });
    console.log(`--regenerate-bad: ${pending.length} cars with bad/missing descriptions`);
    if (pending.length > 0) {
      for (const car of pending) {
        const desc = car.description ? String(car.description) : "(пусто)";
        const words = car.description ? wordCount(desc) : 0;
        const reason = !car.description ? "нет описания"
          : words < 50 ? `${words} слов (< 50)`
          : "содержит 'Характеристики:'";
        console.log(`  - ${car.brand} ${car.model} ${car.year}: ${reason}`);
      }
    }
  } else {
    pending = cars.filter(
      (c) => (!c.description || String(c.description).trim() === "") && c.priceRub && c.priceRub > 0
    );
    console.log(`Cars needing description: ${pending.length}`);
  }

  // Skip cars without priceRub
  const noPriceCars = cars.filter((c) => !c.priceRub || c.priceRub <= 0);
  if (noPriceCars.length > 0) {
    console.log(`Skipped (no priceRub): ${noPriceCars.length}`);
  }

  if (pending.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const client = new Anthropic({
    apiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });

  let processed = 0;
  let errors = 0;
  let retries = 0;
  let consecutive403 = 0;

  for (const car of pending) {
    const angle = determineAngle(car);
    const userMessage = buildUserMessage(car, angle);

    console.log(
      `\n--- ${car.brand} ${car.model} ${car.year} (${car.id}) | angle: ${angle} ---`
    );

    try {
      let description = await callWithRetry(client, userMessage, car.id);
      let words = wordCount(description);

      // Validation: retry if too short
      if (words < 50) {
        console.log(`  WARN: ${words} words (< 50), retrying...`);
        retries++;
        await sleep(5000);
        description = await callWithRetry(
          client,
          userMessage + "\n\nОписание получилось слишком коротким, напиши полноценный текст 80-150 слов.",
          car.id
        );
        words = wordCount(description);
      }

      // Check for foreign currency
      if (/юан|иен|вон|¥|₩|yuan|yen|won/i.test(description)) {
        console.log(`  WARN: description contains foreign currency mention`);
      }

      car.description = description;
      processed++;
      consecutive403 = 0;
      console.log(`  OK: ${words} words | "${description.slice(0, 60)}..."`);
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      console.error(`  ERROR for ${car.id}: ${error.message || String(err)}`);
      errors++;
      if (error.status === 401 || error.status === 403) {
        consecutive403++;
        if (consecutive403 >= 5) {
          console.error(`5 consecutive API errors, stopping. Progress saved: ${processed} descriptions generated.`);
          saveCatalog(cars);
          break;
        }
      }
    }

    // Progress logging every 10 cars
    const totalProcessed = processed + errors;
    if (totalProcessed > 0 && totalProcessed % 10 === 0) {
      console.log(`  [progress] ${totalProcessed}/${pending.length} processed, ${errors} errors, ${retries} retries`);
    }

    // Rate limit: 5s pause between requests
    if (car !== pending[pending.length - 1]) {
      await sleep(5000);
    }
  }

  // Save updated catalog
  saveCatalog(cars);

  console.log(`\n═══════════════════════════════════════`);
  console.log(`Summary:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Retries:   ${retries}`);
  console.log(`  Skipped:   ${cars.length - pending.length}`);
  console.log(`═══════════════════════════════════════`);

  if (processed === 0 && errors > 0) {
    console.error("All attempts failed");
    process.exit(1);
  }
}

const RETRY_DELAYS = [15000, 30000, 60000];

async function callWithRetry(
  client: Anthropic,
  userMessage: string,
  carId: string,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await generateDescription(client, userMessage);
    } catch (err: unknown) {
      lastError = err;
      const error = err as { status?: number };
      if ((error.status === 401 || error.status === 403) && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`  RETRY ${attempt + 1}/${RETRY_DELAYS.length} for ${carId}: waiting ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

async function generateDescription(
  client: Anthropic,
  userMessage: string,
): Promise<string> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in API response");
  }

  return textBlock.text.trim();
}

main();
