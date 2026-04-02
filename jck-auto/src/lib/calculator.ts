import { type CBRRates, type CurrencyCode, COUNTRY_CURRENCY } from "./currencyRates";
import {
  CUSTOMS_PROCESSING_FEE,
  ETS_UNDER3,
  ETS_3TO5,
  ETS_OVER5,
  DUTY_UNDER3_PCT,
  DUTY_3TO7,
  DUTY_OVER7,
  EXCISE_RATES,
  VAT_RATE,
  RECYCLING_BASE,
  RECYCLING_INDIVIDUAL_PREFERENTIAL,
  RECYCLING_INDIVIDUAL_COMMERCIAL,
  RECYCLING_COMPANY,
  FIXED_COSTS,
  DELIVERY_CITY,
} from "./tariffs";

/* ── Типы ─────────────────────────────────────────────────────────── */

export type CarAge = "under3" | "3to5" | "5to7" | "over7";
export type BuyerType = "individual" | "company";

export type Country = "china" | "korea" | "japan";

export interface CalcInput {
  priceInCurrency: number;
  currencyCode: CurrencyCode;
  engineVolume: number;
  enginePower: number;
  carAge: CarAge;
  buyerType: BuyerType;
  personalUse: boolean;
  country?: Country;  // если указано → включает логистику и комиссию
}

export interface CalcResult {
  totalRub: number;
  carPriceRub: number;
  breakdown: { label: string; value: number }[];
  currencyRate: {
    code: CurrencyCode;
    rate: number;
    eurRate: number;
    date: string;
  };
  deliveryCity?: string;
}

/* ── Вспомогательные ──────────────────────────────────────────────── */

function findBracket<T extends Record<string, number>>(
  table: T[],
  value: number,
  key: string,
): T {
  return table.find((row) => value <= row[key])!;
}

/* ── 1. Сбор за таможенное оформление ─────────────────────────────── */
function calcCustomsProcessingFee(priceRub: number): number {
  const row = findBracket(CUSTOMS_PROCESSING_FEE, priceRub, "maxRub");
  return row.fee;
}

/* ── 2. ЕТС (физлица) ────────────────────────────────────────────── */
function calcETS(
  priceEur: number,
  volume: number,
  age: CarAge,
  eurRate: number,
): number {
  if (age === "under3") {
    const row = findBracket(ETS_UNDER3, priceEur, "maxEur");
    const byPercent = priceEur * row.pct;
    const byVolume = volume * row.minPerCc;
    return Math.round(Math.max(byPercent, byVolume) * eurRate);
  }

  if (age === "3to5") {
    const row = findBracket(ETS_3TO5, volume, "maxCc");
    return Math.round(volume * row.rate * eurRate);
  }

  // 5to7 и over7 → таблица "старше 5 лет" для физлиц
  const row = findBracket(ETS_OVER5, volume, "maxCc");
  return Math.round(volume * row.rate * eurRate);
}

/* ── 3. Таможенная пошлина (юрлица) ───────────────────────────────── */
function calcDuty(
  priceRub: number,
  priceEur: number,
  volume: number,
  age: CarAge,
  eurRate: number,
): number {
  if (age === "under3") {
    return Math.round(priceRub * DUTY_UNDER3_PCT);
  }

  if (age === "3to5" || age === "5to7") {
    const row = findBracket(DUTY_3TO7, volume, "maxCc");
    const byPercent = priceEur * row.pct;
    const byVolume = volume * row.minPerCc;
    return Math.round(Math.max(byPercent, byVolume) * eurRate);
  }

  // over7
  const row = findBracket(DUTY_OVER7, volume, "maxCc");
  return Math.round(volume * row.rate * eurRate);
}

/* ── 4. Акциз (юрлица) ───────────────────────────────────────────── */
function calcExcise(power: number): number {
  const row = findBracket(EXCISE_RATES, power, "maxHp");
  return Math.round(power * row.rate);
}

/* ── 5. Утилизационный сбор ───────────────────────────────────────── */
function calcRecyclingFee(
  power: number,
  volume: number,
  age: CarAge,
  buyerType: BuyerType,
  personalUse: boolean,
): number {
  const isUnder3 = age === "under3";

  if (buyerType === "company") {
    const row = findBracket(RECYCLING_COMPANY, power, "maxHp");
    const coeff = isUnder3 ? row.under3 : row.over3;
    return Math.round(RECYCLING_BASE * coeff);
  }

  // Физлицо — проверяем льготу
  const preferential = power <= 160 && volume <= 3000 && personalUse;
  if (preferential) {
    const coeff = isUnder3
      ? RECYCLING_INDIVIDUAL_PREFERENTIAL.under3
      : RECYCLING_INDIVIDUAL_PREFERENTIAL.over3;
    return Math.round(RECYCLING_BASE * coeff);
  }

  // Коммерческая ставка для физлица
  const row = findBracket(RECYCLING_INDIVIDUAL_COMMERCIAL, power, "maxHp");
  const coeff = isUnder3 ? row.under3 : row.over3;
  return Math.round(RECYCLING_BASE * coeff);
}

/* ── Главная функция расчёта ──────────────────────────────────────── */
export function calculateTotal(input: CalcInput, rates: CBRRates): CalcResult {
  const { priceInCurrency, currencyCode, engineVolume, enginePower, carAge, buyerType, personalUse, country } = input;

  const currencyRate = rates[currencyCode] as number;
  const eurRate = rates.EUR;
  const city = country ? DELIVERY_CITY[country] : undefined;

  const isChina = country === "china";

  // 1. Цена в рублях и евро
  // Китай: effectivePrice = price + markup_cny (все расходы в Китае)
  const effectivePriceCurrency = isChina
    ? priceInCurrency + FIXED_COSTS.china.markup_cny
    : priceInCurrency;
  const carPriceRub = Math.round(effectivePriceCurrency * currencyRate);
  const carPriceEur = carPriceRub / eurRate;

  // 2. Таможенное оформление
  const processingFee = calcCustomsProcessingFee(carPriceRub);

  // 3. Таможенные платежи
  const breakdown: { label: string; value: number }[] = [];

  if (isChina) {
    breakdown.push({ label: "Автомобиль", value: Math.round(priceInCurrency * currencyRate) });
    breakdown.push({ label: "Все расходы в Китае (оформление, страховка, погрузка)", value: Math.round(FIXED_COSTS.china.markup_cny * currencyRate) });
  } else {
    breakdown.push({ label: "Автомобиль", value: carPriceRub });
  }

  breakdown.push({ label: "Таможенное оформление", value: processingFee });

  let customsTotal = 0;

  if (buyerType === "individual") {
    const ets = calcETS(carPriceEur, engineVolume, carAge, eurRate);
    breakdown.push({ label: "Единая таможенная ставка", value: ets });
    customsTotal = ets;
  } else {
    const duty = calcDuty(carPriceRub, carPriceEur, engineVolume, carAge, eurRate);
    const excise = calcExcise(enginePower);
    const vat = Math.round((carPriceRub + duty + excise) * VAT_RATE);
    breakdown.push({ label: "Таможенная пошлина", value: duty });
    breakdown.push({ label: "Акциз", value: excise });
    breakdown.push({ label: "НДС 20%", value: vat });
    customsTotal = duty + excise + vat;
  }

  // 4. Утильсбор
  const recycling = calcRecyclingFee(enginePower, engineVolume, carAge, buyerType, personalUse);
  breakdown.push({ label: "Утилизационный сбор", value: recycling });

  // 5. Фиксированные расходы — только если country указана
  let fixedTotal = 0;

  if (country) {
    if (isChina) {
      const markupRub = FIXED_COSTS.china.markup_rub;
      breakdown.push({ label: `Доставка до ${city}, СБКТС, ЭПТС, брокер`, value: markupRub });
      fixedTotal = markupRub;
    } else {
      const costs = FIXED_COSTS[country];
      breakdown.push({ label: "СБКТС (сертификат безопасности)", value: costs.sbkts });
      breakdown.push({ label: "ЭПТС (электронный паспорт ТС)", value: costs.epts });
      breakdown.push({ label: "Услуги таможенного брокера", value: costs.broker });
      breakdown.push({ label: `Доставка до ${city}`, value: costs.logistics });
      fixedTotal = costs.sbkts + costs.epts + costs.broker + costs.logistics;
    }
  }

  // 6. Итого
  const totalRub =
    carPriceRub +
    processingFee +
    customsTotal +
    recycling +
    fixedTotal;

  return {
    totalRub,
    carPriceRub,
    breakdown,
    currencyRate: {
      code: currencyCode,
      rate: currencyRate,
      eurRate,
      date: rates.date,
    },
    deliveryCity: city,
  };
}

export function formatPrice(price: number): string {
  return price.toLocaleString("ru-RU") + " \u20BD";
}
