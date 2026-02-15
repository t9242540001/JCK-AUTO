const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  KRW: "₩",
  JPY: "¥",
};

export function formatPrice(price: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const formatted = price.toLocaleString("ru-RU");
  return `${symbol} ${formatted}`;
}

const COUNTRY_LABELS: Record<string, string> = {
  china: "Китай",
  korea: "Южная Корея",
  japan: "Япония",
};

export function getCountryLabel(country: string): string {
  return COUNTRY_LABELS[country] || country;
}

const COUNTRY_FLAGS: Record<string, string> = {
  china: "🇨🇳",
  korea: "🇰🇷",
  japan: "🇯🇵",
};

export function getCountryFlag(country: string): string {
  return COUNTRY_FLAGS[country] || "";
}

export function generateSlug(folderName: string): string {
  return folderName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const TRANSMISSION_LABELS: Record<string, string> = {
  AT: "Автомат",
  MT: "Механика",
};

export function getTransmissionLabel(t: string): string {
  return TRANSMISSION_LABELS[t] || t;
}

export function cleanBrand(brand: string): string {
  return brand.replace(/^Used\s+/i, "").trim();
}

const COUNTRY_GENITIVE: Record<string, string> = {
  china: "Китая",
  korea: "Кореи",
  japan: "Японии",
};

export function getCountryGenitive(country: string): string {
  return COUNTRY_GENITIVE[country] || country;
}
