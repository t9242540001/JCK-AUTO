import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// @rule: Add any new /catalog/* subcategory segments to EXCLUDED_SEGMENTS
//        to prevent them from being redirected to /catalog/cars/*
const EXCLUDED_SEGMENTS = new Set(['noscut', 'cars']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const match = pathname.match(/^\/catalog\/([^/]+)$/);
  if (match) {
    const segment = match[1];
    if (!EXCLUDED_SEGMENTS.has(segment)) {
      const url = request.nextUrl.clone();
      url.pathname = `/catalog/cars/${segment}`;
      return NextResponse.redirect(url, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/catalog/:path*',
};
