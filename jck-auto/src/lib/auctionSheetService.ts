/**
 * @file auctionSheetService.ts
 * @description Shared pipeline for Japanese auction-sheet AI decode.
 *              Used by both the website route (via auctionSheetQueue)
 *              and the Telegram bot (via botRateLimiter + same queue).
 *              Pass 0 (classifier) + 3 parallel OCR passes + Step 2
 *              DeepSeek parser with Qwen3.5-flash fallback.
 * @runs        VDS (Node runtime)
 * @input       compressed JPEG Buffer + RunOpts
 * @output      PipelineResult { data, meta }
 * @dependencies src/lib/dashscope (analyzeImageWithFallback, callQwenText),
 *               src/lib/deepseek (callDeepSeek),
 *               src/lib/rateLimiter (recordUsage, checkRateLimit) — used ONLY when channel='web'
 * @rule        This is the ONLY place in the codebase where auction-sheet
 *              SYSTEM_PROMPT / OCR_*_SYSTEM / CLASSIFIER_SYSTEM / PARSE_SYSTEM_PROMPT
 *              may live. Duplicating these in bot handlers or other routes is FORBIDDEN.
 * @rule        All four OCR/parser prompt strings, the classifier, and the
 *              pipeline (runAuctionSheetPipeline) are public API surface —
 *              every change must be announced in decisions.md.
 * @rule        When channel='bot': DO NOT call recordUsage or checkRateLimit
 *              from src/lib/rateLimiter — the bot has its own counter in
 *              botRateLimiter. meta.remaining MUST be null in that case.
 * @rule        Three parallel OCR passes, each with one narrow task.
 *              Do NOT merge into a single multi-task prompt — the small
 *              qwen-vl-ocr model fails on multi-objective instructions.
 *              See knowledge/decisions.md ADR on Pass-1/Pass-2/Pass-3 split.
 * @lastModified 2026-04-21
 */

import { analyzeImageWithFallback, callQwenText } from '@/lib/dashscope';
import { callDeepSeek } from '@/lib/deepseek';
import { checkRateLimit, recordUsage } from '@/lib/rateLimiter';

// ─── PROMPTS ────────────────────────────────────────────────────────────────

// RULE: Three parallel OCR passes, each with one narrow task.
// Do NOT merge into a single multi-task prompt — qwen-vl-ocr is
// a small model that fails on multi-objective instructions.
// See knowledge/decisions.md pending ADR for evidence.

export const OCR_TEXT_FIELDS_SYSTEM = `You are an OCR specialist for Japanese car auction sheets (出品票). Your task in this pass is to extract ALL header and text-field data — NOT diagrams, NOT free-text notes.

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

export const OCR_TEXT_FIELDS_USER = 'Extract all labeled header/text fields from this Japanese auction sheet. Plain text, one label: value per line. Ignore diagrams and free-text notes.';

export const OCR_DAMAGES_SYSTEM = `You are an OCR specialist for Japanese car auction sheets (出品票). Your task in this pass is to find all BODY DAMAGE CODES and map each one to a car body part.

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

export const OCR_DAMAGES_USER = 'Scan this entire Japanese auction sheet for body damage codes (A1, A2, U2, X, etc). They may be inside a drawn car, inside rectangular panel boxes, or in a code column. For each code, output "CODE: body_part" on its own line. Output "no codes" ONLY if the entire sheet truly has zero damage codes.';

export const OCR_FREE_TEXT_SYSTEM = `You are an OCR specialist for Japanese car auction sheets (出品票). Your task in this pass is to transcribe all free-text / handwritten / commentary sections verbatim, keeping the original japanese section labels as markers.

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

export const OCR_FREE_TEXT_USER = 'Transcribe all free-text, handwritten, and commentary sections from this Japanese auction sheet. Keep each section under its original Japanese label in square brackets. Skip labeled header fields and damage codes. If no free text exists, output exactly: no free text';

export const CLASSIFIER_SYSTEM = `You are classifying a Japanese car auction sheet (出品票) by how its data is recorded. Your ONLY job is to output a single classification token.

Look at the sheet and decide:

- "printed" — all labeled fields (grade, mileage, year, etc.) are machine-printed / typed / dot-matrix. Damage diagram may include hand-drawn codes, but the header table is printed. Typical: USS sheets, CAA auto-inspection sheets, most modern TAA sheets.

- "handwritten" — the majority of labeled field values (grade, interior grade, mileage, equipment notes) are filled in by hand with pen/marker on a blank form. Characters look irregular, lines vary in thickness. Typical: HAA神戸 paper sheets, some older TAA/CAA sheets.

- "mixed" — the form template is printed, some fields are printed (VIN, lot number), but key evaluation fields (overall grade, interior grade, inspector notes, mileage) are handwritten.

Output EXACTLY one of these three tokens on a single line: printed, handwritten, mixed.

Do NOT output anything else — no explanation, no confidence, no punctuation, no quotes. Just the token.`;

export const CLASSIFIER_USER = 'Classify this Japanese auction sheet. Output exactly one token: printed, handwritten, or mixed.';

export const PARSE_SYSTEM_PROMPT = `You are an expert parser of Japanese car auction sheet data.
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

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type SheetType = 'printed' | 'handwritten' | 'mixed';

/**
 * Caller channel for runAuctionSheetPipeline.
 * Controls rate-limit accounting:
 *  - 'web' → site rateLimiter: recordUsage + checkRateLimit called.
 *  - 'bot' → site rateLimiter NOT called; bot has its own counter
 *            in src/lib/botRateLimiter.ts. meta.remaining will be null.
 */
export interface RunOpts {
  channel: 'web' | 'bot';
  /** Client IP. REQUIRED when channel='web'. Ignored when channel='bot'. */
  ip?: string;
  /** Authenticated Telegram ID. Optional on web, effectively required on bot. */
  telegramId?: string;
}

export interface PipelineResult {
  data: unknown;
  meta: {
    model: string;
    tokens: number;
    /**
     * Remaining quota from the site rateLimiter.
     * null when channel='bot' — site limiter is not consulted.
     */
    remaining: number | null;
    sheetType: SheetType;
    classifierModel: string;
    classifierElapsed: number;
  };
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Parses JSON that may or may not be wrapped in markdown code fences.
 * Throws SyntaxError on invalid JSON.
 */
export function parseJsonFromContent(content: string): unknown {
  const match = content.match(/```json\s*([\s\S]*?)\s*```/);
  return JSON.parse(match?.[1] || content);
}

// ─── PASS 0: CLASSIFIER ─────────────────────────────────────────────────────

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
export async function classifySheet(
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
