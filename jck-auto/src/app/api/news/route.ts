/**
 * @file route.ts
 * @description GET /api/news — эндпоинт для ленты новостей
 * @runs VDS (Next.js server-side)
 * @input query: page, limit, tag, date
 * @output JSON с NewsDayPreview[] или NewsDay + tags
 * @lastModified 2026-04-01
 */

import { NextResponse } from 'next/server';
import {
  getNewsByDate,
  getNewsDaysPaginated,
  getAllTags,
} from '@/services/news/reader';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const tags = getAllTags();

  // Режим: один день по дате
  const date = searchParams.get('date');
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Невалидный формат даты. Ожидается YYYY-MM-DD' },
        { status: 400 },
      );
    }
    const day = getNewsByDate(date);
    if (!day) {
      return NextResponse.json(
        { success: false, error: 'Новости за указанную дату не найдены' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: day, pagination: null, tags });
  }

  // Режим: пагинированный список
  const pageRaw = searchParams.get('page');
  const limitRaw = searchParams.get('limit');
  const tag = searchParams.get('tag') || undefined;

  const page = pageRaw ? parseInt(pageRaw, 10) : 1;
  const limit = limitRaw ? parseInt(limitRaw, 10) : 7;

  if (isNaN(page) || page < 1) {
    return NextResponse.json(
      { success: false, error: 'page должен быть числом >= 1' },
      { status: 400 },
    );
  }
  if (isNaN(limit) || limit < 1 || limit > 30) {
    return NextResponse.json(
      { success: false, error: 'limit должен быть числом от 1 до 30' },
      { status: 400 },
    );
  }

  const result = getNewsDaysPaginated(page, limit, tag);

  return NextResponse.json({
    success: true,
    data: result.items,
    pagination: {
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
    },
    tags,
  });
}
