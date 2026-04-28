/**
 * @file        diagnose-encar-photos.ts
 * @description One-off diagnostic — fetches the public Encar vehicle endpoint
 *              for a given carid, dumps the full JSON to /tmp, and analyzes
 *              the structure of raw.photos to find category/sort-order fields
 *              that could let us pick a single hero exterior photo instead of
 *              the current photoUrls[0] (which is often a random interior).
 *              No production code touched. No commits expected — kept in
 *              scripts/ for future re-runs if Encar's response shape drifts.
 *
 * Usage: npx tsx scripts/diagnose-encar-photos.ts <carid>
 *
 * @lastModified 2026-04-28
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ENCAR_VEHICLE_ENDPOINT = 'https://api.encar.com/v1/readside/vehicle';
const FETCH_TIMEOUT_MS = 15_000;

const CATEGORY_LIKE_KEYS = [
  'category',
  'type',
  'kind',
  'group',
  'role',
  'sort',
  'seq',
  'sortOrder',
  'sortNo',
  'sequence',
  'position',
  'idx',
  'code',
];

function usageAndExit(): never {
  process.stderr.write(
    'Usage: npx tsx scripts/diagnose-encar-photos.ts <carid>\n' +
      '       <carid> must be a positive integer (e.g. 12345678).\n',
  );
  process.exit(1);
}

function header(title: string): void {
  console.log(`\n== ${title} ==`);
}

async function fetchVehicle(carid: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${ENCAR_VEHICLE_ENDPOINT}/${carid}`;
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 404) {
      process.stderr.write(`carid ${carid} не найден или объявление снято (HTTP 404).\n`);
      process.exit(1);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable body>');
      process.stderr.write(`HTTP ${res.status} ${res.statusText} for carid ${carid}.\n`);
      process.stderr.write(`Body (first 500 chars): ${body.slice(0, 500)}\n`);
      process.exit(1);
    }
    return await res.json();
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      process.stderr.write(`Request timed out after ${FETCH_TIMEOUT_MS}ms.\n`);
    } else {
      process.stderr.write(`Network error: ${(err as Error).message}\n`);
    }
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

function unionOfKeys(items: unknown[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    if (item && typeof item === 'object') {
      for (const k of Object.keys(item as Record<string, unknown>)) set.add(k);
    }
  }
  return [...set].sort();
}

function buildHistogram(items: unknown[], key: string): Map<string, number> {
  const hist = new Map<string, number>();
  for (const item of items) {
    if (item && typeof item === 'object' && key in (item as Record<string, unknown>)) {
      const v = (item as Record<string, unknown>)[key];
      const label = v === null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      hist.set(label, (hist.get(label) ?? 0) + 1);
    }
  }
  return hist;
}

function pickLikely(keys: string[]): string[] {
  const found = new Set<string>();
  for (const candidate of CATEGORY_LIKE_KEYS) {
    for (const k of keys) {
      if (k.toLowerCase() === candidate.toLowerCase() || k.toLowerCase().includes(candidate.toLowerCase())) {
        found.add(k);
      }
    }
  }
  return [...found];
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) usageAndExit();
  const carid = Number(arg);
  if (!Number.isInteger(carid) || carid <= 0) usageAndExit();

  header(`FETCH carid=${carid}`);
  const raw = (await fetchVehicle(carid)) as Record<string, unknown>;

  const dumpPath = path.join('/tmp', `encar-${carid}-raw.json`);
  fs.writeFileSync(dumpPath, JSON.stringify(raw, null, 2), 'utf-8');
  console.log(`Полный JSON сохранён: ${dumpPath}`);

  header('VEHICLE IDENTITY');
  const category = (raw as { category?: Record<string, unknown> }).category;
  if (category && typeof category === 'object') {
    console.log(`manufacturer: ${String(category.manufacturerEnglishName ?? category.manufacturerName ?? '?')}`);
    console.log(`model:        ${String(category.modelEnglishName ?? category.modelName ?? '?')}`);
    console.log(`grade:        ${String(category.gradeEnglishName ?? category.gradeName ?? '?')}`);
    console.log(`year:         ${String(category.yearMonth ?? '?')}`);
  } else {
    console.log('raw.category отсутствует или не объект.');
  }

  const advertisement = (raw as { advertisement?: Record<string, unknown> }).advertisement;
  if (advertisement && typeof advertisement === 'object') {
    console.log(`price:        ${String(advertisement.price ?? '?')}`);
  } else {
    console.log('raw.advertisement отсутствует.');
  }

  header('PHOTOS — STRUCTURE');
  const photos = (raw as { photos?: unknown[] }).photos;
  if (!Array.isArray(photos)) {
    console.log('raw.photos отсутствует или не массив. Анализ невозможен.');
    console.log(`\nПолный JSON в ${dumpPath} — откройте руками.`);
    return;
  }

  console.log(`Всего элементов: ${photos.length}`);

  const keys = unionOfKeys(photos);
  console.log(`Уникальных ключей в элементах photos: ${keys.length}`);
  console.log(`Ключи: ${keys.join(', ')}`);

  header('PHOTOS — FIRST 5 ELEMENTS (compact)');
  for (let i = 0; i < Math.min(5, photos.length); i++) {
    console.log(`[${i}] ${JSON.stringify(photos[i])}`);
  }

  header('PHOTOS — CATEGORY-LIKE FIELDS HISTOGRAM');
  const likely = pickLikely(keys);
  if (likely.length === 0) {
    console.log('Не найдено полей, похожих на категорию/порядок.');
    console.log(`Кандидаты (искали): ${CATEGORY_LIKE_KEYS.join(', ')}`);
  } else {
    for (const key of likely) {
      const hist = buildHistogram(photos, key);
      console.log(`\nПоле "${key}":`);
      const entries = [...hist.entries()].sort((a, b) => b[1] - a[1]);
      for (const [value, count] of entries) {
        console.log(`  ${value} → ${count}`);
      }
    }
  }

  header('NEXT STEP');
  console.log(`Полный JSON сохранён в ${dumpPath}.`);
  console.log('Откройте файл руками, чтобы изучить поля, которые скрипт не угадал.');
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${(err as Error).message}\n`);
  process.exit(1);
});
