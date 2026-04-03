import { type CBRRates, type CurrencyCode, COUNTRY_CURRENCY } from "./currencyRates";
import {
  CUSTOMS_PROCESSING_FEE,
  ETS_UNDER3,
  ETS_3TO5,
  ETS_OVER5,
  DUTY_PETROL_UNDER3,
  DUTY_PETROL_3TO7,
  DUTY_PETROL_OVER7,
  DUTY_DIESEL_UNDER3_PCT,
  DUTY_DIESEL_3TO7,
  DUTY_DIESEL_OVER7,
  ELECTRIC_DUTY_RATE,
  ELECTRIC_PREFERENTIAL_MAX_HP,
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
export type EngineType = "petrol" | "diesel" | "hybrid" | "electric";

export interface CalcInput {
  priceInCurrency: number;
  currencyCode: CurrencyCode;
  engineVolume: number;
  enginePower: number;
  carAge: CarAge;
  buyerType: BuyerType;
  personalUse: boolean;
  country?: Country;
  engineType?: EngineType; // default = 'petrol'
}

export interface CalcResult {
  totalRub: number;
  carPriceRub: number;
  breakdown: { label: string; value: number; details?: string }[];
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

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

/* ── 1. Сбор за таможенное оформление ─────────────────────────────── */
function calcCustomsProcessingFee(priceRub: number): number {
  const row = findBracket(CUSTOMS_PROCESSING_FEE, priceRub, "maxRub");
  return row.fee;
}

/* ── 2. ЕТС (физлица, только ДВС) ──────────────────────────────── */
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

/* ── 3. Пошлина (юрлица + электро-физлица) ───────────────────────── */
function calcDuty(
  priceRub: number,
  priceEur: number,
  volume: number,
  age: CarAge,
  eurRate: number,
  engineType: EngineType,
): number {
  // Электро: 15% любой возраст
  if (engineType === "electric") {
    return Math.round(priceRub * ELECTRIC_DUTY_RATE);
  }

  const isDiesel = engineType === "diesel";

  if (age === "under3") {
    if (isDiesel) {
      return Math.round(priceRub * DUTY_DIESEL_UNDER3_PCT);
    }
    // Бензин/гибрид — зависит от объёма
    const row = findBracket(DUTY_PETROL_UNDER3, volume, "maxCc");
    return Math.round(priceRub * row.pct);
  }

  if (age === "3to5" || age === "5to7") {
    const table = isDiesel ? DUTY_DIESEL_3TO7 : DUTY_PETROL_3TO7;
    const row = findBracket(table, volume, "maxCc");
    const byPercent = priceEur * row.pct;
    const byVolume = volume * row.minPerCc;
    return Math.round(Math.max(byPercent, byVolume) * eurRate);
  }

  // over7
  const table = isDiesel ? DUTY_DIESEL_OVER7 : DUTY_PETROL_OVER7;
  const row = findBracket(table, volume, "maxCc");
  return Math.round(volume * row.rate * eurRate);
}

/* ── 4. Акциз ───────────────────────────────────────────────────── */
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
  isElectric: boolean,
): number {
  const isUnder3 = age === "under3";

  if (buyerType === "company") {
    const row = findBracket(RECYCLING_COMPANY, power, "maxHp");
    const coeff = isUnder3 ? row.under3 : row.over3;
    return Math.round(RECYCLING_BASE * coeff);
  }

  // Физлицо — проверяем льготу
  const hpLimit = isElectric ? ELECTRIC_PREFERENTIAL_MAX_HP : 160;
  const preferential = power <= hpLimit && (isElectric || volume <= 3000) && personalUse;
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
  const engineType = input.engineType ?? "petrol";
  const isElectric = engineType === "electric";

  const currencyRate = rates[currencyCode] as number;
  const eurRate = rates.EUR;
  const city = country ? DELIVERY_CITY[country] : undefined;

  const isChina = country === "china";

  // 1. Цена в рублях и евро
  const effectivePriceCurrency = isChina
    ? priceInCurrency + FIXED_COSTS.china.markup_cny
    : priceInCurrency;
  const carPriceRub = Math.round(effectivePriceCurrency * currencyRate);
  const carPriceEur = carPriceRub / eurRate;

  // 2. Таможенное оформление
  const processingFee = calcCustomsProcessingFee(carPriceRub);
  const processingRow = findBracket(CUSTOMS_PROCESSING_FEE, carPriceRub, "maxRub");
  const processingDetails = `при стоимости авто до ${fmt(processingRow.maxRub === Infinity ? 999_999_999 : processingRow.maxRub)} ₽`;

  // 3. Таможенные платежи
  const breakdown: { label: string; value: number; details?: string }[] = [];

  if (isChina) {
    breakdown.push({ label: "Автомобиль", value: Math.round(priceInCurrency * currencyRate) });
    breakdown.push({ label: "Все расходы в Китае (оформление, страховка, погрузка)", value: Math.round(FIXED_COSTS.china.markup_cny * currencyRate) });
  } else {
    breakdown.push({ label: "Автомобиль", value: carPriceRub });
  }

  breakdown.push({ label: "Таможенное оформление", value: processingFee, details: processingDetails });

  let customsTotal = 0;

  if (isElectric) {
    // Электро: и физлицо и юрлицо → пошлина 15% + акциз + НДС 20%
    const duty = calcDuty(carPriceRub, carPriceEur, engineVolume, carAge, eurRate, engineType);
    const dutyDetails = `${(ELECTRIC_DUTY_RATE * 100).toFixed(0)}% от стоимости (электромобиль)`;

    const excise = calcExcise(enginePower);
    const exciseRow = findBracket(EXCISE_RATES, enginePower, "maxHp");
    const exciseDetails = exciseRow.rate === 0
      ? `без акциза (до 90 л.с.)`
      : `${fmt(exciseRow.rate)} ₽/л.с. × ${fmt(enginePower)} л.с.`;

    const vat = Math.round((carPriceRub + duty + excise) * VAT_RATE);
    const vatDetails = `20% × (стоимость + пошлина + акциз)`;

    breakdown.push({ label: "Таможенная пошлина", value: duty, details: dutyDetails });
    breakdown.push({ label: "Акциз", value: excise, details: exciseDetails });
    breakdown.push({ label: "НДС 20%", value: vat, details: vatDetails });
    customsTotal = duty + excise + vat;
  } else if (buyerType === "individual") {
    // ДВС физлицо → ЕТС
    const ets = calcETS(carPriceEur, engineVolume, carAge, eurRate);
    let etsDetails: string;
    if (carAge === "under3") {
      const row = findBracket(ETS_UNDER3, carPriceEur, "maxEur");
      etsDetails = `max(${(row.pct * 100).toFixed(0)}% × ${fmt(Math.round(carPriceEur))} €; ${row.minPerCc} €/см³ × ${fmt(engineVolume)} см³) × ${fmt(eurRate, 2)} ₽/€`;
    } else if (carAge === "3to5") {
      const row = findBracket(ETS_3TO5, engineVolume, "maxCc");
      etsDetails = `${row.rate} €/см³ × ${fmt(engineVolume)} см³ × ${fmt(eurRate, 2)} ₽/€`;
    } else {
      const row = findBracket(ETS_OVER5, engineVolume, "maxCc");
      etsDetails = `${row.rate} €/см³ × ${fmt(engineVolume)} см³ × ${fmt(eurRate, 2)} ₽/€`;
    }
    breakdown.push({ label: "Единая таможенная ставка", value: ets, details: etsDetails });
    customsTotal = ets;
  } else {
    // ДВС юрлицо → пошлина + акциз + НДС
    const duty = calcDuty(carPriceRub, carPriceEur, engineVolume, carAge, eurRate, engineType);
    let dutyDetails: string;
    const isDiesel = engineType === "diesel";

    if (carAge === "under3") {
      if (isDiesel) {
        dutyDetails = `${(DUTY_DIESEL_UNDER3_PCT * 100).toFixed(0)}% от стоимости (дизель)`;
      } else {
        const row = findBracket(DUTY_PETROL_UNDER3, engineVolume, "maxCc");
        dutyDetails = `${(row.pct * 100).toFixed(1)}% от стоимости (бензин, ${engineVolume <= 2800 ? '≤2800' : '>2800'} см³)`;
      }
    } else if (carAge === "3to5" || carAge === "5to7") {
      const table = isDiesel ? DUTY_DIESEL_3TO7 : DUTY_PETROL_3TO7;
      const row = findBracket(table, engineVolume, "maxCc");
      dutyDetails = `max(${(row.pct * 100).toFixed(0)}% × ${fmt(Math.round(carPriceEur))} €; ${row.minPerCc} €/см³ × ${fmt(engineVolume)} см³) × ${fmt(eurRate, 2)} ₽/€`;
    } else {
      const table = isDiesel ? DUTY_DIESEL_OVER7 : DUTY_PETROL_OVER7;
      const row = findBracket(table, engineVolume, "maxCc");
      dutyDetails = `${row.rate} €/см³ × ${fmt(engineVolume)} см³ × ${fmt(eurRate, 2)} ₽/€`;
    }

    const excise = calcExcise(enginePower);
    const exciseRow = findBracket(EXCISE_RATES, enginePower, "maxHp");
    const exciseDetails = exciseRow.rate === 0
      ? `без акциза (до 90 л.с.)`
      : `${fmt(exciseRow.rate)} ₽/л.с. × ${fmt(enginePower)} л.с.`;

    const vat = Math.round((carPriceRub + duty + excise) * VAT_RATE);
    const vatDetails = `20% × (стоимость + пошлина + акциз)`;

    breakdown.push({ label: "Таможенная пошлина", value: duty, details: dutyDetails });
    breakdown.push({ label: "Акциз", value: excise, details: exciseDetails });
    breakdown.push({ label: "НДС 20%", value: vat, details: vatDetails });
    customsTotal = duty + excise + vat;
  }

  // 4. Утильсбор
  const recycling = calcRecyclingFee(enginePower, engineVolume, carAge, buyerType, personalUse, isElectric);
  const isUnder3 = carAge === "under3";
  const ageLabel = isUnder3 ? "до 3 лет" : "3+ лет";
  let recyclingDetails: string;
  if (buyerType === "company") {
    const row = findBracket(RECYCLING_COMPANY, enginePower, "maxHp");
    const coeff = isUnder3 ? row.under3 : row.over3;
    recyclingDetails = `${fmt(RECYCLING_BASE)} ₽ × ${coeff} (юрлицо, ${ageLabel})`;
  } else {
    const hpLimit = isElectric ? ELECTRIC_PREFERENTIAL_MAX_HP : 160;
    const preferential = enginePower <= hpLimit && (isElectric || engineVolume <= 3000) && personalUse;
    if (preferential) {
      const coeff = isUnder3 ? RECYCLING_INDIVIDUAL_PREFERENTIAL.under3 : RECYCLING_INDIVIDUAL_PREFERENTIAL.over3;
      recyclingDetails = `${fmt(RECYCLING_BASE)} ₽ × ${coeff} (льготный: ≤${hpLimit} л.с., ${ageLabel})`;
    } else {
      const row = findBracket(RECYCLING_INDIVIDUAL_COMMERCIAL, enginePower, "maxHp");
      const coeff = isUnder3 ? row.under3 : row.over3;
      recyclingDetails = `${fmt(RECYCLING_BASE)} ₽ × ${coeff} (коммерч., ${ageLabel})`;
    }
  }
  breakdown.push({ label: "Утилизационный сбор", value: recycling, details: recyclingDetails });

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
