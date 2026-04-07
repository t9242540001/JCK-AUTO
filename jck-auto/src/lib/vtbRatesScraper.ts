/**
 * @file vtbRatesScraper.ts
 * @description Parses VTB sell rate from sravni.ru bank pages. Pure fetch + regex, no DOM parser.
 * @runs VDS
 * @input Currency code (USD, EUR, CNY, JPY, KRW)
 * @output ScrapeResult — ok with rate, no-data, or error
 * @rule One unified flow for all currencies. NO branches by currency name.
 * @rule KRW naturally returns 'no-data' (page exists but no banks list it).
 * @rule Two failure modes — 'no-data' is silent, 'error' triggers console.warn in consumer.
 * @lastModified 2026-04-07
 */

// ─── TYPES ────────────────────────────────────────────────────────────────

export type ScrapeResult =
  | { status: 'ok'; rate: number }
  | { status: 'no-data' }
  | { status: 'error'; reason: string };

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const SRAVNI_URLS = {
  USD: 'https://www.sravni.ru/bank/vtb/valjuty/usd',
  EUR: 'https://www.sravni.ru/bank/vtb/valjuty/eur',
  CNY: 'https://www.sravni.ru/bank/vtb/valjuty/cny',
  JPY: 'https://www.sravni.ru/bank/vtb/valjuty/jpy',
  KRW: 'https://www.sravni.ru/bank/vtb/valjuty/krw',
} as const;

const FETCH_TIMEOUT = 8_000;
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

/**
 * Scrape VTB sell rate for a given currency from sravni.ru
 * @input currency — one of USD, EUR, CNY, JPY, KRW
 * @output ScrapeResult — structured result, never throws
 */
export async function scrapeVtbRate(currency: keyof typeof SRAVNI_URLS): Promise<ScrapeResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let res: Response;
    try {
      res = await fetch(SRAVNI_URLS[currency], {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      return { status: 'error', reason: `http_${res.status}` };
    }

    const html = await res.text();

    // Strategy 1: Parse __NEXT_DATA__ JSON blob (most reliable)
    const nextDataRate = parseNextData(html);
    if (nextDataRate !== null) {
      return { status: 'ok', rate: nextDataRate };
    }

    // Strategy 2: Regex on rendered HTML — look for sell rate pattern
    const htmlRate = parseHtmlRate(html);
    if (htmlRate !== null) {
      return { status: 'ok', rate: htmlRate };
    }

    // Page loaded but no rate found — legitimate 'no-data'
    return { status: 'no-data' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { status: 'error', reason };
  }
}

// ─── PARSERS ──────────────────────────────────────────────────────────────

/**
 * Try to extract VTB sell rate from __NEXT_DATA__ JSON embedded in the page.
 * Sravni.ru is a Next.js app that embeds page props in a script tag.
 */
function parseNextData(html: string): number | null {
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    // Navigate the pageProps structure to find bank rates
    const pageProps = data?.props?.pageProps;
    if (!pageProps) return null;

    // Sravni.ru typically stores rates in various nested structures.
    // Look for sell rate in common locations:
    const sellRate = findSellRate(pageProps);
    if (sellRate !== null && isReasonableRate(sellRate)) return sellRate;
  } catch {
    // JSON parse failed — fall through to next strategy
  }

  return null;
}

/**
 * Recursively search pageProps for a VTB sell rate value.
 * Looks for objects with sale/sell rate properties.
 */
function findSellRate(obj: unknown, depth = 0): number | null {
  if (depth > 8 || obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return null;

  const o = obj as Record<string, unknown>;

  // Check for direct rate properties (common sravni.ru patterns)
  for (const key of ['sale', 'sell', 'saleRate', 'sellRate', 'rateSale', 'rateSell']) {
    const val = o[key];
    if (typeof val === 'number' && isReasonableRate(val)) return val;
    if (typeof val === 'string') {
      const num = parseFloat(val);
      if (isReasonableRate(num)) return num;
    }
  }

  // Check for bankRates/rates arrays with VTB entries
  for (const key of ['bankRates', 'rates', 'banks', 'items', 'data']) {
    const arr = o[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === 'object' && item !== null) {
          const rec = item as Record<string, unknown>;
          // Check if this entry is VTB
          const name = String(rec.bankName ?? rec.name ?? rec.bank ?? '');
          if (/втб|vtb/i.test(name)) {
            for (const rk of ['sale', 'sell', 'saleRate', 'sellRate', 'rateSale']) {
              const rv = rec[rk];
              if (typeof rv === 'number' && isReasonableRate(rv)) return rv;
              if (typeof rv === 'string') {
                const num = parseFloat(rv);
                if (isReasonableRate(num)) return num;
              }
            }
          }
        }
      }
    }
  }

  // Recurse into child objects (limited depth)
  for (const val of Object.values(o)) {
    if (typeof val === 'object' && val !== null) {
      const found = findSellRate(val, depth + 1);
      if (found !== null) return found;
    }
  }

  return null;
}

/**
 * Fallback: Extract sell rate from rendered HTML using regex.
 * Looks for patterns near "Продажа" or "продаёт" with a numeric rate.
 */
function parseHtmlRate(html: string): number | null {
  // Pattern 1: "Продажа" followed by a rate like "12.45" or "0.0636"
  const sellPatterns = [
    /(?:Продажа|продаёт|Курс продажи)[^]*?(\d{1,4}[.,]\d{1,6})\s*(?:₽|руб)/gi,
    /(?:ВТБ|VTB)[^]{0,500}?(?:Продажа|продаёт|sell)[^]{0,200}?(\d{1,4}[.,]\d{1,6})/gi,
    /(?:Продажа|sell)\s*(?:<[^>]*>)*\s*(\d{1,4}[.,]\d{1,6})/gi,
  ];

  for (const re of sellPatterns) {
    re.lastIndex = 0;
    const m = re.exec(html);
    if (m?.[1]) {
      const rate = parseFloat(m[1].replace(',', '.'));
      if (isReasonableRate(rate)) return rate;
    }
  }

  return null;
}

/**
 * Sanity check: rate must be a finite positive number in a plausible range.
 * Covers everything from KRW (~0.06 RUB) to EUR (~100+ RUB).
 */
function isReasonableRate(rate: number): boolean {
  return Number.isFinite(rate) && rate > 0.001 && rate < 1_000_000;
}
