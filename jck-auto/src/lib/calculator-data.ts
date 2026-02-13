/* ── 2.1 Сбор за таможенное оформление (с 01.01.2026) ─────────────── */
export const CUSTOMS_PROCESSING_FEE: { maxRub: number; fee: number }[] = [
  { maxRub: 200_000, fee: 1_231 },
  { maxRub: 450_000, fee: 2_667 },
  { maxRub: 1_200_000, fee: 3_898 },
  { maxRub: 2_500_000, fee: 4_924 },
  { maxRub: 5_500_000, fee: 8_229 },
  { maxRub: 10_000_000, fee: 13_539 },
  { maxRub: Infinity, fee: 21_344 },
];

/* ── 2.2 ЕТС — Единая таможенная ставка (физлица) ────────────────── */

// Авто до 3 лет
export const ETS_UNDER3: { maxEur: number; pct: number; minPerCc: number }[] = [
  { maxEur: 8_500, pct: 0.54, minPerCc: 2.5 },
  { maxEur: 16_700, pct: 0.48, minPerCc: 3.5 },
  { maxEur: 42_300, pct: 0.48, minPerCc: 5.5 },
  { maxEur: 84_500, pct: 0.48, minPerCc: 7.5 },
  { maxEur: 169_000, pct: 0.48, minPerCc: 15.0 },
  { maxEur: Infinity, pct: 0.48, minPerCc: 20.0 },
];

// Авто 3–5 лет
export const ETS_3TO5: { maxCc: number; rate: number }[] = [
  { maxCc: 1000, rate: 1.5 },
  { maxCc: 1500, rate: 1.7 },
  { maxCc: 1800, rate: 2.5 },
  { maxCc: 2300, rate: 2.7 },
  { maxCc: 3000, rate: 3.0 },
  { maxCc: Infinity, rate: 3.6 },
];

// Авто старше 5 лет
export const ETS_OVER5: { maxCc: number; rate: number }[] = [
  { maxCc: 1000, rate: 3.0 },
  { maxCc: 1500, rate: 3.2 },
  { maxCc: 1800, rate: 3.5 },
  { maxCc: 2300, rate: 4.8 },
  { maxCc: 3000, rate: 5.0 },
  { maxCc: Infinity, rate: 5.7 },
];

/* ── 2.3 Таможенная пошлина (юрлица) ─────────────────────────────── */

// До 3 лет — 15% от стоимости
export const DUTY_UNDER3_PCT = 0.15;

// 3–7 лет: 20%, но не менее мин. ставки за см³
export const DUTY_3TO7: { maxCc: number; pct: number; minPerCc: number }[] = [
  { maxCc: 1000, pct: 0.20, minPerCc: 0.36 },
  { maxCc: 1500, pct: 0.20, minPerCc: 0.40 },
  { maxCc: 1800, pct: 0.20, minPerCc: 0.36 },
  { maxCc: 2300, pct: 0.20, minPerCc: 0.44 },
  { maxCc: 3000, pct: 0.20, minPerCc: 0.44 },
  { maxCc: Infinity, pct: 0.20, minPerCc: 0.80 },
];

// Старше 7 лет — фиксированная ставка
export const DUTY_OVER7: { maxCc: number; rate: number }[] = [
  { maxCc: 1000, rate: 1.4 },
  { maxCc: 1500, rate: 1.5 },
  { maxCc: 1800, rate: 1.6 },
  { maxCc: 2300, rate: 2.2 },
  { maxCc: 3000, rate: 2.2 },
  { maxCc: Infinity, rate: 3.2 },
];

/* ── 2.4 Акциз (2026, ФЗ №425-ФЗ от 28.11.2025) ─────────────────── */
export const EXCISE_RATES: { maxHp: number; rate: number }[] = [
  { maxHp: 90, rate: 0 },
  { maxHp: 150, rate: 64 },
  { maxHp: 200, rate: 613 },
  { maxHp: 300, rate: 1_004 },
  { maxHp: 400, rate: 1_711 },
  { maxHp: 500, rate: 1_771 },
  { maxHp: Infinity, rate: 1_829 },
];

/* ── 2.5 НДС — 20% ───────────────────────────────────────────────── */
export const VAT_RATE = 0.20;

/* ── 2.6 Утилизационный сбор ──────────────────────────────────────── */
export const RECYCLING_BASE = 20_000;

// Вариант А: Физлицо, льготная ставка (≤160 л.с. И ≤3000 см³ И personalUse)
export const RECYCLING_INDIVIDUAL_PREFERENTIAL = {
  under3: 0.17,  // 3 400 ₽
  over3: 0.26,   // 5 200 ₽
};

// Вариант Б: Физлицо, коммерческая ставка
export const RECYCLING_INDIVIDUAL_COMMERCIAL: { maxHp: number; under3: number; over3: number }[] = [
  { maxHp: 30, under3: 33.1, over3: 47.6 },
  { maxHp: 60, under3: 39.5, over3: 57.02 },
  { maxHp: 90, under3: 46.2, over3: 66.44 },
  { maxHp: 120, under3: 52.6, over3: 75.86 },
  { maxHp: 150, under3: 59.4, over3: 85.28 },
  { maxHp: 180, under3: 66, over3: 94.7 },
  { maxHp: 210, under3: 72.6, over3: 104.12 },
  { maxHp: 240, under3: 79.2, over3: 113.54 },
  { maxHp: 270, under3: 85.8, over3: 122.96 },
  { maxHp: 300, under3: 92.4, over3: 132.38 },
  { maxHp: 330, under3: 99, over3: 141.8 },
  { maxHp: 360, under3: 105.6, over3: 151.22 },
  { maxHp: 390, under3: 112.2, over3: 160.64 },
  { maxHp: 420, under3: 118.8, over3: 170.06 },
  { maxHp: 450, under3: 125.4, over3: 179.48 },
  { maxHp: 480, under3: 132, over3: 188.9 },
  { maxHp: 510, under3: 138.6, over3: 198.32 },
  { maxHp: Infinity, under3: 145.2, over3: 207.74 },
];

// Вариант В: Юрлицо / ИП
export const RECYCLING_COMPANY: { maxHp: number; under3: number; over3: number }[] = [
  { maxHp: 30, under3: 39.72, over3: 57.12 },
  { maxHp: 60, under3: 47.4, over3: 68.42 },
  { maxHp: 90, under3: 55.44, over3: 79.73 },
  { maxHp: 120, under3: 63.12, over3: 91.03 },
  { maxHp: 150, under3: 71.28, over3: 102.34 },
  { maxHp: 180, under3: 79.2, over3: 113.64 },
  { maxHp: 210, under3: 87.12, over3: 124.94 },
  { maxHp: 240, under3: 95.04, over3: 136.25 },
  { maxHp: 270, under3: 102.96, over3: 147.55 },
  { maxHp: 300, under3: 110.88, over3: 158.86 },
  { maxHp: 330, under3: 118.8, over3: 170.16 },
  { maxHp: 360, under3: 126.72, over3: 181.46 },
  { maxHp: 390, under3: 134.64, over3: 192.77 },
  { maxHp: 420, under3: 142.56, over3: 204.07 },
  { maxHp: 450, under3: 150.48, over3: 215.38 },
  { maxHp: 480, under3: 158.4, over3: 226.68 },
  { maxHp: 510, under3: 166.32, over3: 237.98 },
  { maxHp: Infinity, under3: 174.24, over3: 249.29 },
];

/* ── 2.7 Фиксированные расходы ────────────────────────────────────── */
export const FIXED_COSTS = {
  sbkts: 20_000,
  epts: 1_200,
  broker: 25_000,
  logistics: {
    china: 150_000,
    korea: 200_000,
    japan: 220_000,
  },
} as const;

export const DELIVERY_CITY: Record<string, string> = {
  china: "Уссурийск",
  korea: "Владивосток",
  japan: "Владивосток",
};
