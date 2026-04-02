/**
 * @file articlePublisher.ts
 * @description Публикация сгенерированной статьи: сохранение MDX и обложки
 * @runs VDS (cron-скрипт)
 * @input GeneratedArticle от generator.ts, CoverResult от coverGenerator.ts
 * @output MDX в content/blog/, обложка в public/images/blog/
 * @rule YAML frontmatter строго совместим с существующими 32 статьями блога
 * @lastModified 2026-04-02
 */

import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import type { GeneratedArticle } from './generator';
import type { CoverResult } from '@/lib/coverGenerator';
import { updateTopicStatus } from './topicQueue';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface PublishArticleResult {
  mdxPath: string;
  imagePath: string | null;
  slug: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const PROJECT_ROOT = process.env.PROJECT_ROOT || '/var/www/jckauto/app/jck-auto';

// ─── HELPERS ──────────────────────────────────────────────────────────────

/** Сформировать YAML frontmatter совместимый с существующими статьями */
function buildFrontmatter(fm: GeneratedArticle['frontmatter']): string {
  const lines: string[] = [
    '---',
    `title: "${fm.title.replace(/"/g, '\\"')}"`,
    `description: "${fm.description.replace(/"/g, '\\"')}"`,
    `date: "${fm.date}"`,
    `author: "${fm.author}"`,
  ];

  if (fm.country) {
    lines.push(`country: "${fm.country}"`);
  }

  lines.push(`image: "${fm.image}"`);
  lines.push(`tags: [${fm.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`);
  lines.push('---');

  return lines.join('\n');
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────

/**
 * Опубликовать статью: сохранить MDX и обложку, обновить статус в semantic-core
 * @input article — от generator.ts, coverResult — от coverGenerator.ts (или null)
 * @output PublishArticleResult с путями
 * @writes content/blog/{slug}.mdx, public/images/blog/{slug}.jpg
 */
export async function publishArticle(
  article: GeneratedArticle,
  coverResult: CoverResult | null,
  topicId?: string,
): Promise<PublishArticleResult> {
  const mdxDir = join(PROJECT_ROOT, 'content', 'blog');
  const imageDir = join(PROJECT_ROOT, 'public', 'images', 'blog');
  mkdirSync(mdxDir, { recursive: true });
  mkdirSync(imageDir, { recursive: true });

  // Собрать MDX
  const frontmatter = buildFrontmatter(article.frontmatter);
  const mdxContent = `${frontmatter}\n\n${article.content}\n`;
  const mdxPath = join(mdxDir, `${article.slug}.mdx`);

  if (existsSync(mdxPath)) {
    console.log(`[articlePublisher] Перезаписываем существующую статью: ${article.slug}`);
  }

  writeFileSync(mdxPath, mdxContent, 'utf-8');
  console.log(`[articlePublisher] MDX сохранён: ${mdxPath}`);

  // Обложка
  let imagePath: string | null = null;
  if (coverResult) {
    const destPath = join(imageDir, `${article.slug}.jpg`);
    try {
      copyFileSync(coverResult.imagePath, destPath);
      imagePath = destPath;
      console.log(`[articlePublisher] Обложка скопирована: ${destPath}`);
    } catch (err) {
      console.warn(`[articlePublisher] Не удалось скопировать обложку: ${err}`);
    }
  }

  // Обновить статус темы (если передан topicId)
  if (topicId) {
    updateTopicStatus(topicId, 'published', article.frontmatter.date);
  }

  console.log(`[articlePublisher] Статья опубликована: ${article.slug} (${article.wordCount} слов)`);

  return { mdxPath, imagePath, slug: article.slug };
}
