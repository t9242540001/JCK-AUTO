/**
 * @file        cronAlert.ts
 * @description Fail-open Telegram alert helper for cron scripts
 *              (news, articles, noscut prices, tariffs, future crons).
 * @runs        VDS cron scripts only — never bot, never route handlers.
 * @env         TELEGRAM_API_BASE_URL, TELEGRAM_BOT_TOKEN,
 *              ALERTS_TELEGRAM_ID (optional),
 *              ADMIN_TELEGRAM_IDS (fallback source).
 * @rule        FAIL-OPEN: a failed alert MUST NOT throw, MUST NOT
 *              reject. Any error is caught, logged to stderr, and
 *              swallowed. Alert failure is never a cron failure.
 * @rule        Telegram API goes through TELEGRAM_API_BASE_URL
 *              (Cloudflare Worker) — direct provider endpoint
 *              calls are FORBIDDEN (rules.md Bot Rate Limiting).
 */

import { hostname } from 'os';

/** Severity level controlling emoji prefix in the rendered alert. */
export type CronAlertSeverity = 'info' | 'warning' | 'error';

/** Input for {@link sendCronAlert}. `severity` defaults to `'error'`. */
export interface CronAlertInput {
  title: string;
  body: string;
  severity?: CronAlertSeverity;
}

const REQUEST_TIMEOUT_MS = 10_000;
const SEVERITY_EMOJI: Record<CronAlertSeverity, string> = { info: '🟢', warning: '🟡', error: '🔴' };

/** Parses the first numeric ID from a comma-separated list like "111,222,333". */
function parseFirstAdminId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const first = raw.split(',')[0]?.trim();
  return first && /^\d+$/.test(first) ? first : undefined;
}
/** Escapes &, <, > for Telegram parse_mode: 'HTML'. Order matters: & first. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Send a Telegram alert to the cron-observability chat. Fail-open:
 * never throws; any error is logged to stderr and swallowed.
 * @param input `title` (short, ≤100 chars recommended), `body`
 *              (auto-truncated to 3500 chars), `severity` (default
 *              `'error'`).
 */
export async function sendCronAlert(input: CronAlertInput): Promise<void> {
  const baseUrl = process.env.TELEGRAM_API_BASE_URL;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ALERTS_TELEGRAM_ID ?? parseFirstAdminId(process.env.ADMIN_TELEGRAM_IDS);

  if (!baseUrl || !token || !chatId) {
    const which = !baseUrl ? 'TELEGRAM_API_BASE_URL' : !token ? 'TELEGRAM_BOT_TOKEN' : 'ALERTS_TELEGRAM_ID / ADMIN_TELEGRAM_IDS';
    console.error(`[cronAlert] skipped: env var missing — ${which}`);
    return;
  }

  const severity: CronAlertSeverity = input.severity ?? 'error';
  const emoji = SEVERITY_EMOJI[severity];
  const title = escapeHtml(input.title);
  const bodyRaw = input.body.length > 3500 ? input.body.slice(0, 3497) + '…' : input.body;
  const body = escapeHtml(bodyRaw);
  const timestamp = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date());
  const message = `${emoji} <b>[JCK AUTO Cron]</b>\n<b>${title}</b>\n\n${body}\n\n<i>VDS: ${hostname()}, ${timestamp} MSK</i>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // @rule Telegram API MUST go through TELEGRAM_API_BASE_URL (Cloudflare
    // Worker tg-proxy). Direct calls to api.telegram.org are BANNED by the
    // rule in knowledge/rules.md → Bot Rate Limiting Rules — the provider
    // blocks the direct endpoint from Russian VDS IPs.
    const resp = await fetch(`${baseUrl}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: parseInt(chatId, 10), text: message, parse_mode: 'HTML' }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const snippet = (await resp.text().catch(() => '')).slice(0, 200);
      console.error(`[cronAlert] non-2xx: HTTP ${resp.status} ${snippet}`);
      return;
    }
    console.log(`[cronAlert] sent: ${input.title}`);
  // @rule FAIL-OPEN: swallow the error. A failing alert MUST NOT crash
  // the calling cron. The whole point of this module is to catch the
  // original cron failure; if the alert itself fails, we prefer silent
  // failure of the alert over a cascading crash of the cron on top of
  // whatever problem prompted the alert.
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cronAlert] failed to send: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}
