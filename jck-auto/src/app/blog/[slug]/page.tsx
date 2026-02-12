import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { CONTACTS } from "@/lib/constants";
import { notFound } from "next/navigation";

const COUNTRY_FLAGS: Record<string, { flag: string; label: string }> = {
  china: { flag: "\u{1F1E8}\u{1F1F3}", label: "Китай" },
  korea: { flag: "\u{1F1F0}\u{1F1F7}", label: "Корея" },
  japan: { flag: "\u{1F1EF}\u{1F1F5}", label: "Япония" },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Статья не найдена | JCK AUTO" };

  return {
    title: `${post.title} | JCK AUTO`,
    description: post.description,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const country = COUNTRY_FLAGS[post.country];

  return (
    <main className="pt-28 pb-20 bg-white">
      <article className="max-w-3xl mx-auto px-4">
        <Link
          href="/blog"
          className="text-sm text-text-muted hover:text-primary flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={14} />
          Назад к статьям
        </Link>

        <div className="mt-6 flex items-center gap-3 text-sm text-text-muted">
          <span>{formatDate(post.date)}</span>
          <span>{post.author}</span>
          <span>{post.readingTime}</span>
          {country && (
            <span className="bg-surface-alt rounded-full px-2 py-0.5 text-xs">
              {country.flag} {country.label}
            </span>
          )}
        </div>

        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-text font-heading">
          {post.title}
        </h1>

        <p className="mt-4 text-lg text-text-muted">{post.description}</p>

        <div className="border-t border-border mt-8 pt-8">
          <div className="prose prose-lg max-w-none prose-headings:font-semibold prose-headings:text-text prose-p:text-text-muted prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-text prose-li:text-text-muted">
            <MDXRemote source={post.content} />
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <div className="bg-surface-alt rounded-2xl p-8 text-center">
            <p className="text-xl font-bold text-text">
              Хотите привезти автомобиль?
            </p>
            <div className="mt-4 flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/calculator"
                className="inline-flex items-center justify-center rounded-xl bg-primary text-white px-6 py-3 text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                Рассчитать стоимость
              </Link>
              <Link
                href={CONTACTS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-white text-text px-6 py-3 text-sm font-medium hover:border-primary/30 hover:text-primary transition-colors"
              >
                Написать нам
              </Link>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
