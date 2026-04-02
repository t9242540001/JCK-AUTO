/**
 * @file route.ts
 * @description API endpoint для AI-расшифровки японских аукционных листов через Qwen-VL.
 * @runs VDS
 * @input POST multipart/form-data с изображением (jpg/png/webp/heic, до 10 МБ)
 * @output JSON с распознанными данными аукционного листа
 * @cost ~$0.002/запрос (Qwen3.5-Plus Vision)
 * @rule Rate limit: 3 запроса/день с одного IP (общий лимит с Encar)
 * @rule Не логировать содержимое изображений
 * @lastModified 2026-04-02
 */

import { NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/dashscope';
import { checkRateLimit, recordUsage } from '@/lib/rateLimiter';

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 МБ
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const SYSTEM_PROMPT = `Ты — эксперт по расшифровке японских аукционных листов. Анализируй загруженное изображение и извлеки все данные.

СИСТЕМА ОЦЕНОК:
- Общая оценка: S > 6 > 5 > 4.5 > 4 > 3.5 > 3 > 2 > 1 > R (восстановленный) > A (аварийный) > *** (не подлежит оценке)
- Оценка салона: A (отлично) > B (хорошо) > C (удовлетворительно) > D (плохо)
- Аукционы: USS, TAA, HAA, JU, CAA, AUCNET, JAA и др.

КОДЫ ДЕФЕКТОВ:
- A1 (мелкая царапина), A2 (царапина), A3 (большая царапина)
- E/U1 (маленькая вмятина), U2 (вмятина), U3 (большая вмятина)
- W1 (мелкий ремонт/подкрас), W2 (ремонт с покраской), W3 (значительный ремонт)
- S1 (следы ржавчины), S2 (значительная ржавчина)
- X (деталь заменена), XX (деталь заменена на неоригинальную)
- P (краска отличается от оригинала), H (краска потускнела)
- C1 (мелкая коррозия), C2 (коррозия)
- B1 (маленькая вмятина с царапиной), B2 (вмятина с царапиной)
- Y1 (мелкая трещина), Y2 (трещина), Y3 (большая трещина)

РАСПОЛОЖЕНИЕ ДЕФЕКТОВ:
Схема кузова на аукционном листе показывает вид сверху. Стороны: передний бампер, капот, крыша, задний бампер, левая/правая передняя дверь, левая/правая задняя дверь, левое/правое переднее крыло, левое/правое заднее крыло.

КОМПЛЕКТАЦИЯ (сокращения):
AC (кондиционер), AAC (климат-контроль), PS (гидроусилитель), PW (электростеклоподъёмники), AW (литые диски), SR (люк), ABS, AB (подушки безопасности), TV, NAVI (навигация), CD, MD, ETC (электронная система оплаты), HID/LED (фары), RS (задний спойлер), 4WD

ФОРМАТ ОТВЕТА — строго JSON:
{
  "auctionName": "название аукциона или null",
  "lotNumber": "номер лота или null",
  "overallGrade": "общая оценка (S, 6, 5, 4.5, 4, 3.5, 3, 2, 1, R, A, ***) или null",
  "interiorGrade": "оценка салона (A, B, C, D) или null",
  "make": "марка или null",
  "model": "модель или null",
  "year": "год (формат: 'R3 (2021)' для японского календаря или просто '2021') или null",
  "engineVolume": "объём двигателя в см³ или null",
  "engineType": "тип двигателя (бензин/дизель/гибрид/электро) или null",
  "transmission": "коробка передач (AT/MT/CVT) или null",
  "mileage": "пробег в км или null",
  "mileageWarning": true/false,
  "color": "цвет кузова или null",
  "ownership": "тип владения или null",
  "bodyDamages": [
    {
      "location": "расположение на русском",
      "code": "код дефекта",
      "description": "расшифровка на русском",
      "severity": "minor|moderate|major"
    }
  ],
  "equipment": ["расшифрованные опции на русском"],
  "expertComments": "комментарии эксперта переведённые на русском или null",
  "unrecognized": ["что не удалось распознать"],
  "confidence": "high|medium|low",
  "recommendation": "краткая рекомендация по покупке на русском",
  "warnings": ["предупреждения"]
}

ПРАВИЛА:
- Все тексты на русском языке
- Если данные не удалось распознать — записать в unrecognized, НЕ выдумывать
- Если пробег вызывает сомнения (несоответствие возрасту) — mileageWarning: true
- confidence: high если распознано >80% полей, medium если 50-80%, low если <50%
- Год из японского календаря: R = Reiwa (2019+), H = Heisei (1989-2019), конвертировать в европейский
- Ответ — ТОЛЬКО JSON, без пояснений, без markdown-обёрток`;

const USER_PROMPT = 'Расшифруй этот аукционный лист. Извлеки все данные которые видишь. Ответ — строго JSON по заданной схеме.';

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

// ─── ROUTE ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // Rate limit
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({
      error: 'rate_limit',
      message: 'Лимит бесплатных расшифровок исчерпан (3 в день)',
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

  // Convert to base64
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const dataUrl = `data:${file.type};base64,${base64}`;

  // Call Qwen-VL
  try {
    const result = await analyzeImage(dataUrl, USER_PROMPT, {
      model: 'qwen3.5-plus',
      maxTokens: 4096,
      temperature: 0.1,
      systemPrompt: SYSTEM_PROMPT,
    });

    let parsed: unknown;
    try {
      parsed = parseJsonFromContent(result.content);
    } catch {
      return NextResponse.json(
        { error: 'parse_error', message: 'Не удалось распознать аукционный лист. Попробуйте другое фото.' },
        { status: 502 },
      );
    }

    // Record usage only after success
    recordUsage(ip);

    const remaining = checkRateLimit(ip).remaining;

    return NextResponse.json({
      success: true,
      data: parsed,
      meta: {
        model: 'qwen3.5-plus',
        tokens: result.usage.totalTokens,
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
