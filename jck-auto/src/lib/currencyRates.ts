/**
 * @file currencyRates.ts
 * @description Загрузка и кэширование курсов ЦБ РФ.
 * @rule Fallback-курсы — аварийные, не для production-расчётов. Если API ЦБР недоступен — показать предупреждение пользователю.
 * @lastModified 2026-04-02
 */

export interface CBRRates {
  EUR: number;
  USD: number;
  CNY: number;
  KRW: number;
  JPY: number;
  date: string;
}

const FALLBACK_RATES: CBRRates = {
  EUR: 91.25,
  USD: 88.50,
  CNY: 11.05,
  KRW: 0.0636,
  JPY: 0.582,
  date: "fallback",
};

export async function fetchCBRRates(): Promise<CBRRates> {
  try {
    const res = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return FALLBACK_RATES;

    const data = await res.json();
    const v = data.Valute;

    return {
      EUR: v.EUR.Value / v.EUR.Nominal,
      USD: v.USD.Value / v.USD.Nominal,
      CNY: v.CNY.Value / v.CNY.Nominal,
      KRW: v.KRW.Value / v.KRW.Nominal,
      JPY: v.JPY.Value / v.JPY.Nominal,
      date: data.Date ? new Date(data.Date).toLocaleDateString("ru-RU") : "—",
    };
  } catch {
    return FALLBACK_RATES;
  }
}

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
