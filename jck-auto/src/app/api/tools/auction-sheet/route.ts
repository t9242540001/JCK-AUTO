/**
 * @file route.ts
 * @description API endpoint для AI-расшифровки японских аукционных листов. Multi-pass OCR (three parallel qwen-vl-ocr passes: text fields / damage codes / free text) → structured parse (DeepSeek primary, qwen3.5-flash fallback).
 *              Supports two-mode rate limiting: anonymous (3 lifetime) / Telegram-auth (10/day).
 * @runs VDS
 * @input POST multipart/form-data с изображением (jpg/png/webp/heic, до 10 МБ)
 * @output JSON с распознанными данными аукционного листа
 * @cost ~$0.004-0.006/запрос (3 OCR passes параллельно + 1 parse call)
 * @rule Rate limit: anonymous — 3 запроса lifetime с одного IP; auth — 10/day по telegram_id
 * @rule Не логировать содержимое изображений
 * @dependencies jose (jwtVerify), next/headers (cookies), JWT_SECRET env var,
 *              src/lib/dashscope (analyzeImageWithFallback, callQwenText), src/lib/deepseek (callDeepSeek), src/lib/rateLimiter,
 *              sharp 0.34.5 (compression; HEIC supported via libheif 1.20.2)
 * @lastModified 2026-04-16
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

// RULE: Three parallel OCR passes, each with one narrow task.
// Do NOT merge into a single multi-task prompt — qwen-vl-ocr is
// a small model that fails on multi-objective instructions.
// See knowledge/decisions.md pending ADR for evidence.

const OCR_TEXT_FIELDS_SYSTEM = `You are an OCR specialist for Japanese car auction sheets (出品票). Your task in this pass is to extract ALL header and text-field data — NOT diagrams, NOT free-text notes.

Read every labeled field you see on the sheet. For each field, output one line in this exact format:

japanese_label: value

Include (if visible on this specific sheet): 出品番号, 初度登録, 車名, ドア形状, グレード, 評価点, 車歴, 排気量, 燃料, 型式, シフト, エアコン, 外装色, カラーNo., 内装色, 乗車定員, 最大積載量, 輸入車, リサイクル預託金, 走行, 車検, 登録番号, 名義変更期限, 車台番号, 諸元, 外装, 内装.

Also include the auction house name and lot number if visible anywhere on the sheet.

STRICT RULES:
1. Keep the japanese label exactly as written, do NOT translate
2. Keep the value exactly as printed — preserve numbers, units, Japanese characters, half-width/full-width as is
3. One label-value pair per line, separated by ": "
4. If a field you expected is not visible — skip it, do NOT invent
5. Ignore the body damage diagram — it is covered by another pass
6. Ignore handwritten inspector notes and free-text comments — they are covered by another pass
7. Output plain text only, no markdown, no json, no code fences, no commentary`;

const OCR_TEXT_FIELDS_USER = 'Extract all labeled header/text fields from this Japanese auction sheet. Plain text, one label: value per line. Ignore diagrams and free-text notes.';

const OCR_DAMAGES_SYSTEM = `You are an OCR specialist for Japanese car auction sheets (出品票). Your task in this pass is to find the body damage diagram and extract the codes from it.

Somewhere on this sheet there is usually a diagram of the car body viewed from above or in panels. Each damage code is a letter+digit combination such as A1, A2, A3, U1, U2, U3, W1, W2, W3, S1, S2, X, XX, P, H, B1, B2, Y1, Y2, Y3, T, G, E, C1, C2. These codes are placed on or next to specific body parts on the diagram.

Find EVERY damage code on the diagram, wherever it is positioned. For each code, determine the body part it is placed on or pointing to, and output one line in this exact format:

CODE: body_part_in_english

Body part examples: front bumper, rear bumper, hood, roof, windshield, rear window, left front door, right front door, left rear door, right rear door, left front fender, right front fender, left rear fender, right rear fender, left front wheel, right front wheel, left rear wheel, right rear wheel, trunk lid, right side panel, left side panel, underbody.

STRICT RULES:
1. Include every code visible, even if partially legible — if unclear, write "unclear" instead of guessing body part
2. If the same code appears multiple times on different parts, output multiple lines
3. Do NOT skip codes that are written in brackets like [3] — those indicate wheels and belong to the nearest wheel location
4. If there is no diagram on this sheet, or you cannot find any damage codes, output exactly: no diagram
5. Do NOT transcribe any text that is not a damage code on the diagram
6. Do NOT interpret the codes (no "small scratch" — just the code and the location)
7. Output plain text only, no markdown, no json, no code fences, no commentary`;

const OCR_DAMAGES_USER = 'Find the body damage diagram on this Japanese auction sheet. For every damage code on the diagram, output "CODE: body_part" on its own line. If no diagram exists, output exactly: no diagram';

const OCR_FREE_TEXT_SYSTEM = `You are an OCR specialist for Japanese car auction sheets (出品票). Your task in this pass is to transcribe all free-text / handwritten / commentary sections verbatim, keeping the original japanese section labels as markers.

Focus on these sections (transcribe only the ones that exist on this specific sheet):
- 検査員記入欄 (inspector's notes — usually a list of handwritten Japanese lines)
- セールスポイント (sales points — short positive notes)
- 注意事項欄 (cautions / things to watch out for)
- 事務局よりご案内 (office bureau announcement / instructions)
- 後日発送部品 (parts shipped later)
- 新規 / 取扱書 (registration / manual notes)
- any other handwritten or freeform area that is not a labeled header field and not the damage diagram

For each section you find, output it in this exact format:

[JAPANESE_SECTION_LABEL]
line 1 verbatim
line 2 verbatim
...

Use the original Japanese section label in square brackets as the marker, so that the next stage knows which section each block came from.

STRICT RULES:
1. Transcribe exactly as written — do NOT translate, paraphrase, reorder, or summarize
2. Preserve original Japanese characters, punctuation, handwriting quirks
3. One line per line on the sheet
4. If a section is not visible on this sheet, just skip it — do NOT write "(not present)"
5. Do NOT include labeled header fields (出品番号, 車名, 走行, etc.) — those are covered by another pass
6. Do NOT include damage codes from the diagram — they are covered by another pass
7. If the entire sheet has no free-text content, output exactly: no free text
8. Output plain text only, no markdown, no json, no code fences, no commentary`;

const OCR_FREE_TEXT_USER = 'Transcribe all free-text, handwritten, and commentary sections from this Japanese auction sheet. Keep each section under its original Japanese label in square brackets. Skip labeled header fields and damage codes. If no free text exists, output exactly: no free text';

const PARSE_SYSTEM_PROMPT = `You are an expert parser of Japanese car auction sheet data.
You receive the output of three parallel OCR passes on a Japanese auction sheet, concatenated with markers. Pass 1 (=== TEXT FIELDS ===) lists labeled header fields as "japanese_label: value" lines. Pass 2 (=== DAMAGES ===) lists body damage codes as "CODE: body_part" lines, or the literal string "no diagram". Pass 3 (=== FREE TEXT ===) contains handwritten/commentary sections each prefixed with its original Japanese label in square brackets like [検査員記入欄], or the literal string "no free text". Any pass may be missing if that OCR call failed, in which case you will see "=== SECTION NAME UNAVAILABLE ===".

Parse all available sections into the JSON schema below. If a whole section is unavailable, set the corresponding JSON fields to null and do not invent values. Inspector Notes from Pass 3 map to expertComments. Body damage codes from Pass 2 map to bodyDamages (use the body_part_in_english as a hint, translate to Russian for the location field).

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
    // ── Step 1: OCR — three parallel narrow passes ──
    // Pass 1 = text fields (REQUIRED), Pass 2 = damages (soft-fail),
    // Pass 3 = free text (soft-fail).
    const ocrStart = Date.now();
    const ocrOptionsBase = {
      models: ['qwen-vl-ocr', 'qwen3-vl-flash'] as const,
      maxTokens: 8192,
      temperature: 0.1,
    };

    const [textFieldsRes, damagesRes, freeTextRes] = await Promise.allSettled([
      analyzeImageWithFallback(dataUrl, OCR_TEXT_FIELDS_USER, {
        ...ocrOptionsBase,
        models: [...ocrOptionsBase.models],
        systemPrompt: OCR_TEXT_FIELDS_SYSTEM,
      }),
      analyzeImageWithFallback(dataUrl, OCR_DAMAGES_USER, {
        ...ocrOptionsBase,
        models: [...ocrOptionsBase.models],
        systemPrompt: OCR_DAMAGES_SYSTEM,
      }),
      analyzeImageWithFallback(dataUrl, OCR_FREE_TEXT_USER, {
        ...ocrOptionsBase,
        models: [...ocrOptionsBase.models],
        systemPrompt: OCR_FREE_TEXT_SYSTEM,
      }),
    ]);

    const ocrElapsed = ((Date.now() - ocrStart) / 1000).toFixed(1);

    // Pass 1 is REQUIRED
    if (textFieldsRes.status !== 'fulfilled') {
      const errMsg = textFieldsRes.reason instanceof Error
        ? textFieldsRes.reason.message
        : String(textFieldsRes.reason);
      console.error(`[auction-sheet] OCR Pass 1 (text fields) failed: ${errMsg}`);
      return NextResponse.json(
        { error: 'ai_error', message: 'Ошибка при обработке изображения. Попробуйте позже.' },
        { status: 502 },
      );
    }

    const textFieldsContent = textFieldsRes.value.content;
    console.log(`[auction-sheet] Pass 1 OCR complete: model=${textFieldsRes.value.usedModel}, chars=${textFieldsContent.length}`);

    // Sanity check on Pass 1
    if (textFieldsContent.length < 30) {
      return NextResponse.json(
        { error: 'parse_error', message: 'Не удалось распознать аукционный лист. Попробуйте другое фото.' },
        { status: 502 },
      );
    }

    // Pass 2 is soft-fail
    let damagesContent: string;
    if (damagesRes.status === 'fulfilled') {
      damagesContent = damagesRes.value.content;
      console.log(`[auction-sheet] Pass 2 OCR complete: model=${damagesRes.value.usedModel}, chars=${damagesContent.length}`);
    } else {
      const errMsg = damagesRes.reason instanceof Error ? damagesRes.reason.message : String(damagesRes.reason);
      console.warn(`[auction-sheet] Pass 2 OCR (damages) failed (soft): ${errMsg.slice(0, 120)}`);
      damagesContent = '';
    }

    // Pass 3 is soft-fail
    let freeTextContent: string;
    if (freeTextRes.status === 'fulfilled') {
      freeTextContent = freeTextRes.value.content;
      console.log(`[auction-sheet] Pass 3 OCR complete: model=${freeTextRes.value.usedModel}, chars=${freeTextContent.length}`);
    } else {
      const errMsg = freeTextRes.reason instanceof Error ? freeTextRes.reason.message : String(freeTextRes.reason);
      console.warn(`[auction-sheet] Pass 3 OCR (free text) failed (soft): ${errMsg.slice(0, 120)}`);
      freeTextContent = '';
    }

    console.log(`[auction-sheet] OCR total elapsed: ${ocrElapsed}s`);

    // Compose combined OCR text for Step 2
    const textFieldsSection = `=== TEXT FIELDS ===\n${textFieldsContent}`;
    const damagesSection = damagesContent
      ? `=== DAMAGES ===\n${damagesContent}`
      : `=== DAMAGES UNAVAILABLE ===`;
    const freeTextSection = freeTextContent
      ? `=== FREE TEXT ===\n${freeTextContent}`
      : `=== FREE TEXT UNAVAILABLE ===`;

    const rawText = `${textFieldsSection}\n\n${damagesSection}\n\n${freeTextSection}`;

    // Compute token totals across fulfilled passes only
    const ocrTokens =
      (textFieldsRes.status === 'fulfilled' ? textFieldsRes.value.usage.totalTokens : 0) +
      (damagesRes.status === 'fulfilled' ? damagesRes.value.usage.totalTokens : 0) +
      (freeTextRes.status === 'fulfilled' ? freeTextRes.value.usage.totalTokens : 0);
    const ocrModelUsed = textFieldsRes.value.usedModel;

    // ── Step 2: Parse — structure raw text into JSON via text model ──
    // RULE: Primary = DeepSeek (fast, reliable from VDS), fallback = qwen3.5-flash.
    // Do NOT use qwen3.5-plus here — its hybrid thinking exceeds 25s timeout.
    const parseUserPrompt = `Parse the following three-pass OCR output from a Japanese car auction sheet into the JSON schema specified in your system instructions.\n\n${rawText}`;

    let parseContent: string;
    let parseModel: string;
    let parseTokens: number;

    try {
      // RULE: DeepSeek is primary for Step 2 — DashScope text models
      // (qwen3.5-flash/plus) timeout from VDS. Do NOT swap back without
      // verifying DashScope text API availability first.
      const dsResult = await callDeepSeek(parseUserPrompt, {
        maxTokens: 4096,
        temperature: 0.1,
        systemPrompt: PARSE_SYSTEM_PROMPT,
      });
      parseContent = dsResult.content;
      parseModel = 'deepseek-chat';
      parseTokens = dsResult.usage.totalTokens;
      console.log(`[auction-sheet] Step 2 parse complete: model=${parseModel}, tokens=${parseTokens}`);
    } catch (step2Err) {
      const errMsg = step2Err instanceof Error ? step2Err.message : String(step2Err);
      console.warn(`[auction-sheet] Step 2 DeepSeek failed: ${errMsg.slice(0, 120)}, trying qwen3.5-flash fallback...`);

      const qwenResult = await callQwenText(parseUserPrompt, {
        model: 'qwen3.5-flash',
        maxTokens: 4096,
        temperature: 0.1,
        systemPrompt: PARSE_SYSTEM_PROMPT,
      });
      parseContent = qwenResult.content;
      parseModel = 'qwen3.5-flash';
      parseTokens = qwenResult.usage.totalTokens;
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
        model: `${ocrModelUsed} ×3 → ${parseModel}`,
        tokens: ocrTokens + parseTokens,
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
