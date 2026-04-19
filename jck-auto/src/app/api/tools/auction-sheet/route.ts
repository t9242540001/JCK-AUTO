/**
 * @file route.ts
 * @description POST endpoint for Japanese auction-sheet AI decode.
 *              Async-only contract: enqueues pipeline via auctionSheetQueue,
 *              returns 202 Accepted with jobId. Clients poll the result
 *              via GET /api/tools/auction-sheet/job/[jobId].
 * @runs VDS
 * @input POST multipart/form-data with image (jpg/png/webp/heic, up to 10 MB)
 * @output 202 Accepted {jobId, statusUrl, position, etaSec}.
 *         429/400/503 for rate-limited / malformed / queue-full.
 * @cost ~$0.004-0.006/request once job runs (3 OCR passes + 1 parse call).
 * @rule Rate limit: anonymous — 3 per IP lifetime; Telegram-auth — 10/day.
 * @rule Не логировать содержимое изображений.
 * @dependencies jose (jwtVerify), next/headers (cookies), JWT_SECRET,
 *               src/lib/dashscope, src/lib/deepseek, src/lib/rateLimiter,
 *               src/lib/auctionSheetQueue (queue with concurrency=1),
 *               sharp 0.34.5 (HEIC via libheif 1.20.2)
 */

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import { analyzeImageWithFallback, callQwenText } from '@/lib/dashscope';
import { callDeepSeek } from '@/lib/deepseek';
import { checkRateLimit, recordUsage } from '@/lib/rateLimiter';
import { auctionSheetQueue, QueueFullError } from '@/lib/auctionSheetQueue';

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

const OCR_DAMAGES_SYSTEM = `You are an OCR specialist for Japanese car auction sheets (出品票). Your task in this pass is to find all BODY DAMAGE CODES and map each one to a car body part.

A damage code is a short alphanumeric token placed on a car schematic on the sheet. Typical codes: A1, A2, A3, U1, U2, U3, U4, W1, W2, W3, S1, S2, X, XX, P, H, B1, B2, Y1, Y2, Y3, T, G, E, C1, C2. Numbers in square brackets like [3] are also damage indicators (usually on wheels).

The damage area on a Japanese auction sheet may look in one of these ways — all are valid and you must handle all of them:

1. DRAWN CAR: a car body drawn from above (silhouette with doors, wheels, bumpers visible). Codes are placed on or near each drawn part.

2. PANEL DIAGRAM: a schematic of numbered rectangles representing body panels (front bumper, hood, roof, doors, fenders, rear bumper, wheels) laid out in a plan view. Codes are written inside or next to each rectangle. This is common on USS sheets.

3. CODE COLUMN: damage codes listed in a dedicated column or table on the sheet, each line referencing a body part in Japanese (e.g. "右前フェンダー A1").

Scan the ENTIRE sheet for damage codes. Do not stop at the first area that "doesn't look like a diagram" — keep looking. The damage area is almost always present.

For each damage code you find, output one line in this exact format:

CODE: body_part_in_english

Body part vocabulary (use these terms for consistency):
front bumper, rear bumper, hood, roof, windshield, rear window, trunk lid, underbody,
left front door, right front door, left rear door, right rear door,
left front fender, right front fender, left rear fender, right rear fender,
left front wheel, right front wheel, left rear wheel, right rear wheel,
left side panel, right side panel, left side step, right side step.

STRICT RULES:
1. Include every code visible, even if partially legible
2. If you see a code but cannot tell which body part it maps to, output: CODE: unspecified
3. If the same code appears on multiple parts, output multiple lines, one per part
4. Numbers in square brackets like [3] count as codes — include them, usually at the nearest wheel
5. Do NOT interpret codes (no "small scratch" — just the code and the location)
6. Do NOT transcribe any text that is NOT a damage code — field labels, grades, notes belong to other passes
7. Only output "no codes" if you have scanned the entire sheet and genuinely see zero alphanumeric damage markers anywhere. This is rare — almost all auction sheets have at least a few codes. Do not use "no codes" as a safe default.
8. Output plain text only, no markdown, no json, no code fences, no commentary`;

const OCR_DAMAGES_USER = 'Scan this entire Japanese auction sheet for body damage codes (A1, A2, U2, X, etc). They may be inside a drawn car, inside rectangular panel boxes, or in a code column. For each code, output "CODE: body_part" on its own line. Output "no codes" ONLY if the entire sheet truly has zero damage codes.';

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

const CLASSIFIER_SYSTEM = `You are classifying a Japanese car auction sheet (出品票) by how its data is recorded. Your ONLY job is to output a single classification token.

Look at the sheet and decide:

- "printed" — all labeled fields (grade, mileage, year, etc.) are machine-printed / typed / dot-matrix. Damage diagram may include hand-drawn codes, but the header table is printed. Typical: USS sheets, CAA auto-inspection sheets, most modern TAA sheets.

- "handwritten" — the majority of labeled field values (grade, interior grade, mileage, equipment notes) are filled in by hand with pen/marker on a blank form. Characters look irregular, lines vary in thickness. Typical: HAA神戸 paper sheets, some older TAA/CAA sheets.

- "mixed" — the form template is printed, some fields are printed (VIN, lot number), but key evaluation fields (overall grade, interior grade, inspector notes, mileage) are handwritten.

Output EXACTLY one of these three tokens on a single line: printed, handwritten, mixed.

Do NOT output anything else — no explanation, no confidence, no punctuation, no quotes. Just the token.`;

const CLASSIFIER_USER = 'Classify this Japanese auction sheet. Output exactly one token: printed, handwritten, or mixed.';

const PARSE_SYSTEM_PROMPT = `You are an expert parser of Japanese car auction sheet data.
You receive the output of three parallel OCR passes on a Japanese auction sheet, concatenated with markers. Pass 1 (=== TEXT FIELDS ===) lists labeled header fields as "japanese_label: value" lines. Pass 2 (=== DAMAGES ===) lists body damage codes as "CODE: body_part" lines, or the literal string "no codes". Pass 3 (=== FREE TEXT ===) contains handwritten/commentary sections each prefixed with its original Japanese label in square brackets like [検査員記入欄], or the literal string "no free text". Any pass may be missing if that OCR call failed, in which case you will see "=== SECTION NAME UNAVAILABLE ===".

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
  "vin": "chassis number as printed (e.g. 'ZGE25-6006238', 'ZRT260-3010123'); keep dashes, case, digits exactly; null if the VIN cell is absent from the sheet OR characters cannot be read at all",
  "vinConfidence": "'high' when VIN is clearly printed and fully extracted, 'medium' for partial/slightly-blurred reads, 'unreadable' when the 車台番号 cell exists on the sheet but characters are smudged/covered/cropped beyond reliable extraction, null when there is no VIN cell on the sheet at all",
  "modelCode": "Japanese model classification code from 型式 (e.g. 'DBA-ZGE25G', 'DBA-ZRT260'), preserve exactly as printed, or null",
  "registrationNumber": "registration plate from 登録番号 as printed (e.g. '札幌 533 ソ 300', '京都 502 ナ 3210'), preserve Japanese characters and whitespace exactly, or null",
  "inspectionValidUntil": "shaken validity in ISO-8601 month precision 'YYYY-MM' after Japanese-calendar conversion (e.g. 'H30年3月' → '2018-03', 'R6年4月' → '2024-04'); null if not present on sheet",
  "recycleFee": "recycle fee in yen from リサイクル預託金 as a JSON integer (e.g. 10460, 11970), NOT a string; strip '円' and commas; null if not present",
  "seats": "seating capacity from 乗車定員 as a JSON integer (e.g. 5, 7), NOT a string; strip '人'; null if not present",
  "colorCode": "manufacturer color code from カラーNo. (e.g. '1F7', 'Z10', '070'), preserve case; null if not present",
  "dimensions": { "length": "JSON integer in cm or null", "width": "JSON integer in cm or null", "height": "JSON integer in cm or null" },
  "salesPoints": ["array of sales-point strings translated to Russian from [セールスポイント] block; one point per array element; [] if no block"],
  "bodyType": "body type decoded from ドア形状 to Russian: '3D' → '3-дверный', '4SD' → '4-дверный седан', '5W' → '5-дверный универсал', '5D' → '5-дверный хэтчбек', '2D' → '2-дверный купе'; for unknown codes (e.g. '4HB', '2HT') pass the original code through unchanged; null if not present",
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
7. Output ONLY valid JSON — no markdown fences, no explanation, no preamble
8. For \`vin\` and \`vinConfidence\`: the allowed combinations are exactly three — \`(vin=null, vinConfidence=null)\` when the sheet has no VIN cell, \`(vin=null, vinConfidence='unreadable')\` when the cell exists but is illegible, or \`(vin=<value>, vinConfidence='high'|'medium')\` when successfully read. Never invent a VIN from training knowledge.
9. For \`dimensions\`: each of \`length\`, \`width\`, \`height\` MUST be a JSON integer (numeric, no quotes), or null. Do NOT mix units — always centimeters. If the 諸元 section shows 459 / 169 / 160, output {"length": 459, "width": 169, "height": 160}.
10. For \`salesPoints\`: read from the \`[セールスポイント]\` section of the FREE TEXT pass. Translate each point to Russian. One point per array element — do NOT merge. Output [] if the section is missing or the pass is unavailable.
11. For \`recycleFee\`, \`seats\`, and every field of \`dimensions\`: output as JSON integers (numeric, no quotes). Strings like "10460" or "10,460 円" are invalid — emit the integer 10460.
12. For \`bodyType\`: apply the lookup table in the schema description. If the code on the sheet is not in the table, emit the original code string as-is instead of guessing a Russian translation.
13. For \`inspectionValidUntil\`: convert Japanese-calendar month to ISO-8601 month-precision using the JAPANESE_CALENDAR_CONVERSION table already in this prompt. H30年3月 → '2018-03', R6年4月 → '2024-04'. If the sheet shows only a Western-calendar date like '04年02月' with no era letter, you cannot disambiguate — emit null.`;

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

type SheetType = 'printed' | 'handwritten' | 'mixed';

/**
 * Pass 0 — classify the auction sheet by how its data is recorded.
 * Advisory-only: failure defaults to 'printed' so the current
 * pipeline continues to work.
 *
 * @rule Classifier output is advisory, NOT blocking. On any failure
 *       (timeout, unexpected output, exception) return type='printed'.
 *       Existing pipeline MUST continue to work even if classifier
 *       returns nothing useful.
 * @rule Classifier uses ONLY qwen3-vl-flash — fast and cheap.
 *       Do NOT add qwen3.5-plus to the classifier chain; the whole
 *       point of routing is to avoid paying qwen3.5-plus cost on
 *       every request.
 * @rule maxTokens=20 is intentional. If the model outputs more than
 *       one short word, the prompt is not being followed and we
 *       treat it as failure (default to 'printed').
 */
async function classifySheet(
  dataUrl: string,
): Promise<{ type: SheetType; model: string; elapsed: number }> {
  const start = Date.now();
  try {
    const result = await analyzeImageWithFallback(dataUrl, CLASSIFIER_USER, {
      models: ['qwen3-vl-flash'] as const,
      maxTokens: 20,
      temperature: 0,
      systemPrompt: CLASSIFIER_SYSTEM,
    });
    const raw = result.content.trim().toLowerCase();
    const elapsed = (Date.now() - start) / 1000;

    if (raw === 'printed' || raw === 'handwritten' || raw === 'mixed') {
      console.log(
        `[auction-sheet] Pass 0 classifier: type=${raw} model=${result.usedModel} elapsed=${elapsed.toFixed(1)}s`,
      );
      return { type: raw, model: result.usedModel, elapsed };
    }

    console.warn(
      `[auction-sheet] Pass 0 classifier returned unexpected output: "${result.content.slice(0, 50)}" — defaulting to printed (elapsed=${elapsed.toFixed(1)}s)`,
    );
    return { type: 'printed', model: result.usedModel, elapsed };
  } catch (err) {
    const elapsed = (Date.now() - start) / 1000;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[auction-sheet] Pass 0 classifier failed: ${msg.slice(0, 120)} — defaulting to printed after ${elapsed.toFixed(1)}s`,
    );
    return { type: 'printed', model: 'classifier-failed', elapsed };
  }
}

// ─── PIPELINE ─────────────────────────────────────────────────────────────

interface PipelineResult {
  data: unknown;
  meta: {
    model: string;
    tokens: number;
    remaining: number;
    sheetType: SheetType;
    classifierModel: string;
    classifierElapsed: number;
  };
}

/**
 * runPipeline — executes Pass 0 classifier + 3 parallel OCR passes + Step 2
 * parse on an already-compressed JPEG buffer. Runs inside the queue worker.
 *
 * @rule The full AI pipeline (Pass 0 classifier + three OCR passes + Step 2
 *       parse) lives ONLY inside runPipeline. The POST handler MUST NOT call
 *       DashScope or DeepSeek directly — every model call has to run under
 *       the queue's concurrency=1 lock.
 * @rule recordUsage and the second checkRateLimit call MUST happen inside
 *       runPipeline AFTER the full pipeline succeeds. A failed job (thrown
 *       error) MUST NOT consume the user's quota.
 */
async function runPipeline(
  compressedJpegBuffer: Buffer,
  ip: string,
  telegramId: string | undefined,
): Promise<PipelineResult> {
  const base64 = compressedJpegBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  // Pass 0: classify sheet type (advisory, non-blocking)
  const sheetClassification = await classifySheet(dataUrl);

  // Step 1: OCR — three parallel narrow passes.
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
      // RULE: Pass 2 uses qwen3-vl-flash primary (visual reasoning),
      // qwen-vl-ocr as fallback. qwen-vl-ocr alone returns "no codes"
      // for every sheet — it cannot visually parse damage diagrams.
      // Do NOT switch back to ocrOptionsBase.models here.
      models: ['qwen3-vl-flash', 'qwen-vl-ocr'] as const,
      systemPrompt: OCR_DAMAGES_SYSTEM,
    }),
    analyzeImageWithFallback(dataUrl, OCR_FREE_TEXT_USER, {
      ...ocrOptionsBase,
      models: [...ocrOptionsBase.models],
      systemPrompt: OCR_FREE_TEXT_SYSTEM,
    }),
  ]);

  const ocrElapsed = ((Date.now() - ocrStart) / 1000).toFixed(1);

  // Pass 1 is REQUIRED — throw on failure (maps to failed job + 'ai_error:' prefix)
  if (textFieldsRes.status !== 'fulfilled') {
    const errMsg = textFieldsRes.reason instanceof Error
      ? textFieldsRes.reason.message
      : String(textFieldsRes.reason);
    console.error(`[auction-sheet] OCR Pass 1 (text fields) failed: ${errMsg}`);
    throw new Error('ai_error: Ошибка при обработке изображения. Попробуйте позже.');
  }

  const textFieldsContent = textFieldsRes.value.content;
  console.log(`[auction-sheet] Pass 1 OCR complete: model=${textFieldsRes.value.usedModel}, chars=${textFieldsContent.length}`);

  if (textFieldsContent.length < 30) {
    throw new Error('parse_error: Не удалось распознать аукционный лист. Попробуйте другое фото.');
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

  const ocrTokens =
    (textFieldsRes.status === 'fulfilled' ? textFieldsRes.value.usage.totalTokens : 0) +
    (damagesRes.status === 'fulfilled' ? damagesRes.value.usage.totalTokens : 0) +
    (freeTextRes.status === 'fulfilled' ? freeTextRes.value.usage.totalTokens : 0);
  const ocrModelUsed = textFieldsRes.value.usedModel;

  // Step 2: Parse — structure raw text into JSON via text model.
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
    throw new Error('parse_error: Не удалось распознать аукционный лист. Попробуйте другое фото.');
  }

  // Record usage only after the full pipeline succeeds.
  recordUsage(ip, telegramId);
  const remaining = checkRateLimit(ip, telegramId).remaining;

  return {
    data: parsed,
    meta: {
      model: `${ocrModelUsed} ×3 → ${parseModel}`,
      tokens: ocrTokens + parseTokens,
      remaining,
      sheetType: sheetClassification.type,
      classifierModel: sheetClassification.model,
      classifierElapsed: sheetClassification.elapsed,
    },
  };
}

// ─── ROUTE ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const telegramId = await getTelegramIdFromCookie();

  // Rate limit (per-user quota — 3/lifetime anon, 10/day Telegram).
  const limit = checkRateLimit(ip, telegramId);
  if (!limit.allowed) {
    return NextResponse.json({
      error: 'rate_limit',
      message: limit.remaining > 0
        ? 'Подождите немного — запросы принимаются раз в 2 минуты.'
        : telegramId
          ? 'Дневной лимит запросов исчерпан (10 в день). Завтра лимит обновится.'
          : 'Лимит бесплатных расшифровок исчерпан. Войдите через Telegram для 10 запросов в день.',
      remaining: limit.remaining,
      isLifetimeLimit: limit.isLifetimeLimit ?? false,
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

  // @rule Sharp compression MUST run BEFORE enqueue, inside the POST handler.
  //       A corrupt or unreadable upload has to fail synchronously with 400,
  //       not asynchronously via a wasted queue slot.
  let compressedBuffer: Buffer;
  try {
    const bytes = await file.arrayBuffer();
    compressedBuffer = await sharp(Buffer.from(bytes))
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .sharpen({ sigma: 0.5 })
      .toBuffer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[auction-sheet] Sharp compression failed: ${msg.slice(0, 120)}`);
    return NextResponse.json(
      { error: 'invalid_image', message: 'Не удалось прочитать файл. Проверьте, что это валидное изображение.' },
      { status: 400 },
    );
  }

  // @rule POST returns 202 Accepted (NOT 200). The pipeline runs asynchronously
  //       in the queue worker; clients MUST poll GET /api/tools/auction-sheet/job/[jobId]
  //       to retrieve the final result or error.
  // @rule QueueFullError MUST map to HTTP 503 Service Unavailable + Retry-After: 300
  //       (NOT 429). 429 is reserved for per-user rate-limit exhaustion; 503
  //       signals transient server-capacity exhaustion that affects every user.
  let jobId: string;
  try {
    jobId = auctionSheetQueue.enqueue(() => runPipeline(compressedBuffer, ip, telegramId));
  } catch (err) {
    if (err instanceof QueueFullError) {
      console.warn(`[auction-sheet] Queue full — rejecting request from ip=${ip}`);
      return NextResponse.json(
        {
          error: 'queue_full',
          message: 'Сервис временно перегружен. Попробуйте через 5 минут.',
        },
        {
          status: 503,
          headers: {
            'Retry-After': '300',
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json; charset=utf-8',
          },
        },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[auction-sheet] Enqueue failed unexpectedly: ${msg}`);
    return NextResponse.json(
      { error: 'enqueue_failed', message: 'Не удалось поставить задачу в очередь. Попробуйте позже.' },
      { status: 500 },
    );
  }

  const snapshot = auctionSheetQueue.getStatus(jobId);
  const statusUrl = `/api/tools/auction-sheet/job/${jobId}`;

  return NextResponse.json(
    {
      jobId,
      statusUrl,
      position: snapshot?.position ?? 0,
      etaSec: snapshot?.etaSec ?? 0,
    },
    {
      status: 202,
      headers: {
        Location: statusUrl,
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}
