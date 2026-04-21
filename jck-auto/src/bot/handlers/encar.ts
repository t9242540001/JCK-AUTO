/**
 * @file        encar.ts
 * @description Telegram bot handler for Encar.com links — analyzes Korean car listings.
 *              Fires when any message text contains "encar.com".
 *              Fetches vehicle data, AI power estimate + translation (parallel, non-blocking),
 *              calculates turnkey cost (non-fatal failure), and formats a summary.
 * @dependencies src/lib/encarClient, src/lib/calculator, src/lib/currencyRates,
 *               src/lib/botRateLimiter, src/bot/lib/inlineKeyboards
 * @rule        checkBotLimit BEFORE fetchVehicle — rate check must be first
 * @rule        recordBotUsage AFTER successful sendMessage only — never in catch branches
 * @rule        Cost calculation failure is non-fatal — show vehicle data without price
 * @rule        No incrementCommand call — 'encar' is not a CommandStat slot
 * @lastModified 2026-04-22
 */

import TelegramBot from 'node-telegram-bot-api';
import {
  extractCarId,
  fetchVehicle,
  fetchInspection,
  mapToResult,
  estimateEnginePower,
  translateEncarFields,
  type EncarResult,
} from '../../lib/encarClient';
import { calculateTotal, type CarAge, type EngineType } from '../../lib/calculator';
import { fetchCBRRates } from '../../lib/currencyRates';
import { checkBotLimit, recordBotUsage, getBotLimitMessage } from '../../lib/botRateLimiter';
import { siteAndRequestButtons } from '../lib/inlineKeyboards';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const KW_TO_HP = 1.35962;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function yearToCarAge(year: number): CarAge {
  const age = new Date().getFullYear() - year;
  if (age < 3) return 'under3';
  if (age <= 5) return '3to5';
  if (age <= 7) return '5to7';
  return 'over7';
}

function fuelToEngineType(fuelType: string): EngineType {
  if (fuelType.includes('Дизель')) return 'diesel';
  if (fuelType.includes('Электро')) return 'electric';
  if (fuelType.includes('Гибрид')) return 'hybrid';
  return 'petrol';
}

function formatMileage(km: number): string {
  return km.toLocaleString('ru-RU') + ' км';
}

function formatKRW(krw: number): string {
  const manwon = Math.round(krw / 10_000);
  return `${manwon.toLocaleString('ru-RU')}万₩ (${(krw / 1_000_000).toFixed(2)} млн ₩)`;
}

function formatRub(rub: number): string {
  return Math.round(rub).toLocaleString('ru-RU') + ' ₽';
}

// ─── FORMATTER ────────────────────────────────────────────────────────────────

/**
 * Formats an EncarResult + totalRub into a Telegram message string.
 * Shows cost section only when totalRub > 0.
 */
function formatEncarResult(result: EncarResult, totalRub: number): string {
  const lines: string[] = [];

  // Header
  const nameParts = [result.make, result.model, result.grade].filter(Boolean);
  lines.push(`🚗 ${nameParts.join(' ')}`);
  if (result.year) lines.push(`Год: ${result.year}`);
  lines.push('');

  // Technical specs
  lines.push('📋 Характеристики:');
  lines.push(`Пробег: ${formatMileage(result.mileage)}`);
  if (result.displacement) lines.push(`Объём: ${result.displacement} см³`);
  lines.push(`Тип топлива: ${result.fuelType}`);
  lines.push(`КПП: ${result.transmission}`);
  if (result.color && result.color !== 'Не указано') lines.push(`Цвет: ${result.color}`);
  if (result.bodyType) lines.push(`Кузов: ${result.bodyType}`);

  // Engine power
  if (result.enginePower) {
    let powerLine = `Мощность: ${result.enginePower} л.с.`;
    if (result.enginePowerSource === 'ai') {
      const confidence = result.enginePowerConfidence === 'high' ? 'AI, высокая уверенность' : 'AI, средняя уверенность';
      powerLine += ` (${confidence})`;
    }
    if (result.enginePowerKw) powerLine += ` / ${result.enginePowerKw} кВт`;
    lines.push(powerLine);
  }

  lines.push('');

  // Price + accident info
  lines.push('💰 Стоимость в Корее:');
  if (result.priceKRW > 0) {
    lines.push(formatKRW(result.priceKRW));
  } else {
    lines.push('Цена не указана');
  }

  if (result.inspectionSummary) {
    const icon = result.accidentFree ? '✅' : '⚠️';
    lines.push(`${icon} Техосмотр: ${result.inspectionSummary}`);
  }

  // Cost breakdown
  if (totalRub > 0) {
    lines.push('');
    lines.push('🧮 Ориентировочно под ключ:');
    lines.push(`≈ ${formatRub(totalRub)}`);
    lines.push('(авто + таможня + доставка Владивосток→Москва)');
  }

  lines.push('');

  // Dealer / location
  const locationParts: string[] = [];
  if (result.city) locationParts.push(result.city);
  else if (result.region) locationParts.push(result.region);
  if (result.dealerName) locationParts.push(result.dealerName);
  if (result.dealerFirm) locationParts.push(`(${result.dealerFirm})`);
  if (locationParts.length > 0) lines.push(`📍 ${locationParts.join(', ')}`);

  // Description (translated if available)
  const desc = result.descriptionRu || result.description;
  if (desc && desc.length > 0) {
    const truncated = desc.length > 300 ? desc.slice(0, 297) + '...' : desc;
    lines.push('');
    lines.push(`📝 ${truncated}`);
  }

  // Translation warning
  if (result.translationFailed) {
    lines.push('');
    lines.push('⚠️ Перевод недоступен — данные на корейском');
  }

  lines.push('');
  lines.push('Расчёт ориентировочный. Уточняйте у менеджера.');

  return lines.join('\n');
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

/**
 * Registers a message handler that fires when message text contains "encar.com".
 * Performs full vehicle analysis with AI enrichment and cost calculation.
 */
export function registerEncarHandler(bot: TelegramBot): void {
  bot.on('message', async (msg) => {
    if (!msg.text?.includes('encar.com')) return;

    const chatId = msg.chat.id;
    const telegramId = String(msg.from?.id ?? chatId);
    const url = msg.text.trim();

    // 1. Extract car ID — validate before rate limit check
    const carid = extractCarId(url);
    if (!carid) {
      bot.sendMessage(chatId, 'Не удалось распознать ссылку Encar. Отправьте прямую ссылку на авто.');
      return;
    }

    // 2. Rate limit check — BEFORE any API call
    const limitCheck = checkBotLimit(telegramId, 'ai');
    if (!limitCheck.allowed) {
      bot.sendMessage(chatId, getBotLimitMessage(limitCheck));
      return;
    }

    await bot.sendMessage(chatId, '🔍 Получаю данные с Encar...');

    // 3. Fetch vehicle + inspection in parallel
    let result: EncarResult;
    try {
      const [vehicle, inspection] = await Promise.all([
        fetchVehicle(carid),
        fetchInspection(carid),
      ]);
      result = mapToResult(vehicle, inspection, carid);
    } catch (err) {
      const msg2 = err instanceof Error ? err.message : String(err);
      if (msg2.includes('404') || msg2.includes('Not Found')) {
        bot.sendMessage(chatId, 'Автомобиль не найден на Encar. Возможно, объявление снято.');
      } else {
        console.error('[encar bot] API error:', msg2);
        bot.sendMessage(chatId, 'Encar временно недоступен. Попробуйте позже или откройте на сайте.');
      }
      return;
    }

    // 4. AI enrichment — power + translation in parallel (non-fatal failures)
    const [powerResult, translationResult] = await Promise.allSettled([
      estimateEnginePower({
        make: result.make,
        model: result.model,
        grade: result.grade,
        year: result.year,
        displacement: result.displacement,
        fuelType: result.fuelType,
      }),
      translateEncarFields({
        carId: carid,
        description: result.description,
        dealerName: result.dealerName,
        dealerFirm: result.dealerFirm,
        address: result.region,
      }),
    ]);

    // Apply translation
    if (translationResult.status === 'fulfilled') {
      const t = translationResult.value;
      result.descriptionRu = t.description;
      result.dealerName = t.dealerName ?? result.dealerName;
      result.dealerFirm = t.dealerFirm ?? result.dealerFirm;
      result.city = t.city;
      if (t.failed) result.translationFailed = true;
    } else {
      result.translationFailed = true;
    }

    // Apply power estimate
    let enginePowerHp: number | undefined;
    if (powerResult.status === 'fulfilled' && powerResult.value) {
      const pe = powerResult.value;
      const hp = pe.unit === 'kw' ? Math.round(pe.power * KW_TO_HP) : pe.power;
      result.enginePower = hp;
      result.enginePowerSource = 'ai';
      result.enginePowerConfidence = pe.confidence;
      enginePowerHp = hp;

      if (fuelToEngineType(result.fuelType) === 'electric') {
        result.enginePowerKw = pe.unit === 'kw' ? pe.power : Math.round(pe.power / KW_TO_HP);
      }
    }

    // 5. Calculate turnkey cost — non-fatal on any failure
    let totalRub = 0;
    if (enginePowerHp && result.priceKRW > 0) {
      try {
        const rates = await fetchCBRRates();
        const engineType = fuelToEngineType(result.fuelType);
        const breakdown = calculateTotal({
          priceInCurrency: result.priceKRW,
          currencyCode: 'KRW',
          engineVolume: engineType === 'electric' ? 0 : result.displacement,
          enginePower: enginePowerHp,
          carAge: yearToCarAge(result.year),
          buyerType: 'individual',
          personalUse: true,
          country: 'korea',
          engineType,
        }, rates);
        totalRub = breakdown.totalRub;
      } catch (err) {
        console.warn('[encar bot] cost calculation failed:', err instanceof Error ? err.message : err);
        // totalRub stays 0 — cost section will be hidden in formatter
      }
    }

    // 6. Format and send with action buttons
    const text = formatEncarResult(result, totalRub);
    const siteUrl = `https://jckauto.ru/tools/encar?url=${encodeURIComponent(result.sourceUrl)}`;

    try {
      await bot.sendMessage(chatId, text, {
        reply_markup: siteAndRequestButtons(siteUrl),
      });

      // 7. Record usage AFTER successful send only
      recordBotUsage(telegramId, 'ai');
      // NOTE: no incrementCommand — 'encar' is not a CommandStat slot

    } catch (err) {
      console.error('[encar bot] sendMessage error:', err instanceof Error ? err.message : err);
    }
  });
}
