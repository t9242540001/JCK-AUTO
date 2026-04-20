/**
 * @file        auctionSheet.ts
 * @description Telegram bot photo handler — analyzes Japanese auction sheets via Qwen-VL.
 *              Fires on any incoming photo message. Rate-limited via botRateLimiter (ai, 2 min).
 * @dependencies src/lib/dashscope (analyzeImage),
 *               src/lib/botRateLimiter (checkBotLimit, recordBotUsage, getBotLimitMessage),
 *               TELEGRAM_BOT_TOKEN, TELEGRAM_API_BASE_URL env vars
 * @rule        File download MUST use TELEGRAM_API_BASE_URL, never api.telegram.org
 * @rule        checkBotLimit BEFORE any download or API call
 * @rule        recordBotUsage AFTER successful message send only
 * @rule        Buffer must NOT be written to disk — in-memory only
 * @rule        file_size check MUST use value from bot.getFile(), not msg.photo[N].file_size
 * @lastModified 2026-04-21
 */

import TelegramBot from 'node-telegram-bot-api';
import { analyzeImage } from '../../lib/dashscope';
import { checkBotLimit, recordBotUsage, getBotLimitMessage } from '../../lib/botRateLimiter';
import { incrementCommand } from '../store/botStats';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── PROMPTS ──────────────────────────────────────────────────────────────────

// Copied exactly from src/app/api/tools/auction-sheet/route.ts
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

// ─── FORMATTER ────────────────────────────────────────────────────────────────

/**
 * Maps the AI-returned severity value to a Russian label for end users.
 * Returns empty string for missing / unknown values — caller must skip the suffix then.
 */
function severityLabel(severity: string | null | undefined): string {
  switch (severity) {
    case 'minor':    return 'незначительный';
    case 'moderate': return 'средний';
    case 'major':    return 'серьёзный';
    default:         return '';
  }
}

/**
 * Formats parsed auction sheet JSON into a readable Telegram message.
 */
function formatAuctionResult(data: Record<string, unknown>): string {
  const lines: string[] = ['📋 Аукционный лист расшифрован\n'];

  // Make + model
  const make = data.make as string | null | undefined;
  const model = data.model as string | null | undefined;
  if (make || model) {
    lines.push([make, model].filter(Boolean).join(' '));
  }

  if (data.year) lines.push(`Год: ${data.year}`);

  // Overall grade + interior grade
  if (data.overallGrade) {
    let gradeLine = `Оценка: ${data.overallGrade}`;
    if (data.interiorGrade) gradeLine += ` / Салон: ${data.interiorGrade}`;
    lines.push(gradeLine);
  }

  // Auction + lot
  if (data.auctionName) {
    let auctionLine = `Аукцион: ${data.auctionName}`;
    if (data.lotNumber) auctionLine += `, лот ${data.lotNumber}`;
    lines.push(auctionLine);
  }

  lines.push('');

  // Technical specs
  if (data.mileage) {
    let mileageLine = `Пробег: ${data.mileage} км`;
    if (data.mileageWarning) mileageLine += ' ⚠️ (вызывает сомнения)';
    lines.push(mileageLine);
  }

  if (data.engineVolume) lines.push(`Объём: ${data.engineVolume} см³`);
  if (data.engineType) lines.push(`Тип: ${data.engineType}`);
  if (data.transmission) lines.push(`КПП: ${data.transmission}`);
  if (data.color) lines.push(`Цвет: ${data.color}`);

  lines.push('');

  // Body damages
  const damages = data.bodyDamages as Array<{ location: string; code: string; description: string; severity?: string | null }> | null | undefined;
  if (damages && damages.length > 0) {
    lines.push(`🔧 Дефекты (${damages.length}):`);
    const shown = damages.slice(0, 10);
    for (const d of shown) {
      const label = severityLabel(d.severity);
      if (label) {
        lines.push(`• ${d.location} — ${d.description} (${label})`);
      } else {
        lines.push(`• ${d.location} — ${d.description}`);
      }
    }
    if (damages.length > 10) {
      lines.push(`  ...и ещё ${damages.length - 10} дефектов`);
    }
  }

  // Equipment
  const equipment = data.equipment as string[] | null | undefined;
  if (equipment && equipment.length > 0) {
    lines.push('\n⚙️ Комплектация:');
    lines.push(equipment.join(', '));
  }

  // Expert comments
  if (data.expertComments) {
    lines.push(`\n💬 ${data.expertComments}`);
  }

  lines.push('');

  // Confidence indicator
  const confidence = data.confidence as string | undefined;
  if (confidence === 'high') {
    lines.push('✅ Уверенность: высокая');
  } else if (confidence === 'medium') {
    lines.push('⚠️ Уверенность: средняя');
  } else {
    lines.push('❌ Уверенность: низкая — проверьте вручную');
  }

  if (data.recommendation) {
    lines.push(`\n${data.recommendation}`);
  }

  const warnings = data.warnings as string[] | null | undefined;
  if (warnings && warnings.length > 0) {
    lines.push(`\n⚠️ ${warnings.join('; ')}`);
  }

  lines.push('\n\n🌐 Полный анализ на сайте: jckauto.ru/tools/auction-sheet');

  return lines.join('\n');
}

// ─── SPLITTER ─────────────────────────────────────────────────────────────────

/**
 * Splits a long message into chunks at newline boundaries, never mid-line.
 */
function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];

  const rawLines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of rawLines) {
    const candidate = current ? current + '\n' + line : line;
    if (candidate.length > maxLen && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

/**
 * Registers a photo message handler that analyzes Japanese auction sheets via Qwen-VL.
 */
export function registerAuctionSheetHandler(bot: TelegramBot): void {
  bot.on('message', async (msg) => {
    if (!msg.photo || msg.photo.length === 0) return;

    const chatId = msg.chat.id;
    const telegramId = String(msg.from?.id ?? chatId);

    // 1. Rate limit check — BEFORE any download or API call
    const limitCheck = checkBotLimit(telegramId, 'ai');
    if (!limitCheck.allowed) {
      bot.sendMessage(chatId, getBotLimitMessage(limitCheck));
      return;
    }

    // 2. Get file info (includes reliable file_size from Telegram servers)
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    let file: TelegramBot.File;
    try {
      file = await bot.getFile(fileId);
    } catch {
      bot.sendMessage(chatId, 'Не удалось получить файл. Попробуйте ещё раз.');
      return;
    }

    // 3. Size check — use file.file_size from getFile(), NOT msg.photo[N].file_size
    if (file.file_size && file.file_size > MAX_FILE_SIZE) {
      bot.sendMessage(chatId, 'Сожмите фото и отправьте снова (максимум 5 МБ).');
      return;
    }

    // 4. Validate env before download
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const apiBase = process.env.TELEGRAM_API_BASE_URL;
    if (!botToken || !apiBase) {
      bot.sendMessage(chatId, 'Ошибка конфигурации. Попробуйте позже.');
      return;
    }

    await bot.sendMessage(chatId, '🔍 Анализирую аукционный лист...');

    // 5. Download via Worker URL — NEVER api.telegram.org
    let imageBase64: string;
    try {
      const fileUrl = `${apiBase}/file/bot${botToken}/${file.file_path}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString('base64');
      // buffer goes out of scope here — GC handles cleanup, no disk writes
    } catch (err) {
      console.error('[auctionSheet] download error:', err);
      bot.sendMessage(chatId, 'Не удалось загрузить фото. Попробуйте ещё раз.');
      return;
    }

    // 6. Analyze via Qwen-VL
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;
    try {
      const result = await analyzeImage(dataUrl, USER_PROMPT, {
        model: 'qwen3.5-plus',
        maxTokens: 4096,
        temperature: 0.1,
        systemPrompt: SYSTEM_PROMPT,
      });

      // 7. Parse JSON response
      let parsed: Record<string, unknown>;
      try {
        const match = result.content.match(/```json\s*([\s\S]*?)\s*```/);
        parsed = JSON.parse(match?.[1] || result.content) as Record<string, unknown>;
      } catch {
        bot.sendMessage(
          chatId,
          'Не удалось распознать аукционный лист. Попробуйте другое фото или используйте сайт: jckauto.ru/tools/auction-sheet',
        );
        return;
      }

      // 8. Format and send (split if >4000 chars)
      const text = formatAuctionResult(parsed);
      const chunks = splitMessage(text);
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk);
      }

      // 9. Record usage AFTER successful send only
      recordBotUsage(telegramId, 'ai');
      incrementCommand('auction');

    } catch (err) {
      console.error('[auctionSheet] AI error:', err instanceof Error ? err.message : err);
      bot.sendMessage(
        chatId,
        'Ошибка при анализе. Попробуйте позже или воспользуйтесь сайтом: jckauto.ru/tools/auction-sheet',
      );
    }
  });
}
