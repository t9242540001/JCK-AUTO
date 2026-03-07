/**
 * @file reset-price-2021.ts
 * @description Сбрасывает priceCalculatedAt/priceRub/priceBreakdown для авто 2021 года,
 *              чтобы workflow пересчитал цены после фикса границы возраста ЕТС (years<=5)
 * @runs VDS
 * @triggers пользователь (однократно после деплоя фикса)
 * @input /var/www/jckauto/storage/catalog/catalog.json
 * @output /var/www/jckauto/storage/catalog/catalog.json (обновлённый)
 */

import * as fs from "fs";

const CATALOG_PATH =
  process.env.CATALOG_PATH ||
  "/var/www/jckauto/storage/catalog/catalog.json";

interface CatalogCar {
  id: string;
  year: number;
  priceRub?: number | null;
  priceCalculatedAt?: string | null;
  priceBreakdown?: Record<string, number> | null;
  [key: string]: unknown;
}

const raw = fs.readFileSync(CATALOG_PATH, "utf-8");
const cars: CatalogCar[] = JSON.parse(raw);

let resetCount = 0;

for (const car of cars) {
  if (car.year === 2021) {
    console.log(
      `  → ${car.id} | priceRub: ${car.priceRub?.toLocaleString("ru-RU") ?? "null"} → сброс`,
    );
    car.priceCalculatedAt = null;
    car.priceRub = null;
    car.priceBreakdown = null;
    resetCount++;
  }
}

if (resetCount === 0) {
  console.log("Авто 2021 года не найдено в каталоге.");
} else {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(cars, null, 2), "utf-8");
  console.log(`\nГотово: сброшено ${resetCount} авто 2021 года.`);
  console.log("Запустите workflow sync-catalog для пересчёта цен.");
}
