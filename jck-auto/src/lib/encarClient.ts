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
}

// Сырые данные из Encar API (частичная типизация)
interface EncarVehicleRaw {
  category?: {
    manufacturerEnglishName?: string;
    modelGroupEnglishName?: string;
    gradeName?: string;
    gradeDetailName?: string;
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
    grade: [cat?.gradeName, cat?.gradeDetailName].filter(Boolean).join(' ') || null,
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
    dealerName: raw.contact?.userId ?? null,
    dealerPhone: raw.contact?.no ?? null,
    accidentFree,
    inspectionSummary,
    description: raw.contents?.text ?? null,
    sourceUrl: `https://fem.encar.com/cars/detail/${carid}`,
    confidence: photos.length > 0 && spec?.mileage ? 'high' : 'medium',
  };
}
