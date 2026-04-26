/**
 * @file        auctionSheet.ts
 * @description Telegram bot photo handler — analyzes Japanese auction sheets
 *              by enqueuing into the shared auctionSheetQueue and polling for
 *              the result produced by runAuctionSheetPipeline. Rate-limited
 *              via botRateLimiter (ai, 2 min).
 * @dependencies src/lib/auctionSheetService (runAuctionSheetPipeline, PipelineResult),
 *               src/lib/auctionSheetQueue (auctionSheetQueue, QueueFullError),
 *               src/lib/botRateLimiter (checkBotLimit, recordBotUsage, getBotLimitMessage),
 *               src/bot/lib/inlineKeyboards (siteAndRequestButtons),
 *               sharp 0.34.5 (image compression),
 *               TELEGRAM_BOT_TOKEN, TELEGRAM_API_BASE_URL env vars
 * @rule        File download MUST use TELEGRAM_API_BASE_URL, never api.telegram.org
 * @rule        checkBotLimit BEFORE any download or API call
 * @rule        recordBotUsage AFTER successful send only — NOT on queue_full,
 *              NOT on pipeline failure, NOT on polling timeout, NOT on format/send error
 * @rule        Buffer must NOT be written to disk — in-memory only
 * @rule        file_size check MUST use value from bot.getFile(), not msg.photo[N].file_size
 * @rule        Sharp compression parameters MUST match the website's
 *              (2000x2000 inside, JPEG 85, sharpen 0.5) — the pipeline
 *              expects a specific input quality envelope
 * @rule        All DashScope/DeepSeek calls MUST go through the shared
 *              auctionSheetQueue (concurrency=1). Direct calls to
 *              analyzeImage / callDeepSeek / callQwenText from this
 *              file are FORBIDDEN — they bypass the concurrency lock.
 * @rule        Polling interval is 1s (in-process Map lookup — free).
 *              Hard timeout is 180s (pipeline typically 30-90s).
 * @rule        Result keyboard MUST be attached to the LAST chunk only,
 *              never to intermediate chunks. Use the shared helper
 *              siteAndRequestButtons from src/bot/lib/inlineKeyboards.
 * @lastModified 2026-04-21
 */

import TelegramBot from 'node-telegram-bot-api';
import sharp from 'sharp';
import { checkBotLimit, recordBotUsage, getBotLimitMessage } from '../../lib/botRateLimiter';
import { incrementCommand } from '../store/botStats';
import {
  runAuctionSheetPipeline,
  type PipelineResult,
} from '../../lib/auctionSheetService';
import { auctionSheetQueue, QueueFullError } from '../../lib/auctionSheetQueue';
import { siteAndRequestButtons } from '../lib/inlineKeyboards';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

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
 * Registers a photo message handler that analyzes Japanese auction sheets
 * through the shared auctionSheetService (via auctionSheetQueue).
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

    const progressMessage = await bot.sendMessage(
      chatId,
      '🔍 Анализирую аукционный лист... обычно занимает 20–60 секунд',
    );
    const progressMessageId = progressMessage.message_id;

    // 5. Download via Worker URL — NEVER api.telegram.org
    let rawBuffer: Buffer;
    try {
      const fileUrl = `${apiBase}/file/bot${botToken}/${file.file_path}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arr = await response.arrayBuffer();
      rawBuffer = Buffer.from(arr);
    } catch (err) {
      console.error('[auctionSheet] download error:', err);
      bot.sendMessage(chatId, 'Не удалось загрузить фото. Попробуйте ещё раз.');
      return;
    }

    // 6. Compress with Sharp — MUST match website compression parameters
    //    (resize to 2000x2000 inside, JPEG quality 85, mild sharpen).
    //    Same parameters as in src/app/api/tools/auction-sheet/route.ts.
    // @rule Sharp compression parameters MUST match the website's —
    //       the pipeline expects a specific input quality envelope.
    //       Any change here requires changing the website too.
    let compressedBuffer: Buffer;
    try {
      compressedBuffer = await sharp(rawBuffer)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .sharpen({ sigma: 0.5 })
        .toBuffer();
    } catch (err) {
      console.warn('[auctionSheet] Sharp compression failed:', err instanceof Error ? err.message : err);
      bot.sendMessage(chatId, 'Не удалось обработать фото. Попробуйте прислать другое изображение.');
      return;
    }

    // 7. Enqueue into shared auction-sheet queue (concurrency=1 shared with website).
    //    Bot calls the pipeline with channel='bot' — bot has its own
    //    rate limiter (botRateLimiter); the site rateLimiter is NOT consulted.
    let jobId: string;
    try {
      jobId = auctionSheetQueue.enqueue(() =>
        runAuctionSheetPipeline(compressedBuffer, {
          channel: 'bot',
          telegramId,
        }),
      );
    } catch (err) {
      if (err instanceof QueueFullError) {
        bot.sendMessage(
          chatId,
          'Сервис временно перегружен. Попробуйте через 5 минут или воспользуйтесь сайтом: jckauto.ru/tools/auction-sheet',
        );
        // NOTE: Do NOT recordBotUsage — queue refusal is not a successful service call.
        return;
      }
      console.error('[auctionSheet] enqueue failed unexpectedly:', err instanceof Error ? err.message : err);
      bot.sendMessage(chatId, 'Ошибка при постановке задачи в очередь. Попробуйте позже.');
      return;
    }

    // 8. Poll the queue for completion. 1s interval, 180s hard timeout.
    //    The job continues running in the queue if we time out here —
    //    this is a known trade-off (see ADR). Cancellation support is a
    //    future improvement.
    // @rule Polling interval is intentionally 1s — it's a Map lookup in
    //       the same process, effectively free. Do NOT widen without reason.
    // @rule Hard timeout is 180s (3 minutes). Pipeline typically completes
    //       in 30-90s; 180s leaves headroom for queue position + processing.

    // ─── PROGRESS INDICATOR ───────────────────────────────────────────────────────

    // Self-updating progress indicator: edits the "Analyzing..." message
    // at fixed elapsed-time thresholds so the user sees motion. Texts are
    // motivational, not literally tied to pipeline stages — the bot has
    // no insight into which AI step is currently running.
    //
    // @rule Edits MUST guard against firing twice for the same threshold —
    //       Telegram throws "message is not modified" otherwise. The
    //       lastFiredThreshold cursor below ensures monotonic progression.
    //
    // @rule Final result/error messages from the polling loop body are
    //       SEPARATE messages, NOT edits of the progress message. Keep
    //       this distinction — editing the progress message into the
    //       final result would lose the inline keyboard.

    interface ProgressThreshold {
      elapsedMs: number;
      text: string;
    }

    const PROGRESS_THRESHOLDS: ProgressThreshold[] = [
      { elapsedMs: 30_000, text: '🔍 Распознаю текст и таблицы...' },
      { elapsedMs: 60_000, text: '🔍 Извлекаю смысл и перевожу...' },
      { elapsedMs: 90_000, text: '⏳ Анализ занимает дольше обычного. Подождите ещё немного...' },
    ];

    const POLL_INTERVAL_MS = 1000;
    const HARD_TIMEOUT_MS = 180_000;
    const startedAt = Date.now();

    let finalSnapshot: ReturnType<typeof auctionSheetQueue.getStatus> = null;
    let lastFiredThresholdIndex = -1;
    while (Date.now() - startedAt < HARD_TIMEOUT_MS) {
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const elapsed = Date.now() - startedAt;
      // Find the highest threshold index whose elapsedMs has been crossed.
      let targetIndex = lastFiredThresholdIndex;
      for (let i = lastFiredThresholdIndex + 1; i < PROGRESS_THRESHOLDS.length; i++) {
        if (elapsed >= PROGRESS_THRESHOLDS[i].elapsedMs) {
          targetIndex = i;
        } else {
          break;
        }
      }
      if (targetIndex > lastFiredThresholdIndex) {
        try {
          await bot.editMessageText(PROGRESS_THRESHOLDS[targetIndex].text, {
            chat_id: chatId,
            message_id: progressMessageId,
          });
        } catch (editErr) {
          // Non-fatal — log and continue. Common cause: "message is not modified"
          // if the same threshold fires twice (shouldn't happen due to cursor),
          // or rate limit (should not happen at <1 edit/30s).
          console.warn('[auctionSheet] progress edit failed:', editErr instanceof Error ? editErr.message : editErr);
        }
        lastFiredThresholdIndex = targetIndex;
      }

      const snapshot = auctionSheetQueue.getStatus(jobId);
      if (snapshot === null) {
        // Job TTL-expired or lost — should not happen within 180s, but guard anyway.
        console.error(`[auctionSheet] job ${jobId} disappeared during polling`);
        bot.sendMessage(
          chatId,
          'Произошла внутренняя ошибка. Попробуйте ещё раз или воспользуйтесь сайтом: jckauto.ru/tools/auction-sheet',
        );
        return;
      }
      if (snapshot.status === 'done' || snapshot.status === 'failed') {
        finalSnapshot = snapshot;
        break;
      }
    }

    // 9. Handle timeout: pipeline did not finish within 180s.
    if (finalSnapshot === null) {
      console.warn(`[auctionSheet] job ${jobId} timed out after ${HARD_TIMEOUT_MS}ms`);
      bot.sendMessage(
        chatId,
        'Анализ занимает дольше обычного. Попробуйте позже или воспользуйтесь сайтом: jckauto.ru/tools/auction-sheet',
      );
      // NOTE: Do NOT recordBotUsage — user never got a result.
      return;
    }

    // 10. Handle failure: pipeline threw. Extract user-friendly message.
    if (finalSnapshot.status === 'failed') {
      console.error(`[auctionSheet] job ${jobId} failed:`, finalSnapshot.error);
      // Pipeline throws errors prefixed with "ai_error:" or "parse_error:"
      // followed by a Russian message suitable for the user.
      // For any other error format, fall back to a generic message.
      const rawError = finalSnapshot.error ?? '';
      let userMessage: string;
      if (rawError.startsWith('ai_error:') || rawError.startsWith('parse_error:')) {
        userMessage = rawError.replace(/^(ai_error|parse_error):\s*/, '').trim()
          || 'Ошибка при анализе. Попробуйте позже или воспользуйтесь сайтом: jckauto.ru/tools/auction-sheet';
      } else {
        userMessage = 'Ошибка при анализе. Попробуйте позже или воспользуйтесь сайтом: jckauto.ru/tools/auction-sheet';
      }
      bot.sendMessage(chatId, userMessage);
      // NOTE: Do NOT recordBotUsage — pipeline failure is not a successful service call.
      return;
    }

    // 11. Format and send the successful result.
    const pipelineResult = finalSnapshot.result as PipelineResult;
    const data = pipelineResult.data as Record<string, unknown>;

    try {
      const text = formatAuctionResult(data);
      const chunks = splitMessage(text);
      const keyboard = siteAndRequestButtons('https://jckauto.ru/tools/auction-sheet');
      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        await bot.sendMessage(
          chatId,
          chunks[i],
          isLast ? { reply_markup: keyboard } : undefined,
        );
      }

      // 12. Record usage AFTER successful send only.
      recordBotUsage(telegramId, 'ai');
      incrementCommand('auction');
    } catch (sendErr) {
      console.error('[auctionSheet] format/send error:', sendErr instanceof Error ? sendErr.message : sendErr);
      bot.sendMessage(
        chatId,
        'Отчёт получен, но не удалось отправить его в Telegram. Воспользуйтесь сайтом: jckauto.ru/tools/auction-sheet',
      );
      // NOTE: Do NOT recordBotUsage — user didn't receive the full result.
    }
  });
}
