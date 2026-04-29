/**
 * @file        mobile-screenshots.ts
 * @purpose     Capture mobile screenshots of any page on jckauto.ru at two
 *              breakpoints (360×800 Android, 375×812 iPhone-like). Produces
 *              full-page, fold (above-the-fold), and per-section screenshots
 *              into screenshots/mobile/<slug>/<width>/.
 * @usage       Standalone:
 *                npm run screenshots:mobile -- --url=https://jckauto.ru --slug=home
 *              Combined with Lighthouse audit:
 *                npm run audit:mobile -- --url=https://jckauto.ru --slug=home
 * @dependencies @playwright/test (chromium, devices), Node 18+
 * @rule        Перед первым запуском после установки зависимостей выполнить
 *              `npx playwright install chromium`. Без этого шага Playwright
 *              не сможет запустить браузер (binary не скачан).
 * @lastModified 2026-04-28
 */

import { chromium, devices, type BrowserContextOptions } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

interface ViewportConfig {
  width: number;
  label: string;
  context: BrowserContextOptions;
}

const VIEWPORTS: ViewportConfig[] = [
  {
    width: 360,
    label: '360',
    context: {
      viewport: { width: 360, height: 800 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: ANDROID_UA,
    },
  },
  {
    width: 375,
    label: '375',
    context: {
      ...devices['iPhone SE'],
      viewport: { width: 375, height: 812 },
    },
  },
];

interface RunOpts {
  url: string;
  slug: string;
}

export async function runScreenshots({ url, slug }: RunOpts): Promise<void> {
  const baseDir = path.join('screenshots', 'mobile', slug);
  fs.mkdirSync(baseDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    for (const vp of VIEWPORTS) {
      const outDir = path.join(baseDir, vp.label);
      fs.mkdirSync(outDir, { recursive: true });
      console.log(`\n[screenshots] viewport ${vp.label}…`);

      const context = await browser.newContext(vp.context);
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
        await page.waitForTimeout(800);

        await page.screenshot({
          path: path.join(outDir, 'full.png'),
          fullPage: true,
        });
        console.log(`  full.png ✓`);

        await page.screenshot({ path: path.join(outDir, 'fold.png') });
        console.log(`  fold.png ✓`);

        let sections = await page.locator('main > section, main > div > section').all();
        if (sections.length === 0) {
          sections = await page.locator('main').first().locator('> *').all();
        }
        console.log(`  found ${sections.length} top-level section(s)`);

        for (let i = 0; i < sections.length; i++) {
          const num = String(i + 1).padStart(2, '0');
          const fname = `section-${num}.png`;
          try {
            await sections[i].scrollIntoViewIfNeeded();
            await page.waitForTimeout(150);
            const box = await sections[i].boundingBox();
            if (!box || box.width <= 0 || box.height <= 0) {
              console.log(`  ${fname} skipped (no bounding box)`);
              continue;
            }
            await page.screenshot({
              path: path.join(outDir, fname),
              clip: box,
            });
            console.log(`  ${fname} ✓`);
          } catch (err) {
            console.log(`  ${fname} failed: ${(err as Error).message}`);
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n[screenshots] done → ${baseDir}`);
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
      'Usage: tsx scripts/mobile-screenshots.ts --url=<URL> --slug=<slug>\n',
    );
    process.exit(1);
  }
  return { url: String(values.url), slug: String(values.slug) };
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  runScreenshots(parseCli()).catch((err) => {
    process.stderr.write(`[screenshots] error: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
