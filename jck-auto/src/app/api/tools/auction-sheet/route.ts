/**
 * @file route.ts
 * @description API endpoint для AI-расшифровки японских аукционных листов. Two-pass pipeline: OCR (qwen-vl-ocr) → structured parse (qwen3.5-flash).
 *              Supports two-mode rate limiting: anonymous (3 lifetime) / Telegram-auth (10/day).
 * @runs VDS
 * @input POST multipart/form-data с изображением (jpg/png/webp/heic, до 10 МБ)
 * @output JSON с распознанными данными аукционного листа
 * @cost ~$0.002-0.004/запрос (Step 1: OCR + Step 2: qwen3.5-flash or DeepSeek fallback)
 * @rule Rate limit: anonymous — 3 запроса lifetime с одного IP; auth — 10/day по telegram_id
 * @rule Не логировать содержимое изображений
 * @dependencies jose (jwtVerify), next/headers (cookies), JWT_SECRET env var,
 *              src/lib/dashscope (analyzeImageWithFallback, callQwenText), src/lib/deepseek (callDeepSeek), src/lib/rateLimiter,
 *              sharp 0.34.5 (compression; HEIC supported via libheif 1.20.2)
 * @lastModified 2026-04-15
 */

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import { analyzeImageWithFallback, callQwenText } from '@/lib/dashscope';
import { callDeepSeek } from '@/lib/deepseek';
import { checkRateLimit, recordUsage } from '@/lib/rateLimiter';

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 МБ
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// RULE: Two-pass pipeline prompts. Step 1 = OCR (vision model reads text).
// Step 2 = Parse (text model structures into JSON). Do NOT merge into single prompt.

const OCR_SYSTEM_PROMPT = `You are an OCR specialist for Japanese car auction sheets (出品票).
Read ALL text visible on the image exactly as printed or handwritten. Do not skip any field, number, code, or annotation.

For the body damage diagram (車体図 / inspection diagram):
- List each damage code with its exact location on the vehicle body
- Format each as: "CODE on LOCATION" (e.g. "X3 on right front fender", "A1 on left rear door", "U4 on rear panel")
- Include every code visible on the diagram, even partially legible ones

For the inspector notes section (検査員記入欄):
- Transcribe every line exactly as written in original language

Output ALL recognized text as plain text. Do NOT interpret, translate, summarize, or restructure. Do NOT output JSON.`;

const OCR_USER_PROMPT = 'Read all text from this Japanese auction sheet image. Include every visible field, number, damage code with its body location, and inspector notes. Plain text output only, no JSON.';

const PARSE_SYSTEM_PROMPT = `You are an expert parser of Japanese car auction sheet data.
You receive raw OCR text extracted from a Japanese auction sheet. Parse it into the JSON schema below.

GRADING SYSTEM:
- Overall: S > 6 > 5 > 4.5 > 4 > 3.5 > 3 > 2 > 1 > R (rebuilt) > A (accident) > *** (unrateable)
- Interior: A (excellent) > B (good) > C (fair) > D (poor)

DEFECT CODES AND SEVERITY:
minor: A1 (small scratch), U1/E1 (small dent), W1 (minor touch-up), S1 (rust traces), C1 (minor corrosion), B1 (small dent+scratch), Y1 (small crack), P (paint differs), H (faded paint), G (windshield stone chip)
moderate: A2 (scratch), U2 (dent), W2 (repainted), S2 (significant rust), C2 (corrosion), B2 (dent+scratch), Y2 (crack)
major: A3 (large scratch), U3 (large dent), W3 (major repair), X (part replaced), XX (replaced non-original), Y3 (large crack), T (needs replacement)

EQUIPMENT CODES (decode to Russian):
AC=кондиционер, AAC=климат-контроль, PS=гидроусилитель, PW=электростеклоподъёмники, AW=литые диски, SR=люк, ABS, AB=подушки безопасности, TV, NAVI=навигация, CD, MD, ETC=система электронной оплаты, HID/LED=ксенон/LED фары, RS=задний спойлер, 4WD=полный привод

JAPANESE CALENDAR CONVERSION:
R (Reiwa 令和): R1=2019, R2=2020, R3=2021, R4=2022, R5=2023, R6=2024, R7=2025
H (Heisei 平成): H20=2008, H21=2009, H22=2010, H23=2011, H24=2012, H25=2013, H26=2014, H27=2015, H28=2016, H29=2017, H30=2018, H31=2019

JSON SCHEMA — output ONLY this object, nothing else:
{
  "auctionName": "auction house name in English (USS, TAA, HAA, JU, CAA...) or null",
  "lotNumber": "lot number as string or null",
  "overallGrade": "grade (S/6/5/4.5/4/3.5/3/2/1/R/A/***) or null",
  "interiorGrade": "interior grade (A/B/C/D) or null",
  "make": "brand in English (Toyota, Honda, Nissan, Mazda, Subaru...) or null",
  "model": "model in English (Wish, Allion, Crown, Fit, Impreza...) or null",
  "year": "Western calendar year as string (e.g. '2015') or null",
  "engineVolume": "displacement in cc as string (e.g. '1800') or null",
  "engineType": "бензин or дизель or гибрид or электро or null",
  "transmission": "AT or MT or CVT or null",
  "mileage": "mileage in km as string (e.g. '199559') or null",
  "mileageWarning": false,
  "color": "color in Russian or null",
  "ownership": "ownership type in Russian (личное использование, корпоративное...) or null",
  "bodyDamages": [{"location": "body part in Russian", "code": "defect code", "description": "defect description in Russian", "severity": "minor|moderate|major"}],
  "equipment": ["each decoded option in Russian (e.g. 'климат-контроль', 'навигация', 'ABS')"],
  "expertComments": "inspector notes translated to Russian or null",
  "unrecognized": ["OCR text items that could not be mapped to any field"],
  "confidence": "high or medium or low",
  "recommendation": "brief purchase recommendation in Russian based on grade, mileage, and damage",
  "warnings": ["any concerns in Russian (high mileage for age, many repairs, replaced parts...)"]
}

STRICT RULES:
1. Brands and models ALWAYS in English (Toyota, not トヨタ, not Тойота)
2. Descriptions, equipment labels, comments, recommendations, warnings — in Russian
3. If a field is NOT present in the OCR text — set null. NEVER invent or guess
4. If mileage seems too high for vehicle age — set mileageWarning: true and add warning
5. confidence: "high" if >80% fields recognized, "medium" if 50-80%, "low" if <50%
6. Convert Japanese calendar years to Western calendar using the table above
7. Output ONLY valid JSON — no markdown fences, no explanation, no preamble`;

// ─── HELPERS ──────────────────────────────────────────────────────────────

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function parseJsonFromContent(content: string): unknown {
  const match = content.match(/```json\s*([\s\S]*?)\s*```/);
  return JSON.parse(match?.[1] || content);
}

/**
 * Extract telegramId from tg_auth JWT cookie.
 * Returns telegramId as string if cookie is valid and not expired.
 * Returns undefined on any error (missing cookie, invalid JWT, missing env var) —
 * caller falls back to anonymous mode silently.
 * @rule Never throw — all errors must be caught internally
 */
async function getTelegramIdFromCookie(): Promise<string | undefined> {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return undefined;

    const cookieStore = await cookies();
    const token = cookieStore.get('tg_auth')?.value;
    if (!token) return undefined;

    const secretBytes = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secretBytes);
    const id = payload.telegramId;
    if (!id) return undefined;

    return String(id);
  } catch {
    return undefined;
  }
}

// ─── ROUTE ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const telegramId = await getTelegramIdFromCookie();

  // Rate limit
  const limit = checkRateLimit(ip, telegramId);
  if (!limit.allowed) {
    return NextResponse.json({
      error: 'rate_limit',
      message: limit.remaining > 0
        ? 'Подождите немного — запросы принимаются раз в 2 минуты.'
        : telegramId
          ? 'Дневной лимит запросов исчерпан (10 в день). Завтра лимит обновится.'
          : 'Лимит бесплатных расшифровок исчерпан. Войдите через Telegram для 10 запросов в день.',
      resetIn: limit.resetIn,
      alternatives: {
        telegram: 'https://t.me/jckauto_help_bot',
        manager: 'https://t.me/jck_auto_manager',
      },
    }, { status: 429 });
  }

  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Ожидается multipart/form-data' },
      { status: 400 },
    );
  }

  const file = formData.get('image') as File | null;

  // Validation
  if (!file) {
    return NextResponse.json(
      { error: 'no_file', message: 'Загрузите фото аукционного листа' },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'file_too_large', message: 'Файл слишком большой (максимум 10 МБ)' },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'invalid_type', message: 'Поддерживаемые форматы: JPG, PNG, WebP, HEIC' },
      { status: 400 },
    );
  }

  // Compress before base64 — reduces DashScope response time from 60+s to ~15s
  const bytes = await file.arrayBuffer();
  const compressed = await sharp(Buffer.from(bytes))
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .sharpen({ sigma: 0.5 })
    .toBuffer();
  const base64 = compressed.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  // RULE: Two-pass pipeline. Step 1 = OCR (vision). Step 2 = Parse (text).
  // Do NOT merge back into single pass. See knowledge/decisions.md pending ADR.
  try {
    // ── Step 1: OCR — extract raw text from auction sheet image ──
    const ocrResult = await analyzeImageWithFallback(dataUrl, OCR_USER_PROMPT, {
      models: ['qwen-vl-ocr', 'qwen3-vl-flash'],
      maxTokens: 8192,
      temperature: 0.1,
      systemPrompt: OCR_SYSTEM_PROMPT,
    });

    const rawText = ocrResult.content;
    console.log(`[auction-sheet] Step 1 OCR complete: model=${ocrResult.usedModel}, chars=${rawText.length}, tokens=${ocrResult.usage.totalTokens}`);

    // Sanity check: if OCR returned very little text, image is likely not an auction sheet
    if (rawText.length < 50) {
      return NextResponse.json(
        { error: 'parse_error', message: 'Не удалось распознать аукционный лист. Попробуйте другое фото.' },
        { status: 502 },
      );
    }

    // ── Step 2: Parse — structure raw text into JSON via text model ──
    // RULE: Primary = qwen3.5-flash (fast, no thinking phase), fallback = DeepSeek.
    // Do NOT use qwen3.5-plus here — its hybrid thinking exceeds 25s timeout.
    const parseUserPrompt = `Parse the following raw OCR text from a Japanese car auction sheet into the JSON schema specified in your system instructions.\n\n--- OCR TEXT START ---\n${rawText}\n--- OCR TEXT END ---`;

    let parseContent: string;
    let parseModel: string;
    let parseTokens: number;

    try {
      const qwenResult = await callQwenText(parseUserPrompt, {
        model: 'qwen3.5-flash',
        maxTokens: 4096,
        temperature: 0.1,
        systemPrompt: PARSE_SYSTEM_PROMPT,
      });
      parseContent = qwenResult.content;
      parseModel = 'qwen3.5-flash';
      parseTokens = qwenResult.usage.totalTokens;
      console.log(`[auction-sheet] Step 2 parse complete: model=${parseModel}, tokens=${parseTokens}`);
    } catch (step2Err) {
      const errMsg = step2Err instanceof Error ? step2Err.message : String(step2Err);
      console.warn(`[auction-sheet] Step 2 qwen3.5-flash failed: ${errMsg.slice(0, 120)}, trying DeepSeek fallback...`);

      const dsResult = await callDeepSeek(parseUserPrompt, {
        maxTokens: 4096,
        temperature: 0.1,
        systemPrompt: PARSE_SYSTEM_PROMPT,
      });
      parseContent = dsResult.content;
      parseModel = 'deepseek-chat';
      parseTokens = dsResult.usage.totalTokens;
      console.log(`[auction-sheet] Step 2 parse complete (fallback): model=${parseModel}, tokens=${parseTokens}`);
    }

    let parsed: unknown;
    try {
      parsed = parseJsonFromContent(parseContent);
    } catch {
      console.error('[auction-sheet] JSON parse failed after Step 2. Content length:', parseContent.length);
      return NextResponse.json(
        { error: 'parse_error', message: 'Не удалось распознать аукционный лист. Попробуйте другое фото.' },
        { status: 502 },
      );
    }

    // Record usage only after both steps succeed
    recordUsage(ip, telegramId);

    const remaining = checkRateLimit(ip, telegramId).remaining;

    return NextResponse.json({
      success: true,
      data: parsed,
      meta: {
        model: `${ocrResult.usedModel} → ${parseModel}`,
        tokens: ocrResult.usage.totalTokens + parseTokens,
        remaining,
      },
    });
  } catch (err) {
    console.error('[auction-sheet] AI error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'ai_error', message: 'Ошибка при обработке изображения. Попробуйте позже.' },
      { status: 502 },
    );
  }
}
