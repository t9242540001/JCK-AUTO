import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Блог | JCK AUTO",
  description:
    "Полезные статьи об импорте автомобилей из Азии: гайды, обзоры, изменения законодательства",
};

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

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <main>
      <section className="pt-28 pb-8 bg-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-secondary uppercase tracking-wider text-sm font-medium">
            БЛОГ
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-bold text-text font-heading">
            Полезные статьи об импорте
          </h1>
          <p className="mt-4 text-text-muted text-lg">
            Гайды, обзоры автомобилей и актуальные изменения законодательства
          </p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          {posts.length === 0 ? (
            <p className="text-text-muted text-center">
              Скоро здесь появятся статьи
            </p>
          ) : (
            <div className="grid gap-6">
              {posts.map((post) => {
                const country = COUNTRY_FLAGS[post.country];
                return (
                  <Link key={post.slug} href={`/blog/${post.slug}`}>
                    <article className="bg-surface rounded-2xl border border-border p-6 hover:shadow-md hover:border-primary/30 transition-all duration-300">
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* TODO: Replace with next/image when photos ready */}
                        <div className="w-full md:w-48 h-32 rounded-xl bg-border/50 flex items-center justify-center flex-shrink-0">
                          <span className="text-3xl">{"\u{1F4F7}"}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 text-xs text-text-muted">
                            <span>{formatDate(post.date)}</span>
                            <span>{post.readingTime}</span>
                            {country && (
                              <span className="bg-surface-alt rounded-full px-2 py-0.5">
                                {country.flag} {country.label}
                              </span>
                            )}
                          </div>

                          <h2 className="mt-2 text-xl font-semibold text-text hover:text-primary transition-colors">
                            {post.title}
                          </h2>

                          <p className="mt-2 text-sm text-text-muted line-clamp-2">
                            {post.description}
                          </p>

                          <div className="mt-3 flex gap-2 flex-wrap">
                            {post.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs bg-primary/5 text-primary rounded-full px-3 py-1"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
