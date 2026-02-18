import type { Car } from "@/types/car";
import { type CBRRates, fetchCBRRates } from "./currency";
import {
  CUSTOMS_PROCESSING_FEE,
  ETS_UNDER3,
  ETS_3TO5,
  ETS_OVER5,
  RECYCLING_BASE,
  RECYCLING_INDIVIDUAL_PREFERENTIAL,
  RECYCLING_INDIVIDUAL_COMMERCIAL,
} from "./calculator-data";

/* ── Константы ─────────────────────────────────────────────────────── */

/** Фиксированные расходы в Китае (оформление, страховка, доставка до границы) */
const CHINA_MARKUP_CNY = 16_000;

/** Поправка к курсу ЦБ для приближения к банковскому курсу безнала (ВТБ) */
const CNY_BANK_MARKUP = 1.02;

/** Расходы в РФ: СБКТС, СВХ, брокер, логистика — фикс. */
const RUSSIA_EXPENSES = 100_000;

/** Комиссия JCK AUTO */
const COMMISSION = 50_000;

/* ── Типы ──────────────────────────────────────────────────────────── */

type AgeCategory = "under3" | "3to5" | "over5";

export interface PriceResult {
  totalRub: number;
  exchangeRate: number;
  date: string;
  breakdown: {
    carPriceRub: number;   // Шаг 1+2: стоимость авто в ₽
    customsFee: number;     // Шаг 3а: таможенное оформление
    customsDuty: number;    // Шаг 3б: ЕТС
    recyclingFee: number;   // Шаг 3в: утилизационный сбор
    deliveryCost: number;   // Шаг 4: расходы в РФ
    serviceFee: number;     // Шаг 5: комиссия JCK AUTO
  };
}

export interface PriceParams {
  priceYuan: number;
  engineVolumeLiters: number;
  horsePower: number;
  carAgeYears: number;
}

/* ── Утилиты ───────────────────────────────────────────────────────── */

function getAgeCategory(years: number): AgeCategory {
  if (years < 3) return "under3";
  if (years < 5) return "3to5";
  return "over5";
}

function findBracket<T extends Record<string, number>>(
  table: T[],
  value: number,
  key: string,
): T {
  return table.find((row) => value <= row[key])!;
}

/* ── Шаг 3а: Таможенное оформление ────────────────────────────────── */

export function getCustomsFee(carValueRub: number): number {
  const row = findBracket(CUSTOMS_PROCESSING_FEE, carValueRub, "maxRub");
  return row.fee;
}

/* ── Шаг 3б: ЕТС (Единая таможенная ставка, физлицо) ──────────────── */

export function getETS(
  volumeCc: number,
  age: AgeCategory,
  eurRate: number,
  carValueEur?: number,
): number {
  if (age === "under3") {
    if (!carValueEur) throw new Error("carValueEur required for under3 ETS");
    const row = findBracket(ETS_UNDER3, carValueEur, "maxEur");
    const byPercent = carValueEur * row.pct;
    const byVolume = volumeCc * row.minPerCc;
    return Math.round(Math.max(byPercent, byVolume) * eurRate);
  }
  if (age === "3to5") {
    const row = findBracket(ETS_3TO5, volumeCc, "maxCc");
    return Math.round(volumeCc * row.rate * eurRate);
  }
  // over5
  const row = findBracket(ETS_OVER5, volumeCc, "maxCc");
  return Math.round(volumeCc * row.rate * eurRate);
}

/* ── Шаг 3в: Утилизационный сбор (физлицо) ─────────────────────────── */

export function getRecyclingFee(
  hp: number,
  volumeLiters: number,
  ageYears: number,
): number {
  const volumeCc = Math.round(volumeLiters * 1000);
  const isUnder3 = ageYears < 3;

  // Льготная ставка: ≤160 л.с. И ≤3000 см³
  const preferential = hp <= 160 && volumeCc <= 3000;
  if (preferential) {
    const coeff = isUnder3
      ? RECYCLING_INDIVIDUAL_PREFERENTIAL.under3
      : RECYCLING_INDIVIDUAL_PREFERENTIAL.over3;
    return Math.round(RECYCLING_BASE * coeff);
  }

  // Коммерческая ставка (>160 л.с. ИЛИ >3000 см³)
  const row = findBracket(RECYCLING_INDIVIDUAL_COMMERCIAL, hp, "maxHp");
  const coeff = isUnder3 ? row.under3 : row.over3;
  return Math.round(RECYCLING_BASE * coeff);
}

/* ── Основной расчёт (5 шагов) ─────────────────────────────────────── */

export function calculatePriceFromParams(
  params: PriceParams,
  rates: CBRRates,
): PriceResult {
  const { priceYuan, engineVolumeLiters, horsePower, carAgeYears } = params;

  // Шаг 1: Стоимость + логистика в Китае
  const totalYuan = priceYuan + CHINA_MARKUP_CNY;

  // Шаг 2: Перевод в рубли (банковский курс ≈ ЦБ × 1.02)
  const cnyRate = rates.CNY * CNY_BANK_MARKUP;
  const carValueRub = Math.round(totalYuan * cnyRate);

  // Шаг 3а: Таможенное оформление
  const customsFee = getCustomsFee(carValueRub);

  // Шаг 3б: ЕТС
  const volumeCc = Math.round(engineVolumeLiters * 1000);
  const age = getAgeCategory(carAgeYears);
  const eurRate = rates.EUR;
  const carValueEur = carValueRub / eurRate;
  const ets = getETS(volumeCc, age, eurRate, carValueEur);

  // Шаг 3в: Утилизационный сбор
  const recyclingFee = getRecyclingFee(horsePower, engineVolumeLiters, carAgeYears);

  // Шаг 4: Расходы в России
  const russiaExpenses = RUSSIA_EXPENSES;

  // Шаг 5: Комиссия JCK AUTO
  const commission = COMMISSION;

  const totalRub = carValueRub + customsFee + ets + recyclingFee + russiaExpenses + commission;

  return {
    totalRub,
    exchangeRate: cnyRate,
    date: rates.date,
    breakdown: {
      carPriceRub: carValueRub,
      customsFee,
      customsDuty: ets,
      recyclingFee,
      deliveryCost: russiaExpenses,
      serviceFee: commission,
    },
  };
}

/* ── Обёртка для sync-скриптов (принимает объект Car) ───────────────── */

export function calculateFullPriceWithRates(car: Car, rates: CBRRates): PriceResult {
  const carAgeYears = new Date().getFullYear() - car.year;
  const engineVolumeLiters =
    car.engineVolume < 100 ? car.engineVolume : car.engineVolume / 1000;

  return calculatePriceFromParams(
    {
      priceYuan: car.price,
      engineVolumeLiters,
      horsePower: car.power,
      carAgeYears,
    },
    rates,
  );
}

/* ── Async-обёртка (сама загружает курсы ЦБ) ──────────────────────── */

export async function calculateFullPrice(car: Car): Promise<PriceResult> {
  const rates = await fetchCBRRates();
  return calculateFullPriceWithRates(car, rates);
}
