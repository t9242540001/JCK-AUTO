/**
 * @file currencyRates.ts
 * @description Загрузка и кэширование курсов валют. Источник: VTB sell rate (sravni.ru) → fallback: CBR + markup.
 * @runs VDS
 * @rule All five currencies go through ONE unified flow. NO branches by currency name in this module.
 * @rule Returned rates ALREADY include markup. Do NOT multiply by any markup constant in consumer code.
 * @rule Two failure modes — 'no-data' is silent, 'error' triggers console.warn. KRW always returns 'no-data' because no Russian banks trade it.
 * @rule Function name `fetchCBRRates` is kept for backward compatibility — 8 consumers import it by this name.
 * @lastModified 2026-04-07
 */

import { scrapeVtbRate } from './vtbRatesScraper';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface CBRRates {
  EUR: number;
  USD: number;
  CNY: number;
  KRW: number;
  JPY: number;
  date: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const FALLBACK_RATES: CBRRates = {
  EUR: 91.25,
  USD: 88.50,
  CNY: 11.05,
  KRW: 0.0636,
  JPY: 0.582,
  date: "fallback",
};

/**
 * Per-currency markup percentages applied to CBR rate when VTB scrape returns no-data or error.
 * Read from env with sensible defaults. These approximate the typical bank sell premium.
 */
const MARKUPS = {
  USD: parseFloat(process.env.EXCHANGE_MARKUP_USD ?? '3.0'),
  EUR: parseFloat(process.env.EXCHANGE_MARKUP_EUR ?? '3.0'),
  CNY: parseFloat(process.env.EXCHANGE_MARKUP_CNY ?? '4.5'),
  JPY: parseFloat(process.env.EXCHANGE_MARKUP_JPY ?? '7.0'),
  KRW: parseFloat(process.env.EXCHANGE_MARKUP_KRW ?? '5.0'),
};

let cachedRates: CBRRates | null = null;
let cachedAt: number = 0;
const CACHE_TTL = 21_600_000; // 6 hours

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

/**
 * Fetch operational exchange rates (with bank markup included).
 * Name kept as `fetchCBRRates` for backward compatibility with 8 consumer import sites.
 * @output CBRRates with rates that already include markup — do NOT apply additional multipliers
 */
export async function fetchCBRRates(): Promise<CBRRates> {
  if (cachedRates && Date.now() - cachedAt < CACHE_TTL) {
    return cachedRates;
  }

  try {
    const res = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", {
      cache: 'no-store',
    });
    if (!res.ok) return cachedRates ?? FALLBACK_RATES;

    const data = await res.json();
    const v = data.Valute;

    const currencies = ['USD', 'EUR', 'CNY', 'JPY', 'KRW'] as const;
    const cbrBase: Record<typeof currencies[number], number> = {
      EUR: v.EUR.Value / v.EUR.Nominal,
      USD: v.USD.Value / v.USD.Nominal,
      CNY: v.CNY.Value / v.CNY.Nominal,
      KRW: v.KRW.Value / v.KRW.Nominal,
      JPY: v.JPY.Value / v.JPY.Nominal,
    };

    // Scrape VTB rates in parallel — all currencies go through the same flow
    const scraped = await Promise.all(
      currencies.map(async (c) => {
        const result = await scrapeVtbRate(c);
        if (result.status === 'ok') {
          return { code: c, rate: result.rate };
        }
        if (result.status === 'error') {
          console.warn(`[currencyRates] VTB scrape error for ${c}: ${result.reason}. Falling back to CBR + ${MARKUPS[c]}%`);
        }
        // For both 'no-data' and 'error' → fallback to CBR + markup
        const fallbackRate = cbrBase[c] * (1 + MARKUPS[c] / 100);
        return { code: c, rate: fallbackRate };
      })
    );

    const finalRates = Object.fromEntries(scraped.map(s => [s.code, s.rate])) as Record<typeof currencies[number], number>;

    cachedRates = {
      EUR: finalRates.EUR,
      USD: finalRates.USD,
      CNY: finalRates.CNY,
      KRW: finalRates.KRW,
      JPY: finalRates.JPY,
      date: data.Date ? new Date(data.Date).toLocaleDateString("ru-RU") : "—",
    };
    cachedAt = Date.now();
    return cachedRates;
  } catch {
    return cachedRates ?? FALLBACK_RATES;
  }
}

// ─── EXPORTS (unchanged interface) ────────────────────────────────────────

export type CurrencyCode = 'CNY' | 'KRW' | 'JPY' | 'EUR' | 'USD';

export const CURRENCIES: Record<CurrencyCode, { symbol: string; label: string }> = {
  CNY: { symbol: '¥', label: 'юань' },
  KRW: { symbol: '₩', label: 'вона' },
  JPY: { symbol: '¥', label: 'иена' },
  EUR: { symbol: '€', label: 'евро' },
  USD: { symbol: '$', label: 'доллар' },
};

export const COUNTRY_CURRENCY: Record<string, { code: CurrencyCode; symbol: string; label: string }> = {
  china: { code: 'CNY', symbol: '¥', label: 'юань' },
  korea: { code: 'KRW', symbol: '₩', label: 'вона' },
  japan: { code: 'JPY', symbol: '¥', label: 'иена' },
};
