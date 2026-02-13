export interface CBRRates {
  EUR: number;
  CNY: number;
  KRW: number;
  JPY: number;
  date: string;
}

const FALLBACK_RATES: CBRRates = {
  EUR: 91.25,
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
      CNY: v.CNY.Value / v.CNY.Nominal,
      KRW: v.KRW.Value / v.KRW.Nominal,
      JPY: v.JPY.Value / v.JPY.Nominal,
      date: data.Date ? new Date(data.Date).toLocaleDateString("ru-RU") : "—",
    };
  } catch {
    return FALLBACK_RATES;
  }
}

export type CurrencyCode = "CNY" | "KRW" | "JPY";

export const COUNTRY_CURRENCY: Record<string, { code: CurrencyCode; symbol: string; label: string }> = {
  china: { code: "CNY", symbol: "¥", label: "юань" },
  korea: { code: "KRW", symbol: "₩", label: "вона" },
  japan: { code: "JPY", symbol: "¥", label: "иена" },
};
