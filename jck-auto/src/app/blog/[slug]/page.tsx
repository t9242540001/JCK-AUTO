import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { ArrowLeft, Send } from "lucide-react";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { CONTACTS } from "@/lib/constants";

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
    title: post.title,
    description: post.description,
    openGraph: {
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

  return (
    <div className="min-h-screen bg-white pb-20 pt-28">
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

        <h1 className="mt-4 font-heading text-3xl font-bold text-text md:text-4xl">
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

        <div className="prose prose-lg mt-8 max-w-none prose-headings:font-heading prose-headings:text-text prose-p:text-text-muted prose-a:text-primary prose-strong:text-text prose-li:text-text-muted">
          <MDXRemote source={post.content} />
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-surface-alt p-8 text-center">
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
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-primary px-8 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white"
            >
              <Send className="h-4 w-4" />
              Написать в Telegram
            </a>
          </div>
        </div>

        {relatedPosts.length > 0 && (
          <section className="mt-16 border-t border-gray-200 pt-12">
            <h2 className="mb-8 text-2xl font-bold text-[#1E3A5F]">
              Читайте также
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {relatedPosts.map((related) => (
                <Link
                  href={`/blog/${related.slug}`}
                  key={related.slug}
                  className="group"
                >
                  {related.image && (
                    <div className="relative mb-3 aspect-[2/1] overflow-hidden rounded-lg">
                      <Image
                        src={related.image}
                        alt={related.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <h3 className="line-clamp-2 font-semibold text-[#1E3A5F] transition-colors group-hover:text-[#C9A84C]">
                    {related.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                    {related.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
