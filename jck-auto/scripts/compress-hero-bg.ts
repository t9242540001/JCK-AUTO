/**
 * @file        compress-hero-bg.ts
 * @purpose     One-off pre-compression of the Hero background image. Reads
 *              public/images/hero-bg.png (~6.94 MB), produces
 *              public/images/hero-bg.jpg at width 1920, JPEG quality 85
 *              with progressive + mozjpeg encoding (target ≤ 500 KB).
 *              Result is the source for Next.js image optimizer, which
 *              then generates AVIF/WebP responsive variants on demand.
 *
 *              Kept in repo as reference for future hero-asset replacements.
 *              Re-run after replacing hero-bg.png with a new source image.
 * @usage       npx tsx scripts/compress-hero-bg.ts
 * @dependencies sharp (production dep), Node 18+
 * @lastModified 2026-04-29
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const INPUT = 'public/images/hero-bg.png';
const OUTPUT = 'public/images/hero-bg.jpg';
const TARGET_WIDTH = 1920;
const QUALITY = 85;

async function main() {
  const inputBuf = readFileSync(INPUT);
  const inputSize = statSync(INPUT).size;

  const outputBuf = await sharp(inputBuf)
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: QUALITY, progressive: true, mozjpeg: true })
    .toBuffer();

  writeFileSync(OUTPUT, outputBuf);
  const outputSize = statSync(OUTPUT).size;

  console.log(`[compress-hero-bg] ${INPUT}: ${(inputSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[compress-hero-bg] ${OUTPUT}: ${(outputSize / 1024).toFixed(0)} KB`);
  console.log(`[compress-hero-bg] reduction: ${((1 - outputSize / inputSize) * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error('[compress-hero-bg] failed:', err);
  process.exit(1);
});
