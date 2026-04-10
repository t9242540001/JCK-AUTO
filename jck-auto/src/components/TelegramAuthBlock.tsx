/**
 * @file        TelegramAuthBlock.tsx
 * @description Reusable Telegram Login Widget component for rate-limited tools.
 *              Shows usage counter, auth widget on limit, deep link after auth.
 * @dependencies /api/auth/telegram, NEXT_PUBLIC_TELEGRAM_BOT_USERNAME, CONTACTS
 * @rule        window.onTelegramAuth MUST be set BEFORE script is appended to DOM
 * @rule        Clean up window.onTelegramAuth and container innerHTML on unmount
 * @lastModified 2026-04-10
 */

'use client';

import { useEffect, useState } from 'react';
import { CONTACTS } from '@/lib/constants';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface TelegramAuthBlockProps {
  usedCount: number;
  maxCount: number;
  isLimitReached: boolean;
  source: string;
  onAuthSuccess?: () => void;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────

export default function TelegramAuthBlock({
  usedCount,
  maxCount,
  isLimitReached,
  source,
  onAuthSuccess,
}: TelegramAuthBlockProps) {
  const [widgetFailed, setWidgetFailed] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);

  // ─── TELEGRAM AUTH CALLBACK ─────────────────────────────────────────

  async function handleTelegramAuth(telegramData: Record<string, string>) {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramData, source }),
      });
      if (!res.ok) throw new Error('auth_failed');
      const data = await res.json();
      setDeepLink(data.deepLink);
      onAuthSuccess?.();
    } catch {
      setAuthError('Ошибка авторизации. Попробуйте позже.');
    } finally {
      setAuthLoading(false);
    }
  }

  // ─── WIDGET INJECTION ───────────────────────────────────────────────

  useEffect(() => {
    if (!isLimitReached) return;

    // Set global callback BEFORE loading script
    (window as unknown as Record<string, unknown>).onTelegramAuth = handleTelegramAuth;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute(
      'data-telegram-login',
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'jckauto_help_bot'
    );
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    script.onerror = () => setWidgetFailed(true);

    const container = document.getElementById('tg-widget-container');
    if (container) container.appendChild(script);

    return () => {
      delete (window as unknown as Record<string, unknown>).onTelegramAuth;
      const c = document.getElementById('tg-widget-container');
      if (c) c.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLimitReached]);

  // ─── COUNTER BADGE ──────────────────────────────────────────────────

  const isLastOne = usedCount === maxCount - 1;
  const badgeColor = isLastOne
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-muted text-muted-foreground border-border';

  const counterBadge = (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
    >
      Использовано: {usedCount} / {maxCount}
    </span>
  );

  // ─── LIMIT NOT REACHED — only show badge ────────────────────────────

  if (!isLimitReached) {
    return <div className="flex justify-end">{counterBadge}</div>;
  }

  // ─── AUTH SUCCESS STATE ─────────────────────────────────────────────

  if (deepLink) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="flex items-center gap-2 text-green-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-semibold">Авторизация успешна!</span>
        </div>
        <p className="text-sm text-muted-foreground">Теперь у вас 10 запросов в день.</p>
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-[#2AABEE] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Открыть в боте
        </a>
        <p className="text-xs text-muted-foreground">
          Также рекомендуем подписаться на канал{' '}
          <a
            href="https://t.me/jckauto_import_koreya"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            t.me/jckauto_import_koreya
          </a>
        </p>
      </div>
    );
  }

  // ─── LIMIT REACHED — auth block ─────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-surface p-6 text-center">
      <div>
        <h3 className="text-base font-semibold">Бесплатные попытки исчерпаны</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Войдите через Telegram — получите 10 запросов в день бесплатно
        </p>
      </div>

      {/* Widget or fallback */}
      {widgetFailed ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Войдите через бот для расширенного доступа
          </p>
          <a
            href="https://t.me/jckauto_help_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-[#2AABEE] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Открыть бот
          </a>
        </div>
      ) : (
        <div className="flex min-h-[48px] items-center justify-center">
          {authLoading ? (
            <span className="text-sm text-muted-foreground">Авторизация...</span>
          ) : (
            <div id="tg-widget-container" />
          )}
        </div>
      )}

      {authError && (
        <p className="text-sm text-destructive">{authError}</p>
      )}

      {/* Divider */}
      <div className="flex w-full items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">или</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Always-visible fallback */}
      <a
        href={CONTACTS.telegram}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-muted-foreground underline hover:text-foreground"
      >
        Написать менеджеру
      </a>
    </div>
  );
}
