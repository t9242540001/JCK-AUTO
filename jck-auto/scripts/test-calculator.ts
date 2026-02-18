/**
 * Unit tests for priceCalculator.ts
 *
 * Usage:
 *   npx tsx -r tsconfig-paths/register scripts/test-calculator.ts
 */

import {
  calculatePriceFromParams,
  calculateFullPriceWithRates,
  getCustomsFee,
  getETS,
  getRecyclingFee,
  type PriceParams,
} from "@/lib/priceCalculator";
import type { CBRRates } from "@/lib/currency";
import type { Car } from "@/types/car";

/* ── Test helpers ────────────────────────────────────────────────────── */

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function assertRange(value: number, min: number, max: number, label: string): void {
  assert(
    value >= min && value <= max,
    `${label}: ${value.toLocaleString("ru-RU")} (expected ${min.toLocaleString("ru-RU")}–${max.toLocaleString("ru-RU")})`,
  );
}

function assertEqual(actual: number, expected: number, label: string): void {
  assert(
    actual === expected,
    `${label}: ${actual.toLocaleString("ru-RU")} === ${expected.toLocaleString("ru-RU")}`,
  );
}

/* ── Fixed test rates (close to real CBR rates) ──────────────────────── */

const TEST_RATES: CBRRates = {
  CNY: 11.05,
  EUR: 91.25,
  KRW: 0.0636,
  JPY: 0.582,
  date: "test",
};

const CNY_BANK = TEST_RATES.CNY * 1.02; // 11.271

/* ── Test 0: Table verification ──────────────────────────────────────── */

console.log("\n=== Test 0: Table verification ===");

// Customs processing fee — 7 brackets
assertEqual(getCustomsFee(100_000), 1_231, "Customs fee ≤200k");
assertEqual(getCustomsFee(200_000), 1_231, "Customs fee =200k (boundary)");
assertEqual(getCustomsFee(200_001), 2_667, "Customs fee 200k-450k");
assertEqual(getCustomsFee(450_000), 2_667, "Customs fee =450k (boundary)");
assertEqual(getCustomsFee(450_001), 3_898, "Customs fee 450k-1.2M");
assertEqual(getCustomsFee(1_200_000), 3_898, "Customs fee =1.2M (boundary)");
assertEqual(getCustomsFee(1_200_001), 4_924, "Customs fee 1.2M-2.5M");
assertEqual(getCustomsFee(2_500_001), 8_229, "Customs fee 2.5M-5.5M");
assertEqual(getCustomsFee(5_500_001), 13_539, "Customs fee 5.5M-10M");
assertEqual(getCustomsFee(10_000_001), 21_344, "Customs fee >10M");

/* ── Test 0b: ETS boundary cases ─────────────────────────────────────── */

console.log("\n=== Test 0b: ETS boundary cases (3-5 years) ===");

const eur = TEST_RATES.EUR;

// 1500cc should use rate 1.7 (not 2.5)
const ets1500 = getETS(1500, "3to5", eur);
const expected1500 = Math.round(1500 * 1.7 * eur);
assertEqual(ets1500, expected1500, "ETS 1500cc → rate 1.7 (boundary ≤1500)");

// 1501cc should use rate 2.5
const ets1501 = getETS(1501, "3to5", eur);
const expected1501 = Math.round(1501 * 2.5 * eur);
assertEqual(ets1501, expected1501, "ETS 1501cc → rate 2.5 (>1500)");

// 1800cc should use rate 2.5 (not 2.7)
const ets1800 = getETS(1800, "3to5", eur);
const expected1800 = Math.round(1800 * 2.5 * eur);
assertEqual(ets1800, expected1800, "ETS 1800cc → rate 2.5 (boundary ≤1800)");

// 1801cc should use rate 2.7
const ets1801 = getETS(1801, "3to5", eur);
const expected1801 = Math.round(1801 * 2.7 * eur);
assertEqual(ets1801, expected1801, "ETS 1801cc → rate 2.7 (>1800)");

// 1000cc boundary
const ets1000 = getETS(1000, "3to5", eur);
assertEqual(ets1000, Math.round(1000 * 1.5 * eur), "ETS 1000cc → rate 1.5 (boundary ≤1000)");

console.log("\n=== Test 0c: ETS >5 years ===");
const ets1500over5 = getETS(1500, "over5", eur);
assertEqual(ets1500over5, Math.round(1500 * 3.2 * eur), "ETS 1500cc over5 → rate 3.2");
const ets2000over5 = getETS(2000, "over5", eur);
assertEqual(ets2000over5, Math.round(2000 * 4.8 * eur), "ETS 2000cc over5 → rate 4.8");

/* ── Test 0d: Recycling fee ──────────────────────────────────────────── */

console.log("\n=== Test 0d: Recycling fee ===");

// Preferential: ≤160hp AND ≤3L
assertEqual(getRecyclingFee(115, 1.5, 4), Math.round(20_000 * 0.26), "Recycling 115hp 1.5L 4yr → preferential over3");
assertEqual(getRecyclingFee(115, 1.5, 2), Math.round(20_000 * 0.17), "Recycling 115hp 1.5L 2yr → preferential under3");
assertEqual(getRecyclingFee(160, 3.0, 4), Math.round(20_000 * 0.26), "Recycling 160hp 3.0L 4yr → preferential (boundary)");

// Commercial: >160hp
assertEqual(getRecyclingFee(161, 1.5, 4), Math.round(20_000 * 94.7), "Recycling 161hp 1.5L 4yr → commercial (150-180, over3)");
assertEqual(getRecyclingFee(250, 3.0, 2), Math.round(20_000 * 85.8), "Recycling 250hp 3.0L 2yr → commercial (240-270, under3)");

// Commercial: ≤160hp but >3L
assertEqual(getRecyclingFee(150, 3.5, 4), Math.round(20_000 * 85.28), "Recycling 150hp 3.5L 4yr → commercial (volume >3L, 120-150, over3)");

/* ── Test 1: Hyundai Elantra ─────────────────────────────────────────── */

console.log("\n=== Test 1: Hyundai Elantra ¥82000, 1.5L, 115hp, 4yr ===");

const elantra = calculatePriceFromParams(
  { priceYuan: 82_000, engineVolumeLiters: 1.5, horsePower: 115, carAgeYears: 4 },
  TEST_RATES,
);

const elantraCarValue = Math.round(98_000 * CNY_BANK);
assertEqual(elantra.breakdown.carPriceRub, elantraCarValue, "Car value in ₽");
assertEqual(elantra.breakdown.customsFee, 3_898, "Customs fee (450k-1.2M bracket)");
assertEqual(elantra.breakdown.customsDuty, Math.round(1500 * 1.7 * eur), "ETS (1500cc, 3-5yr, rate 1.7)");
assertEqual(elantra.breakdown.recyclingFee, 5_200, "Recycling (preferential, over3)");
assertEqual(elantra.breakdown.deliveryCost, 100_000, "Russia expenses");
assertEqual(elantra.breakdown.serviceFee, 50_000, "Commission");
assertRange(elantra.totalRub, 1_490_000, 1_510_000, "Total price");

/* ── Test 2: Lexus NX200 ────────────────────────────────────────────── */

console.log("\n=== Test 2: Lexus NX200 ¥180000, 2.0L, 150hp, 4yr ===");

const nx200 = calculatePriceFromParams(
  { priceYuan: 180_000, engineVolumeLiters: 2.0, horsePower: 150, carAgeYears: 4 },
  TEST_RATES,
);

// 2000cc in 3-5yr → bracket 1800-2300 → rate 2.7
const expectedEtsNx = Math.round(2000 * 2.7 * eur);
assertEqual(nx200.breakdown.customsDuty, expectedEtsNx, "ETS uses rate 2.7 (1800-2300)");

// 150hp ≤ 160 AND 2000cc ≤ 3000 → preferential
assertEqual(nx200.breakdown.recyclingFee, 5_200, "Recycling = preferential (150hp ≤ 160)");

const nx200CarValue = Math.round(196_000 * CNY_BANK);
assertEqual(nx200.breakdown.carPriceRub, nx200CarValue, "Car value in ₽");
assertEqual(nx200.breakdown.deliveryCost, 100_000, "Russia expenses");
assertEqual(nx200.breakdown.serviceFee, 50_000, "Commission");

/* ── Test 3: Powerful car (commercial recycling) ─────────────────────── */

console.log("\n=== Test 3: Powerful ¥300000, 3.0L, 250hp, 2yr ===");

const powerful = calculatePriceFromParams(
  { priceYuan: 300_000, engineVolumeLiters: 3.0, horsePower: 250, carAgeYears: 2 },
  TEST_RATES,
);

// 250hp > 160 → COMMERCIAL recycling, bracket 240-270, under3 → coeff 85.8
const expectedRecycling = Math.round(20_000 * 85.8);
assertEqual(powerful.breakdown.recyclingFee, expectedRecycling, "Recycling = COMMERCIAL (250hp > 160, coeff 85.8)");

// under3 → ETS uses ETS_UNDER3 table (price-based)
assert(powerful.breakdown.customsDuty > 0, "ETS > 0 (under3, price-based)");

/* ── Test 4: Old car (>5 years ETS table) ────────────────────────────── */

console.log("\n=== Test 4: Old car ¥50000, 1.3L, 90hp, 6yr ===");

const oldCar = calculatePriceFromParams(
  { priceYuan: 50_000, engineVolumeLiters: 1.3, horsePower: 90, carAgeYears: 6 },
  TEST_RATES,
);

// 1300cc, >5yr → ETS_OVER5, bracket 1000-1500 → rate 3.2
const expectedEtsOld = Math.round(1300 * 3.2 * eur);
assertEqual(oldCar.breakdown.customsDuty, expectedEtsOld, "ETS uses >5yr table, rate 3.2 (1000-1500)");

// 90hp ≤ 160 AND 1300cc ≤ 3000 → preferential, over3
assertEqual(oldCar.breakdown.recyclingFee, 5_200, "Recycling = preferential (90hp, over3)");

/* ── Test 5: calculateFullPriceWithRates wrapper ─────────────────────── */

console.log("\n=== Test 5: Car object wrapper ===");

const testCar: Car = {
  id: "test",
  folderName: "test",
  brand: "Hyundai",
  model: "Elantra",
  year: 2022,
  price: 82_000,
  currency: "CNY",
  country: "china",
  mileage: 50_000,
  engineVolume: 1.5,
  transmission: "AT",
  drivetrain: "2WD",
  fuelType: "Бензин",
  color: "Белый",
  power: 115,
  bodyType: "Седан",
  photos: [],
  features: [],
  condition: "",
  location: "",
  isNativeMileage: true,
  hasInspectionReport: false,
  createdAt: new Date().toISOString(),
};

const carResult = calculateFullPriceWithRates(testCar, TEST_RATES);
const carAge = new Date().getFullYear() - testCar.year;
const directResult = calculatePriceFromParams(
  { priceYuan: 82_000, engineVolumeLiters: 1.5, horsePower: 115, carAgeYears: carAge },
  TEST_RATES,
);
assertEqual(carResult.totalRub, directResult.totalRub, "Car wrapper matches direct call");

/* ── Summary ─────────────────────────────────────────────────────────── */

console.log(`\n${"=".repeat(50)}`);
console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed!");
}
