/**
 * @file vtbRatesScraper.ts
 * @description Parses VTB sell rate from sravni.ru bank pages. Pure fetch + JSON parse, no DOM parser.
 * @runs VDS
 * @input Currency code (USD, EUR, CNY, JPY, KRW)
 * @output ScrapeResult — ok with rate, no-data, or error
 * @rule One unified flow for all currencies. NO branches by currency name.
 * @rule KRW naturally returns 'no-data' (page exists but rates[] is empty after filtering).
 * @rule Two failure modes — 'no-data' is silent, 'error' triggers console.warn in consumer.
 * @rule Parse rates[] array from __NEXT_DATA__ JSON. Filter by currencyType === 'offlineInTheBranch'.
 *       Take most recent by date. NO regex fallbacks — they cause cross-currency false positives.
 * @lastModified 2026-04-07
 */

// ─── TYPES ────────────────────────────────────────────────────────────────

export type ScrapeResult =
  | { status: 'ok'; rate: number }
  | { status: 'no-data' }
  | { status: 'error'; reason: string };

interface RateRecord {
  buy: number;
  sell: number;
  currencyType: string;
  date: string;
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

    // Find the "rates" array recursively
    const ratesArray = findRatesArray(data, 0);
    if (!ratesArray || ratesArray.length === 0) return { status: 'no-data' };

    // Filter to offlineInTheBranch entries only
    const branchRates = ratesArray.filter(r => r.currencyType === 'offlineInTheBranch');
    if (branchRates.length === 0) return { status: 'no-data' };

    // Sort by date descending (most recent first)
    branchRates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Take most recent, validate sell is a finite positive number
    const latest = branchRates[0];
    if (!Number.isFinite(latest.sell) || latest.sell <= 0) return { status: 'no-data' };

    return { status: 'ok', rate: latest.sell };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { status: 'error', reason };
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

/**
 * Recursively walk an object looking for an array property named "rates"
 * whose elements match the RateRecord shape { buy, sell, currencyType, date }.
 */
function findRatesArray(obj: unknown, depth: number): RateRecord[] | null {
  if (depth > 10 || obj === null || obj === undefined || typeof obj !== 'object') return null;

  const o = obj as Record<string, unknown>;

  // Check if this object has a "rates" property that is a valid rates array
  if (Array.isArray(o.rates) && o.rates.length > 0 && isRateRecord(o.rates[0])) {
    return o.rates as RateRecord[];
  }

  // Recurse into child values
  for (const val of Object.values(o)) {
    if (typeof val === 'object' && val !== null) {
      const found = findRatesArray(val, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Check if a value looks like a RateRecord { buy: number, sell: number, currencyType: string, date: string }
 */
function isRateRecord(val: unknown): val is RateRecord {
  if (typeof val !== 'object' || val === null) return false;
  const r = val as Record<string, unknown>;
  return (
    typeof r.buy === 'number' &&
    typeof r.sell === 'number' &&
    typeof r.currencyType === 'string' &&
    typeof r.date === 'string'
  );
}
