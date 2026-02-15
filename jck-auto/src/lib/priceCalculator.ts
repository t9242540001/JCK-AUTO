import type { Car } from "@/types/car";
import { type CBRRates, fetchCBRRates, COUNTRY_CURRENCY } from "./currency";
import {
  CUSTOMS_PROCESSING_FEE,
  ETS_UNDER3,
  ETS_3TO5,
  ETS_OVER5,
  RECYCLING_BASE,
  RECYCLING_INDIVIDUAL_PREFERENTIAL,
  FIXED_COSTS,
} from "./calculator-data";

function findBracket<T extends Record<string, number>>(
  table: T[],
  value: number,
  key: string,
): T {
  return table.find((row) => value <= row[key])!;
}

function calcCustomsProcessingFee(priceRub: number): number {
  const row = findBracket(CUSTOMS_PROCESSING_FEE, priceRub, "maxRub");
  return row.fee;
}

function calcETS(
  priceEur: number,
  volumeCc: number,
  age: "under3" | "3to5" | "over5",
  eurRate: number,
): number {
  if (age === "under3") {
    const row = findBracket(ETS_UNDER3, priceEur, "maxEur");
    const byPercent = priceEur * row.pct;
    const byVolume = volumeCc * row.minPerCc;
    return Math.round(Math.max(byPercent, byVolume) * eurRate);
  }
  if (age === "3to5") {
    const row = findBracket(ETS_3TO5, volumeCc, "maxCc");
    return Math.round(volumeCc * row.rate * eurRate);
  }
  const row = findBracket(ETS_OVER5, volumeCc, "maxCc");
  return Math.round(volumeCc * row.rate * eurRate);
}

function getCarAge(year: number): "under3" | "3to5" | "over5" {
  const currentYear = new Date().getFullYear();
  const diff = currentYear - year;
  if (diff < 3) return "under3";
  if (diff < 5) return "3to5";
  return "over5";
}

function calcRecyclingFee(power: number, volumeCc: number, age: "under3" | "3to5" | "over5"): number {
  const preferential = power <= 160 && volumeCc <= 3000;
  const isUnder3 = age === "under3";
  if (preferential) {
    const coeff = isUnder3
      ? RECYCLING_INDIVIDUAL_PREFERENTIAL.under3
      : RECYCLING_INDIVIDUAL_PREFERENTIAL.over3;
    return Math.round(RECYCLING_BASE * coeff);
  }
  const coeff = isUnder3
    ? RECYCLING_INDIVIDUAL_PREFERENTIAL.under3
    : RECYCLING_INDIVIDUAL_PREFERENTIAL.over3;
  return Math.round(RECYCLING_BASE * coeff);
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

export async function calculateFullPrice(car: Car): Promise<PriceResult> {
  const rates = await fetchCBRRates();
  return calculateFullPriceWithRates(car, rates);
}

export function calculateFullPriceWithRates(car: Car, rates: CBRRates): PriceResult {
  const currencyInfo = COUNTRY_CURRENCY[car.country];
  const currencyRate = rates[currencyInfo.code];
  const eurRate = rates.EUR;
  const isChina = car.country === "china";

  // Engine volume: car.engineVolume is in liters (e.g. 1.4), convert to cc
  const volumeCc = car.engineVolume < 100 ? Math.round(car.engineVolume * 1000) : car.engineVolume;

  const age = getCarAge(car.year);

  // Car price in rubles
  const effectivePriceCurrency = isChina
    ? car.price + FIXED_COSTS.china.markup_cny
    : car.price;
  const carPriceRub = Math.round(effectivePriceCurrency * currencyRate);
  const carPriceEur = carPriceRub / eurRate;

  // Customs processing fee
  const customsFee = calcCustomsProcessingFee(carPriceRub);

  // ETS (individual buyer)
  const customsDuty = calcETS(carPriceEur, volumeCc, age, eurRate);

  // Recycling fee
  const recyclingFee = calcRecyclingFee(car.power, volumeCc, age);

  // Fixed costs (delivery + services)
  let deliveryCost: number;
  let serviceFee: number;

  if (isChina) {
    deliveryCost = FIXED_COSTS.china.markup_rub;
    serviceFee = 0;
  } else {
    const costs = FIXED_COSTS[car.country as "korea" | "japan"];
    deliveryCost = costs.logistics;
    serviceFee = costs.sbkts + costs.epts + costs.broker;
  }

  const totalRub = carPriceRub + customsFee + customsDuty + recyclingFee + deliveryCost + serviceFee;

  return {
    totalRub,
    exchangeRate: currencyRate,
    date: rates.date,
    breakdown: {
      carPriceRub: Math.round(car.price * currencyRate),
      customsFee,
      customsDuty,
      recyclingFee,
      deliveryCost,
      serviceFee,
    },
  };
}
