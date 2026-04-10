/**
 * @file        route.ts (api/auth/telegram)
 * @description Telegram Login Widget verification endpoint.
 *              Verifies HMAC, saves user to users.json, sets JWT cookie.
 * @dependencies jose (JWT), Node.js crypto (HMAC), TELEGRAM_BOT_TOKEN, JWT_SECRET
 * @rule        NEVER log telegramData.hash or JWT_SECRET values
 * @rule        Atomic write: always write to .tmp then rename — prevents corrupt JSON
 *              if process dies mid-write
 * @rule        Do NOT import from src/bot/store/users.ts — bot and Next.js are
 *              separate PM2 processes with separate in-memory state
 * @lastModified 2026-04-10
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { SignJWT } from 'jose';

// ─── TYPES ────────────────────────────────────────────────────────────────

interface WebAuthUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
  registeredAt: string;
  lastSeenAt: string;
  source?: string;    // which tool triggered auth: encar|auction|customs|calculator
  webAuthAt?: string; // ISO timestamp of web auth
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const USERS_FILE = '/var/www/jckauto/storage/users.json';

// ─── IN-FILE AUTH RATE LIMITER ────────────────────────────────────────────

const authAttempts = new Map<string, { count: number; windowStart: number }>();
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkAuthAttempts(ip: string): boolean {
  const now = Date.now();

  // Clean expired windows
  for (const [key, record] of authAttempts) {
    if (now - record.windowStart > AUTH_WINDOW_MS) {
      authAttempts.delete(key);
    }
  }

  const record = authAttempts.get(ip);
  if (!record || now - record.windowStart > AUTH_WINDOW_MS) {
    authAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }

  record.count++;
  return record.count <= MAX_AUTH_ATTEMPTS;
}

// ─── TELEGRAM HASH VERIFICATION ──────────────────────────────────────────

function verifyTelegramHash(data: Record<string, string>, botToken: string): boolean {
  const hash = data.hash;
  if (!hash) return false;

  const dataWithoutHash = { ...data };
  delete dataWithoutHash.hash;

  const checkString = Object.keys(dataWithoutHash)
    .sort()
    .map((k) => `${k}=${dataWithoutHash[k]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(hash));
}

// ─── FILE I/O HELPERS ─────────────────────────────────────────────────────

async function readUsers(): Promise<WebAuthUser[]> {
  try {
    const content = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(content) as WebAuthUser[];
  } catch {
    return [];
  }
}

async function writeUsers(users: WebAuthUser[]): Promise<void> {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpFile = USERS_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(users, null, 2), 'utf-8');
  fs.renameSync(tmpFile, USERS_FILE);
}

async function upsertWebAuthUser(
  telegramData: Record<string, string>,
  source: string
): Promise<WebAuthUser> {
  const users = await readUsers();
  const userId = Number(telegramData.id);
  const now = new Date().toISOString();

  const existingIndex = users.findIndex((u) => u.id === userId);

  if (existingIndex >= 0) {
    const existing = users[existingIndex];
    users[existingIndex] = {
      ...existing,
      lastSeenAt: now,
      source,
      webAuthAt: now,
    };
    await writeUsers(users);
    return users[existingIndex];
  }

  const newUser: WebAuthUser = {
    id: userId,
    firstName: telegramData.first_name ?? '',
    ...(telegramData.last_name ? { lastName: telegramData.last_name } : {}),
    ...(telegramData.username ? { username: telegramData.username } : {}),
    registeredAt: now,
    lastSeenAt: now,
    source,
    webAuthAt: now,
  };
  users.push(newUser);
  await writeUsers(users);
  return newUser;
}

// ─── POST HANDLER ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Extract IP
  const ip =
    (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // 2. Auth rate limit
  if (!checkAuthAttempts(ip)) {
    return NextResponse.json(
      { error: 'too_many_attempts', message: 'Слишком много попыток. Попробуйте позже.' },
      { status: 429 }
    );
  }

  // 3. Parse body
  let telegramData: Record<string, string>;
  let source: string;
  try {
    const body = await request.json();
    telegramData = body.telegramData ?? {};
    source = typeof body.source === 'string' ? body.source : 'site';
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Неверный формат запроса.' },
      { status: 400 }
    );
  }

  // 4. Validate required fields
  if (!telegramData.id || !telegramData.first_name || !telegramData.auth_date || !telegramData.hash) {
    return NextResponse.json(
      { error: 'missing_fields', message: 'Отсутствуют обязательные поля.' },
      { status: 400 }
    );
  }

  // 5. Check auth_date freshness
  const authDate = Number(telegramData.auth_date);
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > 86400) {
    return NextResponse.json(
      { error: 'auth_expired', message: 'Данные авторизации устарели.' },
      { status: 400 }
    );
  }

  // 6. Verify hash
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: 'server_error', message: 'Ошибка конфигурации сервера.' },
      { status: 500 }
    );
  }
  if (!verifyTelegramHash(telegramData, botToken)) {
    return NextResponse.json(
      { error: 'invalid_signature', message: 'Ошибка верификации Telegram.' },
      { status: 401 }
    );
  }

  // 7. Upsert user
  const user = await upsertWebAuthUser(telegramData, source);

  // 8. Sign JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return NextResponse.json(
      { error: 'server_error', message: 'Ошибка конфигурации сервера.' },
      { status: 500 }
    );
  }
  const secretBytes = new TextEncoder().encode(jwtSecret);
  const token = await new SignJWT({ telegramId: user.id, firstName: user.firstName })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secretBytes);

  // 9. Build response with cookie
  const response = NextResponse.json({
    success: true,
    user: { id: user.id, firstName: user.firstName, username: user.username },
    deepLink: `https://t.me/jckauto_help_bot?start=web_${source}`,
  });

  response.cookies.set('tg_auth', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
