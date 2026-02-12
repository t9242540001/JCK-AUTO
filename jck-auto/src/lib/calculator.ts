import type { Country } from "./constants";

export type AgeCategory = "new" | "1-3" | "3-5" | "5+";

export interface CalculatorInput {
  country: Country;
  price: number;
  engineVolume: number;
  power: number;
  age: AgeCategory;
}

export interface CalculatorResult {
  carPrice: number;
  customs: number;
  recyclingFee: number;
  logistics: number;
  totalPrice: number;
}

/**
 * Approximate customs duty based on age and engine volume.
 * Simplified model for estimation purposes.
 */
function calculateCustoms(price: number, engineVolume: number, age: AgeCategory): number {
  if (age === "new") {
    // ~48% of price for new cars, but at least engine-based minimum
    const percentBased = price * 0.48;
    const volumeBased = engineVolume <= 1000
      ? engineVolume * 3.5
      : engineVolume <= 1500
        ? engineVolume * 4.8
        : engineVolume <= 1800
          ? engineVolume * 5.5
          : engineVolume <= 2300
            ? engineVolume * 7.5
            : engineVolume <= 3000
              ? engineVolume * 15
              : engineVolume * 20;
    return Math.max(percentBased, volumeBased);
  }

  if (age === "1-3") {
    if (engineVolume <= 1000) return engineVolume * 1.5;
    if (engineVolume <= 1500) return engineVolume * 1.7;
    if (engineVolume <= 1800) return engineVolume * 2.5;
    if (engineVolume <= 2300) return engineVolume * 2.7;
    if (engineVolume <= 3000) return engineVolume * 3.0;
    return engineVolume * 3.6;
  }

  // 3-5 and 5+
  if (engineVolume <= 1000) return engineVolume * 3.0;
  if (engineVolume <= 1500) return engineVolume * 3.2;
  if (engineVolume <= 1800) return engineVolume * 3.5;
  if (engineVolume <= 2300) return engineVolume * 4.8;
  if (engineVolume <= 3000) return engineVolume * 5.0;
  return engineVolume * 5.7;
}

/**
 * Recycling fee depends on age and engine volume.
 */
function calculateRecyclingFee(engineVolume: number, age: AgeCategory): number {
  const baseRate = 20000;

  if (age === "new" || age === "1-3") {
    if (engineVolume <= 1000) return baseRate * 0.17;
    if (engineVolume <= 2000) return baseRate * 0.17;
    if (engineVolume <= 3000) return baseRate * 4.2;
    return baseRate * 6.3;
  }

  // Older cars
  if (engineVolume <= 1000) return baseRate * 0.26;
  if (engineVolume <= 2000) return baseRate * 0.26;
  if (engineVolume <= 3000) return baseRate * 6.3;
  return baseRate * 9.08;
}

/**
 * Logistics and paperwork costs vary by country.
 */
function calculateLogistics(country: Country): number {
  switch (country) {
    case "china":
      return 250000;
    case "korea":
      return 220000;
    case "japan":
      return 200000;
    default:
      return 250000;
  }
}

export function calculate(input: CalculatorInput): CalculatorResult {
  const customs = calculateCustoms(input.price, input.engineVolume, input.age);
  const recyclingFee = calculateRecyclingFee(input.engineVolume, input.age);
  const logistics = calculateLogistics(input.country);

  return {
    carPrice: input.price,
    customs: Math.round(customs),
    recyclingFee: Math.round(recyclingFee),
    logistics,
    totalPrice: Math.round(input.price + customs + recyclingFee + logistics),
  };
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}
