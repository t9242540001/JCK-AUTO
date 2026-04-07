/**
 * @file vtbRatesScraper.ts
 * @description Parses VTB sell rate from sravni.ru bank pages. Pure fetch + JSON parse, no DOM parser.
 * @runs VDS
 * @input Currency code (USD, EUR, CNY, JPY, KRW)
 * @output ScrapeResult — ok with rate, no-data, or error
 * @rule One unified flow for all currencies. NO branches by currency name.
 * @rule KRW naturally returns 'no-data' (page exists but rates[] is empty after filtering).
 * @rule Two failure modes — 'no-data' is silent, 'error' triggers console.warn in consumer.
 * @rule Parse all rates[] arrays from __NEXT_DATA__ JSON. Each entry has shape { buy, sell, branchId, currency, updateDate }.
 *       Filter by entry.currency === target. Take most recent by updateDate. NO regex fallbacks.
 * @rule Multiple rates[] arrays exist per page (one per branch) — collect ALL, not just the first.
 * @lastModified 2026-04-07
 */

// ─── TYPES ────────────────────────────────────────────────────────────────

export type ScrapeResult =
  | { status: 'ok'; rate: number }
  | { status: 'no-data' }
  | { status: 'error'; reason: string };

interface RateEntry {
  buy: number;
  sell: number;
  currency: string;
  updateDate: string;
}

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

    // Extract __NEXT_DATA__ JSON blob
    const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return { status: 'no-data' };

    let data: unknown;
    try {
      data = JSON.parse(scriptMatch[1]);
    } catch {
      return { status: 'no-data' };
    }

    // Collect all entries from all rates[] arrays across the page (one per branch)
    const allEntries: RateEntry[] = [];
    collectRatesEntries(data, 0, allEntries);

    // Filter to entries matching the target currency
    const matched = allEntries.filter(e => e.currency === currency);
    if (matched.length === 0) return { status: 'no-data' };

    // Sort by updateDate descending (most recent first); unparseable dates go to the end
    matched.sort((a, b) => {
      const ta = new Date(a.updateDate).getTime();
      const tb = new Date(b.updateDate).getTime();
      if (isNaN(ta) && isNaN(tb)) return 0;
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return tb - ta;
    });

    // Take most recent, validate sell is a finite positive number
    const latest = matched[0];
    if (!Number.isFinite(latest.sell) || latest.sell <= 0) return { status: 'no-data' };

    return { status: 'ok', rate: latest.sell };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { status: 'error', reason };
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

/**
 * Recursively walk the parsed JSON, collecting entries from every array named "rates"
 * whose elements match the RateEntry shape { buy, sell, currency, updateDate }.
 * Traverses both objects and arrays to handle nested structures.
 */
function collectRatesEntries(obj: unknown, depth: number, out: RateEntry[]): void {
  if (depth > 10 || obj === null || obj === undefined || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    // Traverse array elements
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        collectRatesEntries(item, depth + 1, out);
      }
    }
    return;
  }

  const o = obj as Record<string, unknown>;

  // If this object has a "rates" property that is an array of RateEntry, collect its entries
  if (Array.isArray(o.rates) && o.rates.length > 0 && isRateEntry(o.rates[0])) {
    for (const entry of o.rates) {
      if (isRateEntry(entry)) {
        out.push(entry);
      }
    }
  }

  // Recurse into all child values
  for (const val of Object.values(o)) {
    if (typeof val === 'object' && val !== null) {
      collectRatesEntries(val, depth + 1, out);
    }
  }
}

/**
 * Check if a value matches the RateEntry shape: { buy: number, sell: number, currency: string, updateDate: string }
 */
function isRateEntry(val: unknown): val is RateEntry {
  if (typeof val !== 'object' || val === null) return false;
  const r = val as Record<string, unknown>;
  return (
    typeof r.buy === 'number' &&
    typeof r.sell === 'number' &&
    typeof r.currency === 'string' &&
    typeof r.updateDate === 'string'
  );
}
