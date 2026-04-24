/**
 * @file page.tsx
 * @description Детальная страница статьи блога /blog/[slug]
 * @runs VDS (Next.js server-side, ISR revalidate=3600)
 * @lastModified 2026-04-24
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { CONTACTS } from "@/lib/constants";
import { readCatalogJson } from "@/lib/blobStorage";
import { mockCars } from "@/data/mockCars";
import CarCard from "@/components/catalog/CarCard";
import SocialFollow from "@/components/sections/SocialFollow";

// @rule Blog detail pages use ISR. `generateStaticParams` pre-renders
// known slugs at build time; unknown slugs (e.g. a fresh cron-generated
// MDX) are rendered on-demand then cached for `revalidate` seconds.
// Do not add `export const dynamic = 'force-dynamic'` — ISR is the
// intentional choice (ADR [2026-04-24] Blog ISR migration).
export const revalidate = 3600;

const countryLabel: Record<string, string> = {
  china: "🇨🇳 Китай",
  korea: "🇰🇷 Корея",
  japan: "🇯🇵 Япония",
};

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: { absolute: `${post.title} | Блог JCK AUTO` },
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      images: post.image ? [{ url: post.image }] : [],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const relatedPosts = allPosts.filter((p) => p.slug !== slug).slice(0, 3);

  let catalogCars = await readCatalogJson();
  if (catalogCars.length === 0) catalogCars = mockCars;
  const shuffled = [...catalogCars].sort(() => Math.random() - 0.5);
  const previewCars = shuffled.slice(0, 3);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    ...(post.image ? { image: post.image } : {}),
    author: { "@type": "Organization", name: "JCK AUTO" },
  };

  return (
    <div className="min-h-screen bg-white pb-20 pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <article className="mx-auto max-w-3xl px-4">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к статьям
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <time>
            {new Date(post.date).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
          <span>&bull;</span>
          <span>{post.readingTime}</span>
          <span>&bull;</span>
          <span>{post.author}</span>
          <span className="rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-medium">
            {countryLabel[post.country]}
          </span>
        </div>

        <h1 className="mt-4 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
          {post.title}
        </h1>

        {post.image && (
          <div className="relative mt-8 aspect-[2/1] w-full overflow-hidden rounded-xl">
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="prose mt-8 max-w-none sm:prose-lg prose-headings:font-heading">
          <MDXRemote source={post.content} />
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-surface-alt p-6 text-center sm:mt-16 sm:p-8">
          <h2 className="font-heading text-xl font-bold text-text">
            Хотите привезти автомобиль?
          </h2>
          <p className="mt-2 text-text-muted">
            Рассчитайте стоимость или свяжитесь с нами
          </p>
          <div className="mt-6 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/calculator"
              className="rounded-xl bg-secondary px-8 py-3 font-medium text-white transition-colors hover:bg-secondary-hover"
            >
              Рассчитать стоимость
            </Link>
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-8 py-3 font-medium text-white transition-colors hover:bg-[#229ED9]"
            >
              <Send className="h-4 w-4" />
              Написать в Telegram
            </a>
          </div>
        </div>

        {previewCars.length > 0 && (
          <section className="mt-16 border-t border-border pt-12">
            <h2 className="mb-8 font-heading text-xl font-bold text-text sm:text-2xl">
              Автомобили в наличии
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              {previewCars.map((car, i) => (
                <CarCard key={car.id} car={car} index={i} />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-primary px-8 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Смотреть все
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}

        {relatedPosts.length > 0 && (
          <section className="mt-16 border-t border-border pt-12">
            <h2 className="mb-8 font-heading text-xl font-semibold text-text sm:text-2xl">
              Читайте также
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((related) => (
                <Link
                  href={`/blog/${related.slug}`}
                  key={related.slug}
                  className="group overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
                >
                  {related.image && (
                    <div className="relative aspect-[2/1] overflow-hidden">
                      <Image
                        src={related.image}
                        alt={related.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="line-clamp-2 font-heading font-semibold text-text transition-colors group-hover:text-primary">
                      {related.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-sm text-text-muted">
                      {related.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <div className="mt-16">
        <SocialFollow />
      </div>
    </div>
  );
}
