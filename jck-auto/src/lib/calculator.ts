import { type Country } from "./constants";

export interface CalcInput {
  country: Country;
  carPrice: number;
  engineVolume: number;
  enginePower: number;
  carAge: "new" | "1-3" | "3-5" | "5+";
}

export interface CalcResult {
  carPrice: number;
  customsPayments: number;
  recyclingFee: number;
  logistics: number;
  totalPrice: number;
}

function getRecyclingCoefficient(volume: number): number {
  if (volume <= 1000) return 4.06;
  if (volume <= 2000) return 15.69;
  if (volume <= 3000) return 24.01;
  if (volume <= 3500) return 62.99;
  return 114.26;
}

const LOGISTICS: Record<Country, number> = {
  china: 150000,
  korea: 200000,
  japan: 220000,
};

export function calculateTotal(input: CalcInput): CalcResult {
  const customsRate = input.carAge === "5+" ? 0.5 : 0.48;
  const customsPayments = Math.round(input.carPrice * customsRate);

  const baseRate = 3400;
  const coeff = getRecyclingCoefficient(input.engineVolume);
  const ageMultiplier = input.carAge === "new" ? 0.17 : 1;
  const recyclingFee = Math.round(baseRate * coeff * ageMultiplier);

  const logistics = LOGISTICS[input.country];

  const totalPrice = input.carPrice + customsPayments + recyclingFee + logistics;

  return {
    carPrice: input.carPrice,
    customsPayments,
    recyclingFee,
    logistics,
    totalPrice,
  };
}

export function formatPrice(price: number): string {
  return price.toLocaleString("ru-RU") + " ₽";
}
