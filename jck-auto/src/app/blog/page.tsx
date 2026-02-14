import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: {
    absolute:
      "Блог JCK AUTO — гайды по импорту авто из Китая, Кореи и Японии",
  },
  description:
    "Полезные статьи об импорте автомобилей из Азии: растаможка, выбор авто, обзоры моделей, изменения законодательства, советы покупателям.",
  keywords:
    "блог импорт авто, статьи растаможка, обзоры китайских авто, как привезти авто из Японии, импорт автомобилей гайд",
};

const countryBadge: Record<string, { label: string; className: string }> = {
  china: { label: "Китай", className: "bg-china/10 text-china" },
  korea: { label: "Корея", className: "bg-korea/10 text-korea" },
  japan: { label: "Япония", className: "bg-japan/10 text-japan" },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-white pb-20 pt-28">
      <div className="mx-auto max-w-4xl px-4">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Блог
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-text md:text-4xl">
            Полезные статьи об импорте
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
            Разбираем процесс, законодательство и развеиваем мифы
          </p>
        </div>

        <div className="mt-12 space-y-6">
          {posts.map((post) => {
            const badge = countryBadge[post.country];
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col gap-6 rounded-2xl border border-border bg-white p-6 transition-all hover:shadow-md md:flex-row"
              >
                {post.image ? (
                  <div className="relative w-full shrink-0 overflow-hidden rounded-xl md:w-48">
                    <div className="aspect-[2/1] md:h-32 md:aspect-auto">
                      <Image
                        src={post.image}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-32 w-full shrink-0 items-center justify-center rounded-xl bg-border/50 text-4xl md:w-48">
                    📷
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <time>
                      {new Date(post.date).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                    <span>&bull;</span>
                    <span>{post.readingTime}</span>
                    {badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 font-heading text-lg font-bold text-text transition-colors group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-text-muted">
                    {post.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-surface-alt px-2.5 py-0.5 text-xs text-text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {posts.length === 0 && (
          <p className="mt-12 text-center text-text-muted">
            Статьи скоро появятся. Следите за обновлениями!
          </p>
        )}
      </div>
    </div>
  );
}
