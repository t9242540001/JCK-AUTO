/**
 * @file fix-catalog-jpeg-paths.ts
 * @description Заменяет .jpeg → .jpg во всех путях photos[] в catalog.json
 * @runs VDS
 * @triggers пользователь (однократно)
 * @input /var/www/jckauto/storage/catalog/catalog.json
 * @output /var/www/jckauto/storage/catalog/catalog.json (обновлённый)
 */

import * as fs from "fs";

const CATALOG_PATH =
  process.env.CATALOG_PATH ||
  "/var/www/jckauto/storage/catalog/catalog.json";

interface CatalogCar {
  id: string;
  photos: string[];
  [key: string]: unknown;
}

const raw = fs.readFileSync(CATALOG_PATH, "utf-8");
const cars: CatalogCar[] = JSON.parse(raw);

let pathsChanged = 0;

for (const car of cars) {
  for (let i = 0; i < car.photos.length; i++) {
    if (/\.jpeg$/i.test(car.photos[i])) {
      const oldPath = car.photos[i];
      car.photos[i] = oldPath.replace(/\.jpeg$/i, ".jpg");
      console.log(`  ${car.id}: ${oldPath} → ${car.photos[i]}`);
      pathsChanged++;
    }
  }
}

if (pathsChanged === 0) {
  console.log("Нет .jpeg путей в catalog.json.");
} else {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(cars, null, 2), "utf-8");
  console.log(`\nГотово: исправлено ${pathsChanged} путей .jpeg → .jpg.`);
}
