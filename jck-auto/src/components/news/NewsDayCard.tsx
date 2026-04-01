/**
 * @file NewsDayCard.tsx
 * @description Компактная карточка-превью дня новостей для каталога
 * @lastModified 2026-04-01
 */

import Image from 'next/image';
import Link from 'next/link';
import { getTagStyle } from '@/lib/newsTagColors';
import type { NewsDayPreview } from '@/services/news/reader';

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function NewsDayCard({ preview }: { preview: NewsDayPreview }) {
  return (
    <Link
      href={`/news/${preview.slug}`}
      className="group flex flex-col gap-6 rounded-2xl border border-border bg-white p-6 transition-all hover:shadow-md md:flex-row"
    >
      {preview.coverImagePath ? (
        <div className="relative w-full shrink-0 overflow-hidden rounded-xl md:w-48">
          <div className="aspect-[2/1] md:h-32 md:aspect-auto">
            <Image
              src={preview.coverImagePath}
              alt={preview.mainStoryTitle}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        </div>
      ) : (
        <div className="flex h-32 w-full shrink-0 items-center justify-center rounded-xl bg-border/50 text-4xl md:w-48">
          📰
        </div>
      )}
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <time>{formatDate(preview.date)}</time>
          {preview.digestCount > 0 && (
            <>
              <span>&bull;</span>
              <span>ещё {preview.digestCount} {preview.digestCount === 1 ? 'новость' : preview.digestCount < 5 ? 'новости' : 'новостей'}</span>
            </>
          )}
        </div>
        <h2 className="mt-2 font-heading text-lg font-bold text-text transition-colors group-hover:text-primary">
          {preview.mainStoryTitle}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm text-text-muted">
          {preview.mainStoryExcerpt}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {preview.mainStoryTags.map((t) => (
            <span
              key={t}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getTagStyle(t)}`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
