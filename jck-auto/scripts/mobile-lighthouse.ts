/**
 * @file        mobile-lighthouse.ts
 * @purpose     Run Lighthouse mobile audit (performance / accessibility /
 *              best-practices / SEO) against any page. Saves full JSON +
 *              human-readable HTML report into screenshots/mobile/<slug>/.
 *              Prints a brief score summary and top Opportunities to stdout.
 * @usage       Standalone:
 *                npm run lighthouse:mobile -- --url=https://jckauto.ru --slug=home
 *              Combined with screenshots:
 *                npm run audit:mobile -- --url=https://jckauto.ru --slug=home
 * @dependencies lighthouse, chrome-launcher, Node 18+
 * @lastModified 2026-04-28
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

interface RunOpts {
  url: string;
  slug: string;
}

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;

function pct(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'n/a';
  return `${Math.round(score * 100)}`;
}

export async function runLighthouse({ url, slug }: RunOpts): Promise<void> {
  const outDir = path.join('screenshots', 'mobile', slug);
  fs.mkdirSync(outDir, { recursive: true });

  // Dynamic imports — lighthouse v12 is ESM-only; eager top-level import
  // fails under tsx's CJS shim because `import.meta.url` becomes undefined
  // during the wrapped module evaluation. Late-bound import preserves
  // proper ESM semantics.
  const chromeLauncher = await import('chrome-launcher');
  const lighthouse = (await import('lighthouse')).default;

  console.log(`\n[lighthouse] launching headless Chrome…`);
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });

  try {
    console.log(`[lighthouse] auditing ${url} (mobile profile, Slow 4G)…`);
    const result = await lighthouse(url, {
      port: chrome.port,
      output: ['json', 'html'],
      onlyCategories: [...CATEGORIES],
      formFactor: 'mobile',
      logLevel: 'error',
    });

    if (!result) throw new Error('lighthouse returned no result');

    const reports = Array.isArray(result.report) ? result.report : [result.report];
    const jsonPath = path.join(outDir, 'lighthouse.json');
    const htmlPath = path.join(outDir, 'lighthouse.html');
    fs.writeFileSync(jsonPath, reports[0]);
    fs.writeFileSync(htmlPath, reports[1] ?? reports[0]);

    const lhr = result.lhr;
    console.log(`\n[lighthouse] scores (mobile, Slow 4G):`);
    for (const id of CATEGORIES) {
      const cat = lhr.categories[id];
      console.log(`  ${id.padEnd(16)} ${pct(cat?.score ?? null)}`);
    }

    console.log(`\n[lighthouse] performance opportunities:`);
    let n = 0;
    for (const auditId of Object.keys(lhr.audits)) {
      const audit = lhr.audits[auditId];
      const details = audit.details as { type?: string } | undefined;
      if (
        details?.type === 'opportunity' &&
        typeof audit.numericValue === 'number' &&
        audit.numericValue > 0
      ) {
        console.log(`  - ${audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ''}`);
        n++;
      }
    }
    if (n === 0) console.log('  (none flagged)');

    console.log(`\n[lighthouse] reports:\n  ${jsonPath}\n  ${htmlPath}`);
  } finally {
    await chrome.kill();
  }
}

function parseCli(): RunOpts {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      slug: { type: 'string' },
    },
    strict: false,
  });
  if (!values.url || !values.slug) {
    process.stderr.write(
      'Usage: tsx scripts/mobile-lighthouse.ts --url=<URL> --slug=<slug>\n',
    );
    process.exit(1);
  }
  return { url: String(values.url), slug: String(values.slug) };
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  runLighthouse(parseCli()).catch((err) => {
    process.stderr.write(`[lighthouse] error: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
