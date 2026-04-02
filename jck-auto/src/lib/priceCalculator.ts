/**
 * @file priceCalculator.ts
 * @description Обёртка для обратной совместимости. Делегирует расчёт в calculator.ts.
 *              Используется sync-скриптами и ботом — НЕ удалять.
 * @rule Внешний контракт (экспортируемые функции и типы) менять НЕЛЬЗЯ — от них зависят sync-скрипты и бот
 * @lastModified 2026-04-02
 */

import { calculateTotal, type CalcResult } from './calculator';
import { type CBRRates, fetchCBRRates } from './currencyRates';
import type { Car } from '@/types/car';

// ─── ТИПЫ (сохраняем для обратной совместимости) ─────────────────

export interface PriceParams {
  priceYuan: number;
  engineVolumeLiters: number;
  horsePower: number;
  carAgeYears: number;
}

export interface PriceResult {
  totalRub: number;
  exchangeRate: number;
  date: string;
  breakdown: {
    carPriceRub: number;
    customsFee: number;
    customsDuty: number;
    recyclingFee: number;
    deliveryCost: number;
    serviceFee: number;
  };
}

// ─── УТИЛИТЫ ─────────────────────────────────────────────────────

function ageYearsToCategory(years: number) {
  if (years < 3) return 'under3' as const;
  if (years <= 5) return '3to5' as const;
  // @important: 5 лет включительно → 3to5, только >5 → 5to7
  if (years <= 7) return '5to7' as const;
  return 'over7' as const;
}

function mapResult(r: CalcResult, rates: CBRRates): PriceResult {
  const find = (label: string) => r.breakdown.find(b => b.label === label)?.value ?? 0;

  return {
    totalRub: r.totalRub,
    exchangeRate: rates.CNY * 1.02,
    date: r.currencyRate.date,
    breakdown: {
      carPriceRub: r.carPriceRub,
      customsFee: find('Таможенное оформление'),
      customsDuty: find('Единая таможенная ставка'),
      recyclingFee: find('Утилизационный сбор'),
      deliveryCost: r.breakdown
        .filter(b =>
          b.label.includes('Доставка') ||
          b.label.includes('СБКТС') ||
          b.label.includes('ЭПТС') ||
          b.label.includes('брокер') ||
          b.label.includes('расходы в Китае')
        )
        .reduce((sum, b) => sum + b.value, 0),
      serviceFee: 0,
    },
  };
}

// ─── ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (реэкспорт для обратной совместимости) ──

export function getCustomsFee(carValueRub: number): number {
  // Inline — не стоит тянуть из calculator.ts т.к. там приватная функция
  const { CUSTOMS_PROCESSING_FEE } = require('./tariffs');
  const row = CUSTOMS_PROCESSING_FEE.find((r: { maxRub: number; fee: number }) => carValueRub <= r.maxRub)!;
  return row.fee;
}

export function getETS(
  volumeCc: number,
  age: 'under3' | '3to5' | 'over5',
  eurRate: number,
  carValueEur?: number,
): number {
  const { ETS_UNDER3, ETS_3TO5, ETS_OVER5 } = require('./tariffs');
  const findBracket = <T extends Record<string, number>>(table: T[], value: number, key: string): T =>
    table.find((row: T) => value <= row[key])!;

  if (age === 'under3') {
    if (!carValueEur) throw new Error('carValueEur required for under3 ETS');
    const row = findBracket(ETS_UNDER3, carValueEur, 'maxEur');
    return Math.round(Math.max(carValueEur * row.pct, volumeCc * row.minPerCc) * eurRate);
  }
  if (age === '3to5') {
    const row = findBracket(ETS_3TO5, volumeCc, 'maxCc');
    return Math.round(volumeCc * row.rate * eurRate);
  }
  const row = findBracket(ETS_OVER5, volumeCc, 'maxCc');
  return Math.round(volumeCc * row.rate * eurRate);
}

export function getRecyclingFee(hp: number, volumeLiters: number, ageYears: number): number {
  const { RECYCLING_BASE, RECYCLING_INDIVIDUAL_PREFERENTIAL, RECYCLING_INDIVIDUAL_COMMERCIAL } = require('./tariffs');
  const volumeCc = Math.round(volumeLiters * 1000);
  const isUnder3 = ageYears < 3;
  const preferential = hp <= 160 && volumeCc <= 3000;

  if (preferential) {
    const coeff = isUnder3 ? RECYCLING_INDIVIDUAL_PREFERENTIAL.under3 : RECYCLING_INDIVIDUAL_PREFERENTIAL.over3;
    return Math.round(RECYCLING_BASE * coeff);
  }

  const findBracket = <T extends Record<string, number>>(table: T[], value: number, key: string): T =>
    table.find((row: T) => value <= row[key])!;
  const row = findBracket(RECYCLING_INDIVIDUAL_COMMERCIAL, hp, 'maxHp');
  const coeff = isUnder3 ? row.under3 : row.over3;
  return Math.round(RECYCLING_BASE * coeff);
}

// ─── ЭКСПОРТИРУЕМЫЕ ФУНКЦИИ (контракт не меняется) ────────────────

export function calculatePriceFromParams(params: PriceParams, rates: CBRRates): PriceResult {
  const volumeCc = Math.round(params.engineVolumeLiters * 1000);
  const result = calculateTotal({
    priceInCurrency: params.priceYuan,
    currencyCode: 'CNY',
    engineVolume: volumeCc,
    enginePower: params.horsePower,
    carAge: ageYearsToCategory(params.carAgeYears),
    buyerType: 'individual',
    personalUse: true,
    country: 'china',
  }, rates);

  return mapResult(result, rates);
}

export function calculateFullPriceWithRates(car: Car, rates: CBRRates): PriceResult {
  const carAgeYears = new Date().getFullYear() - car.year;
  const engineVolumeLiters =
    car.engineVolume < 100 ? car.engineVolume : car.engineVolume / 1000;
  return calculatePriceFromParams({
    priceYuan: car.price,
    engineVolumeLiters,
    horsePower: car.power,
    carAgeYears,
  }, rates);
}

export async function calculateFullPrice(car: Car): Promise<PriceResult> {
  const rates = await fetchCBRRates();
  return calculateFullPriceWithRates(car, rates);
}
