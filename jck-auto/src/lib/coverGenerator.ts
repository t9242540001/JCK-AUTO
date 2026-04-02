/**
 * @file coverGenerator.ts
 * @description Генерация обложек: DeepSeek (метафора) → DashScope (иллюстрация) → Sharp (оверлей)
 * @input заголовок, теги, дата, тип (news/article), стиль (watercolor/realistic)
 * @output JPEG с иллюстрацией (watercolor + оверлей для новостей, realistic для статей)
 * @cost DeepSeek ~$0.0003 (промпт-метафора) + DashScope ~$0.04 (картинка)
 * @rule Стиль watercolor — для новостей (с оверлеем), realistic — для статей (без оверлея)
 * @rule Лого накладывать только в watercolor-режиме (65% opacity, blur)
 * @rule НЕ включать текст, логотипы, брендинг в промпт для генерации картинки — только в Sharp-оверлее
 * @lastModified 2026-04-02
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { callDeepSeek } from '@/lib/deepseek';
import { generateImage } from '@/lib/dashscope';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface CoverOptions {
  title: string;
  tags: string[];
  date: string;           // "2026-04-01"
  type: 'news' | 'article';
  style?: 'watercolor' | 'realistic';  // default: 'watercolor'
  outputPath: string;
}

export interface CoverResult {
  imagePath: string;
  imagePrompt: string;
  imageModel: string;     // "qwen-image-2.0-pro" | "sharp-fallback"
  cost: { promptTokens: number; completionTokens: number; estimatedUsd: number };
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 536;
const OVERLAY_HEIGHT = 80;
const LOGO_HEIGHT = 40;

const LOGO_PATH = resolve(__dirname, '../../public/images/logo-light.svg');

/** Палитра по тегам — для промпта и fallback-градиента */
const TAG_PALETTES: Record<string, { colors: string; hex: [string, string] }> = {
  'рынок_РФ':       { colors: 'navy blue and warm amber', hex: ['#1E3A5F', '#D4A84B'] },
  'законодательство': { colors: 'navy blue and warm amber', hex: ['#1E3A5F', '#D4A84B'] },
  'китайские_авто':  { colors: 'deep red and charcoal', hex: ['#DE2910', '#333333'] },
  'корейские_авто':  { colors: 'deep blue and silver', hex: ['#003478', '#C0C0C0'] },
  'японские_авто':   { colors: 'cherry red and cream', hex: ['#BC002D', '#FFFDD0'] },
  'электромобили':   { colors: 'teal and coral', hex: ['#008080', '#FF7F50'] },
  'технологии':      { colors: 'purple and silver', hex: ['#6A0DAD', '#C0C0C0'] },
  'автоспорт':       { colors: 'orange and black', hex: ['#FF6600', '#1A1A1A'] },
  'глобальный_рынок': { colors: 'navy blue and warm amber', hex: ['#1E3A5F', '#D4A84B'] },
};

const METAPHOR_SYSTEM_PROMPT_WATERCOLOR = `Ты — арт-директор. По заголовку и тегам придумай визуальную метафору для иллюстрации.
НЕ описывай конкретные марки и модели авто. Описывай СЦЕНУ или МЕТАФОРУ.
Результат — только промпт на английском, до 100 слов. Без пояснений, только промпт.`;

const METAPHOR_SYSTEM_PROMPT_REALISTIC = `Ты — арт-директор автомобильного журнала. По заголовку статьи создай промпт для генерации фотореалистичной иллюстрации в стиле tech/automotive editorial. Стиль: профессиональная автомобильная фотография, студийное освещение, технологичный фон, глубина резкости. НЕ описывай конкретные марки и модели. Описывай СЦЕНУ, стиль, освещение, композицию. Результат — только промпт на английском, до 120 слов. Без пояснений.`;

const WATERCOLOR_STYLE = 'Watercolor and ink illustration, loose wet-on-wet technique, colors bleeding at edges, visible paper texture, artistic brushstrokes, no text, no logos, no branding.';

const REALISTIC_STYLE = 'Photorealistic automotive photography, professional studio lighting, cinematic depth of field, high-end car magazine editorial style. Ultra detailed, 8K quality. No text, no logos, no watermarks, no branding.';

// ─── HELPERS ──────────────────────────────────────────────────────────────

/** Определить палитру по первому совпавшему тегу */
function getPalette(tags: string[]): { colors: string; hex: [string, string] } {
  for (const tag of tags) {
    if (TAG_PALETTES[tag]) return TAG_PALETTES[tag];
  }
  return { colors: 'navy blue and warm amber', hex: ['#1E3A5F', '#D4A84B'] };
}

/** Шаг 1: DeepSeek генерирует промпт-метафору */
async function generateMetaphorPrompt(
  title: string,
  tags: string[],
  style: 'watercolor' | 'realistic' = 'watercolor',
): Promise<{ prompt: string; usage: { promptTokens: number; completionTokens: number; estimatedUsd: number } }> {
  const palette = getPalette(tags);
  const userPrompt = `Заголовок: "${title}"\nТеги: ${tags.join(', ')}\nЦветовая палитра: ${palette.colors}\n\nПридумай визуальную метафору для этого заголовка.`;

  const systemPrompt = style === 'realistic'
    ? METAPHOR_SYSTEM_PROMPT_REALISTIC
    : METAPHOR_SYSTEM_PROMPT_WATERCOLOR;
  const styleSuffix = style === 'realistic' ? REALISTIC_STYLE : WATERCOLOR_STYLE;

  const response = await callDeepSeek(userPrompt, {
    temperature: 0.7,
    maxTokens: 256,
    systemPrompt,
  });

  const prompt = `${response.content.trim()} ${styleSuffix} Color palette: ${palette.colors}.`;
  console.log(`[Cover] Промпт-метафора (${style}): ${prompt.slice(0, 120)}...`);

  return {
    prompt,
    usage: {
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      estimatedUsd: response.usage.estimatedCostUsd,
    },
  };
}

/** Шаг 2: DashScope генерирует акварельную иллюстрацию */
async function generateArtwork(prompt: string): Promise<Buffer> {
  const result = await generateImage(prompt, {
    size: `${IMAGE_WIDTH}*${IMAGE_HEIGHT}`,
    promptExtend: false,
    n: 1,
  });

  // Скачать картинку по временному URL
  const response = await fetch(result.imageUrl);
  if (!response.ok) {
    throw new Error(`Не удалось скачать картинку: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Шаг 2 fallback: программная обложка через Sharp */
async function generateFallbackArtwork(title: string, tags: string[]): Promise<Buffer> {
  const palette = getPalette(tags);
  const [color1, color2] = palette.hex;

  // SVG с градиентом и заголовком
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Разбить заголовок на строки по ~40 символов
  const words = escapedTitle.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 40 && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current.trim()) lines.push(current.trim());

  const textLines = lines
    .slice(0, 4)
    .map((line, i) => `<text x="512" y="${230 + i * 48}" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, sans-serif" font-weight="700" font-size="36" fill="white" opacity="0.9">${line}</text>`)
    .join('\n');

  const svg = `<svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}"/>
        <stop offset="100%" stop-color="${color2}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    ${textLines}
  </svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

/** Шаг 3: Sharp накладывает брендированный оверлей */
async function applyOverlay(
  imageBuffer: Buffer,
  date: string,
  tags: string[],
): Promise<Buffer> {
  const mainTag = tags[0] ?? '';

  // Подложка внизу
  const overlaySvg = `<svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${IMAGE_HEIGHT - OVERLAY_HEIGHT}" width="${IMAGE_WIDTH}" height="${OVERLAY_HEIGHT}" fill="rgba(0,0,0,0.4)"/>
    <text x="${IMAGE_WIDTH - 20}" y="${IMAGE_HEIGHT - 30}" text-anchor="end" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="18" fill="white" opacity="0.7">${date}</text>
    ${mainTag ? `<text x="${IMAGE_WIDTH - 20}" y="35" text-anchor="end" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="14" fill="white" opacity="0.6">${mainTag}</text>` : ''}
  </svg>`;

  // Загрузить и подготовить лого
  let logoBuffer: Buffer | null = null;
  try {
    const svgData = readFileSync(LOGO_PATH);
    logoBuffer = await sharp(svgData)
      .resize({ height: LOGO_HEIGHT })
      .blur(0.5)
      .ensureAlpha()
      .toBuffer();
  } catch {
    console.warn('[Cover] Лого не найдено или не читается, пропускаем');
  }

  const composites: sharp.OverlayOptions[] = [
    { input: Buffer.from(overlaySvg), top: 0, left: 0 },
  ];

  if (logoBuffer) {
    const logoMeta = await sharp(logoBuffer).metadata();
    const logoWidth = logoMeta.width ?? 100;
    composites.push({
      input: await sharp(logoBuffer)
        .composite([{
          input: Buffer.from(
            `<svg width="${logoWidth}" height="${LOGO_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white" opacity="0.65"/></svg>`,
          ),
          blend: 'dest-in' as const,
        }])
        .toBuffer(),
      top: IMAGE_HEIGHT - OVERLAY_HEIGHT + 20,
      left: 20,
    });
  }

  return await sharp(imageBuffer)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'cover' })
    .composite(composites)
    .jpeg({ quality: 85 })
    .toBuffer();
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

/**
 * Генерация обложки: DeepSeek (метафора) → DashScope (акварель) → Sharp (оверлей)
 * @input CoverOptions — заголовок, теги, дата, тип, путь сохранения
 * @output CoverResult — путь, промпт, модель, стоимость
 * @important Fallback: DashScope → Sharp-градиент. Без OpenRouter.
 */
export async function generateCover(options: CoverOptions): Promise<CoverResult> {
  const { title, tags, date, style = 'watercolor', outputPath } = options;

  // Шаг 1: DeepSeek генерирует промпт-метафору
  const metaphor = await generateMetaphorPrompt(title, tags, style);

  // Шаг 2: DashScope генерирует акварельную иллюстрацию (с fallback)
  let imageBuffer: Buffer;
  let imageModel: string;

  try {
    imageBuffer = await generateArtwork(metaphor.prompt);
    imageModel = 'qwen-image-2.0-pro';
    console.log('[Cover] DashScope: картинка сгенерирована');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Cover] DashScope упал: ${msg}, используем Sharp-fallback`);

    try {
      imageBuffer = await generateFallbackArtwork(title, tags);
      imageModel = 'sharp-fallback';
      console.log('[Cover] Sharp-fallback: обложка сгенерирована');
    } catch (fallbackErr) {
      throw new Error(
        `Не удалось сгенерировать обложку ни через DashScope, ни через Sharp: ${fallbackErr}`,
      );
    }
  }

  // Шаг 3: финализация — watercolor с оверлеем, realistic без
  let finalBuffer: Buffer;
  if (style === 'realistic') {
    finalBuffer = await sharp(imageBuffer)
      .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } else {
    finalBuffer = await applyOverlay(imageBuffer, date, tags);
  }

  // Сохранить
  mkdirSync(dirname(outputPath), { recursive: true });
  await sharp(finalBuffer).toFile(outputPath);

  console.log(`[Cover] Сохранено: ${outputPath} | модель: ${imageModel} | cost: $${metaphor.usage.estimatedUsd}`);

  return {
    imagePath: outputPath,
    imagePrompt: metaphor.prompt,
    imageModel,
    cost: metaphor.usage,
  };
}
