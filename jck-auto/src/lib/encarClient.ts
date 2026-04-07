/**
 * @file encarClient.ts
 * @description Клиент Encar API: извлечение данных авто с корейского маркетплейса
 * @runs VDS напрямую (без прокси, CORS: *)
 * @input URL или carid авто на Encar.com
 * @output EncarResult с переведёнными на русский данными
 * @rule Encar API — без авторизации, endpoint'ы открытые
 * @rule Цена в Encar — в 만원 (万원), умножать на 10000 для KRW
 * @rule CARAPIS_API_KEY — не использовать, Encar API работает без ключей
 * @lastModified 2026-04-03
 */

import { callDeepSeek } from './deepseek';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface EncarResult {
  make: string;
  model: string;
  grade: string | null;
  year: number;
  mileage: number;
  priceKRW: number;
  displacement: number;
  fuelType: string;
  transmission: string;
  bodyType: string | null;
  color: string;
  vin: string | null;
  photoUrls: string[];
  region: string | null;
  dealerName: string | null;
  dealerPhone: string | null;
  accidentFree: boolean;
  inspectionSummary: string | null;
  description: string | null;
  sourceUrl: string;
  confidence: 'high' | 'medium';
  city: string | null;
  dealerFirm: string | null;
  descriptionRu: string | null;
  translationFailed?: boolean;
  enginePower?: number;
  enginePowerKw?: number;
  enginePowerSource?: 'ai' | 'user';
  enginePowerConfidence?: 'high' | 'medium' | 'low';
}

// Сырые данные из Encar API (частичная типизация)
interface EncarVehicleRaw {
  category?: {
    manufacturerEnglishName?: string;
    modelGroupEnglishName?: string;
    gradeName?: string;
    gradeDetailName?: string;
    gradeEnglishName?: string;
    gradeDetailEnglishName?: string;
    formYear?: number;
  };
  spec?: {
    mileage?: number;
    displacement?: number;
    fuelName?: string;
    transmissionName?: string;
    bodyName?: string;
    colorName?: string;
  };
  advertisement?: { price?: number };
  vin?: string;
  photos?: Array<{ path?: string }>;
  contact?: { userId?: string; address?: string; no?: string };
  contents?: { text?: string };
  partnership?: {
    dealer?: {
      name?: string;
      firm?: { name?: string };
    };
  };
}

interface EncarInspectionRaw {
  condition?: { accident?: string };
  mileage?: number;
  vin?: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const ENCAR_API_BASE = 'https://api.encar.com/v1/readside';
const ENCAR_PHOTO_BASE = 'https://ci.encar.com';
const FETCH_TIMEOUT = 15_000;

const FUEL_MAP: Record<string, string> = {
  '가솔린': 'Бензин', '디젤': 'Дизель', '전기': 'Электро',
  '하이브리드': 'Гибрид', 'LPG': 'Газ (LPG)', 'LPG(하이브리드)': 'Гибрид (LPG)',
  '가솔린+전기': 'Гибрид', '디젤+전기': 'Дизель-гибрид',
};

const TRANSMISSION_MAP: Record<string, string> = {
  '오토': 'АКПП', '수동': 'МКПП', 'CVT': 'Вариатор', '세미오토': 'Робот',
};

const COLOR_MAP: Record<string, string> = {
  '흰색': 'Белый', '검정색': 'Чёрный', '은색': 'Серебристый', '회색': 'Серый',
  '파란색': 'Синий', '빨간색': 'Красный', '진주색': 'Жемчужный', '갈색': 'Коричневый',
  '녹색': 'Зелёный', '주황색': 'Оранжевый', '노란색': 'Жёлтый', '기타': 'Другой',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, retries: number = 2): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('fetchWithTimeout: all retries exhausted');
}

function translate(value: string | undefined, map: Record<string, string>): string {
  if (!value) return 'Не указано';
  return map[value] ?? value;
}

// ─── MAIN FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Извлечь carid из URL Encar
 * @input url — fem.encar.com/cars/detail/{carid}, encar.com/dc/dc_cardetailview.do?carid={carid}, или число
 */
export function extractCarId(url: string): number | null {
  const trimmed = url.trim();

  // Чистое число
  const asNum = parseInt(trimmed, 10);
  if (!isNaN(asNum) && String(asNum) === trimmed) return asNum;

  // fem.encar.com/cars/detail/{carid}
  const femMatch = trimmed.match(/fem\.encar\.com\/cars\/detail\/(\d+)/);
  if (femMatch) return parseInt(femMatch[1], 10);

  // encar.com/dc/dc_cardetailview.do?carid={carid}
  const dcMatch = trimmed.match(/carid=(\d+)/);
  if (dcMatch) return parseInt(dcMatch[1], 10);

  // Любой URL с числом в конце пути
  const pathMatch = trimmed.match(/\/(\d{6,})(?:\?|$|#)/);
  if (pathMatch) return parseInt(pathMatch[1], 10);

  return null;
}

/**
 * Загрузить основные данные авто
 */
export async function fetchVehicle(carid: number): Promise<EncarVehicleRaw> {
  const res = await fetchWithTimeout(`${ENCAR_API_BASE}/vehicle/${carid}`);
  if (!res.ok) throw new Error(`Encar API ${res.status}`);
  return (await res.json()) as EncarVehicleRaw;
}

/**
 * Загрузить данные техосмотра (может отсутствовать)
 */
export async function fetchInspection(carid: number): Promise<EncarInspectionRaw | null> {
  try {
    const res = await fetchWithTimeout(`${ENCAR_API_BASE}/inspection/vehicle/${carid}`, 1);
    if (!res.ok) return null;
    return (await res.json()) as EncarInspectionRaw;
  } catch {
    return null;
  }
}

/**
 * Маппинг сырых данных в структурированный результат
 */
export function mapToResult(
  raw: EncarVehicleRaw,
  inspection: EncarInspectionRaw | null,
  carid: number,
): EncarResult {
  const cat = raw.category;
  const spec = raw.spec;
  const priceManwon = raw.advertisement?.price ?? 0;

  const photos = (raw.photos ?? [])
    .map((p) => p.path ? `${ENCAR_PHOTO_BASE}${p.path}` : null)
    .filter(Boolean) as string[];

  const accidentText = inspection?.condition?.accident;
  const accidentFree = !accidentText || accidentText === '없음' || accidentText === '무사고';

  let inspectionSummary: string | null = null;
  if (inspection) {
    inspectionSummary = accidentFree ? 'ДТП не зафиксировано' : `ДТП: ${accidentText}`;
  }

  return {
    make: cat?.manufacturerEnglishName ?? 'Unknown',
    model: cat?.modelGroupEnglishName ?? 'Unknown',
    grade: [
      cat?.gradeEnglishName ?? cat?.gradeName,
      cat?.gradeDetailEnglishName ?? cat?.gradeDetailName,
    ].filter(Boolean).join(' ') || null,
    year: cat?.formYear ?? 0,
    mileage: spec?.mileage ?? 0,
    priceKRW: priceManwon * 10_000,
    displacement: spec?.displacement ?? 0,
    fuelType: translate(spec?.fuelName, FUEL_MAP),
    transmission: translate(spec?.transmissionName, TRANSMISSION_MAP),
    bodyType: spec?.bodyName ?? null,
    color: translate(spec?.colorName, COLOR_MAP),
    vin: raw.vin ?? inspection?.vin ?? null,
    photoUrls: photos.slice(0, 10),
    region: raw.contact?.address ?? null,
    dealerName: raw.partnership?.dealer?.name ?? raw.contact?.userId ?? null,
    dealerPhone: raw.contact?.no ?? null,
    accidentFree,
    inspectionSummary,
    description: raw.contents?.text ?? null,
    sourceUrl: `https://fem.encar.com/cars/detail/${carid}`,
    confidence: photos.length > 0 && spec?.mileage ? 'high' : 'medium',
    city: null,
    dealerFirm: raw.partnership?.dealer?.firm?.name ?? null,
    descriptionRu: null,
  };
}

// ─── AI TRANSLATION ──────────────────────────────────────────────────────

const TRANSLATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const translationCache = new Map<number, {
  data: { description: string | null; dealerName: string | null; dealerFirm: string | null; city: string | null };
  expiresAt: number;
}>();

const TRANSLATE_SYSTEM_PROMPT = 'Ты переводчик с корейского на русский. Переведи все предоставленные поля. Правила:\n- Имена людей и фирм транслитерируй на русский естественно для русского читателя\n- Для поля "address" верни ТОЛЬКО город и провинцию на русском (например "Ансан, Кёнгидо"), без улиц и номеров\n- Поле "description" переведи полностью на русский\n- Ответь ТОЛЬКО валидным JSON с теми же ключами что на входе. Без пояснений.';

/**
 * Перевести корейские поля через DeepSeek (batch, один вызов)
 * @input carId, корейские строки (description, dealerName, dealerFirm, address)
 * @output переведённые строки + city (извлечённый из address) + failed flag
 * @rule Никогда не бросает исключений — при ошибке возвращает оригиналы с failed: true
 * @cost ~$0.001 за вызов (DeepSeek, ~500 токенов)
 */
export async function translateEncarFields(params: {
  carId: number;
  description: string | null;
  dealerName: string | null;
  dealerFirm: string | null;
  address: string | null;
}): Promise<{
  description: string | null;
  dealerName: string | null;
  dealerFirm: string | null;
  city: string | null;
  failed: boolean;
}> {
  const { carId, description, dealerName, dealerFirm, address } = params;

  // Short-circuit if nothing to translate
  if (!description && !dealerName && !dealerFirm && !address) {
    return { description: null, dealerName: null, dealerFirm: null, city: null, failed: false };
  }

  // Check cache
  const cached = translationCache.get(carId);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[encar] translateEncarFields: carId=${carId} cache hit`);
    return { ...cached.data, failed: false };
  }

  try {
    // Build input with only non-null fields
    const input: Record<string, string> = {};
    if (description) input.description = description;
    if (dealerName) input.dealerName = dealerName;
    if (dealerFirm) input.dealerFirm = dealerFirm;
    if (address) input.address = address;

    const userPrompt = JSON.stringify(input, null, 2);

    const response = await callDeepSeek(userPrompt, {
      temperature: 0.1,
      maxTokens: 2000,
      systemPrompt: TRANSLATE_SYSTEM_PROMPT,
    });

    const text = response.content.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON block in DeepSeek response');

    const parsed = JSON.parse(match[0]) as Record<string, unknown>;

    // Validate: each field must be string or absent
    const validStr = (v: unknown): string | null => (typeof v === 'string' && v.length > 0) ? v : null;

    const result = {
      description: validStr(parsed.description),
      dealerName: validStr(parsed.dealerName),
      dealerFirm: validStr(parsed.dealerFirm),
      city: validStr(parsed.address),
    };

    const translatedCount = [result.description, result.dealerName, result.dealerFirm, result.city].filter(Boolean).length;
    console.log(`[encar] translateEncarFields: carId=${carId} translated ${translatedCount} fields`);

    // Cache successful result
    translationCache.set(carId, { data: result, expiresAt: Date.now() + TRANSLATION_CACHE_TTL });

    return { ...result, failed: false };
  } catch (err) {
    console.warn('[encar] translateEncarFields failed:', err instanceof Error ? err.message : err);
    // Return original Korean values as fallback
    return {
      description,
      dealerName,
      dealerFirm,
      city: null,
      failed: true,
    };
  }
}

// ─── AI POWER ESTIMATION ──────────────────────────────────────────────────

const POWER_SYSTEM_PROMPT = 'Ты — автомобильный справочник. Определи мощность двигателя по характеристикам. Ответь ТОЛЬКО числом в формате JSON: {"power": число, "unit": "hp" или "kw", "confidence": "high" или "medium" или "low"}. Если не можешь определить — ответь {"power": null}.';

/**
 * Определить мощность двигателя через DeepSeek по характеристикам авто
 * @cost ~$0.0001 за вызов (DeepSeek, ~100 токенов)
 * @rule При ошибке возвращает null — не ломает основной поток
 */
export async function estimateEnginePower(params: {
  make: string;
  model: string;
  grade: string | null;
  year: number;
  displacement: number;
  fuelType: string;
}): Promise<{ power: number; unit: 'hp' | 'kw'; confidence: 'high' | 'medium' | 'low' } | null> {
  try {
    const userPrompt = `Мощность двигателя: ${params.make} ${params.model} ${params.grade ?? ''}, ${params.year} год, ${params.displacement} см³, ${params.fuelType}`;

    const response = await callDeepSeek(userPrompt, {
      temperature: 0.1,
      maxTokens: 100,
      systemPrompt: POWER_SYSTEM_PROMPT,
    });

    const text = response.content.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const data = JSON.parse(match[0]) as { power?: number | null; unit?: string; confidence?: string };
    if (!data.power || typeof data.power !== 'number' || data.power < 1 || data.power > 2000) return null;
    if (data.unit !== 'hp' && data.unit !== 'kw') return null;

    const confidence = (['high', 'medium', 'low'].includes(data.confidence ?? '') ? data.confidence : 'medium') as 'high' | 'medium' | 'low';

    console.log(`[encar] estimateEnginePower: ${params.make} ${params.model} → ${data.power} ${data.unit} (${confidence})`);
    return { power: data.power, unit: data.unit, confidence };
  } catch (err) {
    console.warn('[encar] estimateEnginePower failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
