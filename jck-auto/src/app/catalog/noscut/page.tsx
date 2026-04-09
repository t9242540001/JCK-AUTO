import type { Metadata } from "next";
import fs from "fs";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import NoscutGrid from "@/components/noscut/NoscutGrid";
import NoscutDelivery from "@/components/noscut/NoscutDelivery";
import NoModelFound from "@/components/noscut/NoModelFound";

export const revalidate = 3600;

interface NoscutEntry {
  slug: string;
  make: string;
  model: string;
  generation: string;
  yearStart: number;
  yearEnd: number;
  country: string;
  priceFrom: number;
  inStock: boolean;
  components: string[];
  description: string;
  image: string;
  marketPriceRu: number | null;
  updatedAt: string;
}

const CATALOG_PATH = "/var/www/jckauto/storage/noscut/noscut-catalog.json";

function loadCatalog(): NoscutEntry[] {
  try {
    const raw = fs.readFileSync(CATALOG_PATH, "utf-8");
    return JSON.parse(raw) as NoscutEntry[];
  } catch {
    return [];
  }
}

export function generateMetadata(): Metadata {
  return {
    title: "Ноускаты на японские, корейские и китайские авто — JCK AUTO",
    description:
      "Комплекты ноускатов для 100+ моделей из Азии. Поставка 30 дней, цена от 199 000 ₽. Оптовые условия для СТО.",
    openGraph: {
      title: "Ноускаты на японские, корейские и китайские авто — JCK AUTO",
      description:
        "Комплекты ноускатов для 100+ моделей из Азии. Поставка 30 дней, цена от 199 000 ₽.",
      url: "https://jckauto.ru/catalog/noscut",
    },
    alternates: {
      canonical: "https://jckauto.ru/catalog/noscut",
    },
  };
}

const COUNTRY_LABELS: Record<string, string> = {
  japan: "Япония",
  korea: "Корея",
  china: "Китай",
};

interface PageProps {
  searchParams: Promise<{ make?: string; country?: string; sort?: string }>;
}

export default async function NoscutCatalogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const all = loadCatalog();

  if (all.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-lg text-text-muted">Каталог формируется</p>
      </div>
    );
  }

  // Collect unique makes for filter dropdown
  const uniqueMakes = [...new Set(all.map((e) => e.make))].sort();

  // Apply filters
  let filtered = all;
  if (params.make) {
    const makeLower = params.make.toLowerCase();
    filtered = filtered.filter((e) => e.make.toLowerCase() === makeLower);
  }
  if (params.country) {
    filtered = filtered.filter((e) => e.country === params.country);
  }

  // Apply sort
  if (params.sort === "price-asc") {
    filtered = [...filtered].sort((a, b) => a.priceFrom - b.priceFrom);
  } else if (params.sort === "price-desc") {
    filtered = [...filtered].sort((a, b) => b.priceFrom - a.priceFrom);
  } else if (params.sort === "newest") {
    filtered = [...filtered].sort((a, b) => b.yearEnd - a.yearEnd);
  }

  const activeFilterCount = [params.make, params.country, params.sort].filter(Boolean).length;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: "https://jckauto.ru/" },
      { "@type": "ListItem", position: 2, name: "Каталог", item: "https://jckauto.ru/catalog" },
      { "@type": "ListItem", position: 3, name: "Ноускаты", item: "https://jckauto.ru/catalog/noscut" },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Hero */}
      <section className="bg-surface pb-10 pt-28 sm:pb-16">
        <div className="mx-auto max-w-7xl px-4">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-sm text-text-muted">
            <Link href="/" className="transition-colors hover:text-primary">
              Главная
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/catalog" className="transition-colors hover:text-primary">
              Каталог
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-text">Ноускаты</span>
          </nav>

          <h1 className="mt-4 text-center font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl lg:text-5xl">
            Ноускаты из Азии
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-center text-base text-text-muted sm:text-lg">
            Комплект деталей передней части — бампер, оптика, радиатор, телевизор, датчики,
            камера. Поставка под заказ ~30 дней. Цена в 2–3 раза ниже российского рынка.
          </p>
        </div>
      </section>

      {/* Filters + Grid */}
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4">
          {/* Filter bar */}
          <form action="/catalog/noscut" method="get" className="mb-8 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="make" className="mb-1 block text-xs font-medium text-text-muted">
                Марка
              </label>
              <select
                id="make"
                name="make"
                defaultValue={params.make ?? ""}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Все марки</option>
                {uniqueMakes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="country" className="mb-1 block text-xs font-medium text-text-muted">
                Страна
              </label>
              <select
                id="country"
                name="country"
                defaultValue={params.country ?? ""}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Все страны</option>
                {Object.entries(COUNTRY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sort" className="mb-1 block text-xs font-medium text-text-muted">
                Сортировка
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={params.sort ?? ""}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">По умолчанию</option>
                <option value="price-asc">Сначала дешевле</option>
                <option value="price-desc">Сначала дороже</option>
                <option value="newest">Сначала новее</option>
              </select>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Применить
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <Link
                href="/catalog/noscut"
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-gray-50"
              >
                Сбросить
              </Link>
            )}
          </form>

          {/* Results */}
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-text-muted">
              Ничего не найдено. Попробуйте изменить фильтры.
            </p>
          ) : (
            <NoscutGrid entries={filtered} />
          )}

          <NoscutDelivery />
          <NoModelFound />
        </div>
      </section>
    </>
  );
}
