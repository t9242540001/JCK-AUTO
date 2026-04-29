/**
 * @file        mobile-audit.ts
 * @purpose     Orchestrator. Runs mobile screenshots (two breakpoints) and
 *              Lighthouse mobile audit sequentially in one Node process.
 *              A failure in one step does NOT abort the other — both are
 *              attempted, errors are reported at the end.
 * @usage       npm run audit:mobile -- --url=https://jckauto.ru --slug=home
 * @dependencies @playwright/test, lighthouse, chrome-launcher (via the two
 *              child scripts).
 * @lastModified 2026-04-28
 */

import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { runScreenshots } from './mobile-screenshots';
import { runLighthouse } from './mobile-lighthouse';

interface RunOpts {
  url: string;
  slug: string;
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
      'Usage: tsx scripts/mobile-audit.ts --url=<URL> --slug=<slug>\n',
    );
    process.exit(1);
  }
  return { url: String(values.url), slug: String(values.slug) };
}

async function main(): Promise<void> {
  const opts = parseCli();
  const outDir = path.join('screenshots', 'mobile', opts.slug);
  const errors: string[] = [];

  console.log(`=== mobile audit: ${opts.url} → ${outDir} ===`);

  try {
    await runScreenshots(opts);
  } catch (err) {
    const msg = `[screenshots] failed: ${(err as Error).message}`;
    console.error(msg);
    errors.push(msg);
  }

  try {
    await runLighthouse(opts);
  } catch (err) {
    const msg = `[lighthouse] failed: ${(err as Error).message}`;
    console.error(msg);
    errors.push(msg);
  }

  console.log(`\n=== audit complete → ${outDir} ===`);
  if (errors.length > 0) {
    console.log(`\nErrors during audit:`);
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`[audit] fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
