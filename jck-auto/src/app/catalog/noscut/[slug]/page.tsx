import type { Metadata } from "next";
import fs from "fs";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock } from "lucide-react";
import NoscutDelivery from "@/components/noscut/NoscutDelivery";
import NoModelFound from "@/components/noscut/NoModelFound";
import LeadForm from "@/components/LeadForm";
import LeadFormTrigger from "@/components/LeadFormTrigger";

export const revalidate = 3600;

// ─── TYPES ────────────────────────────────────────────────────────────────

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

// ─── DATA ─────────────────────────────────────────────────────────────────

const CATALOG_PATH = "/var/www/jckauto/storage/noscut/noscut-catalog.json";

const COUNTRY_BG: Record<string, string> = {
  china: "bg-china",
  korea: "bg-korea",
  japan: "bg-japan",
};

const COUNTRY_FLAG: Record<string, string> = {
  japan: "\u{1F1EF}\u{1F1F5}",
  korea: "\u{1F1F0}\u{1F1F7}",
  china: "\u{1F1E8}\u{1F1F3}",
};

const COUNTRY_LABEL: Record<string, string> = {
  japan: "Япония",
  korea: "Корея",
  china: "Китай",
};

function loadCatalog(): NoscutEntry[] {
  try {
    const raw = fs.readFileSync(CATALOG_PATH, "utf-8");
    return JSON.parse(raw) as NoscutEntry[];
  } catch {
    return [];
  }
}

// ─── METADATA ─────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = loadCatalog().find((e) => e.slug === slug);
  if (!entry) return { title: "Ноускат не найден | JCK AUTO" };

  const title = `${entry.make} ${entry.model} ${entry.generation} — ноускат из Азии | JCK AUTO`;
  const descriptionShort = entry.description.slice(0, 150);
  const description = `${descriptionShort}. Поставка 30 дней, от ${entry.priceFrom.toLocaleString("ru-RU")} ₽.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://jckauto.ru/catalog/noscut/${slug}`,
      images: entry.image
        ? [{ url: `https://jckauto.ru${entry.image}`, width: 1024, height: 768 }]
        : undefined,
    },
    alternates: {
      canonical: `https://jckauto.ru/catalog/noscut/${slug}`,
    },
  };
}

// ─── PAGE ─────────────────────────────────────────────────────────────────

export default async function NoscutDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = loadCatalog().find((e) => e.slug === slug);
  if (!entry) notFound();

  const fullName = `${entry.make} ${entry.model} ${entry.generation}`;
  const subject = `${fullName} ноускат`;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: subject,
    description: entry.description,
    image: `https://jckauto.ru${entry.image}`,
    brand: { "@type": "Brand", name: entry.make },
    offers: {
      "@type": "Offer",
      price: entry.priceFrom,
      priceCurrency: "RUB",
      availability: entry.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      seller: { "@type": "Organization", name: "JCK AUTO" },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: "https://jckauto.ru/" },
      { "@type": "ListItem", position: 2, name: "Каталог", item: "https://jckauto.ru/catalog" },
      { "@type": "ListItem", position: 3, name: "Ноускаты", item: "https://jckauto.ru/catalog/noscut" },
      { "@type": "ListItem", position: 4, name: fullName, item: `https://jckauto.ru/catalog/noscut/${slug}` },
    ],
  };

  const savings =
    entry.marketPriceRu && entry.marketPriceRu > entry.priceFrom
      ? Math.round((1 - entry.priceFrom / entry.marketPriceRu) * 100)
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="bg-white pb-12 pt-24 sm:pb-16">
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
            <Link href="/catalog/noscut" className="transition-colors hover:text-primary">
              Ноускаты
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-text">{fullName}</span>
          </nav>

          {/* Main layout */}
          <div className="mt-6 grid gap-8 lg:grid-cols-5">
            {/* Left — Image */}
            <div className="lg:col-span-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
                <Image
                  src={entry.image}
                  alt={`${fullName} ноускат`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  priority
                />
              </div>
            </div>

            {/* Right — Info sidebar */}
            <div className="lg:col-span-2">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium text-white ${COUNTRY_BG[entry.country] ?? "bg-gray-500"}`}
                >
                  {COUNTRY_FLAG[entry.country]} {COUNTRY_LABEL[entry.country]}
                </span>
                {entry.inStock && (
                  <span className="rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
                    В наличии
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="mt-3 font-heading text-2xl font-bold text-text sm:text-3xl">
                {fullName}
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                {entry.yearStart}–{entry.yearEnd}
              </p>

              {/* Price */}
              <div className="mt-4">
                <p className="font-heading text-3xl font-bold text-primary">
                  от {entry.priceFrom.toLocaleString("ru-RU")} ₽
                </p>
                {entry.marketPriceRu && entry.marketPriceRu > entry.priceFrom && (
                  <p className="mt-1 text-sm text-text-muted">
                    Рынок: ~{entry.marketPriceRu.toLocaleString("ru-RU")} ₽
                    {savings && (
                      <span className="ml-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Экономия ~{savings}%
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Delivery term */}
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface px-4 py-3">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-medium text-text">Срок поставки: ~30 дней</span>
              </div>

              {/* Components */}
              <div className="mt-6">
                <h3 className="font-heading text-lg font-bold text-text">Состав комплекта</h3>
                <ul className="mt-2 space-y-1">
                  {entry.components.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-sm text-text-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              {/* VIN disclaimer */}
              <p className="mt-4 text-xs text-text-muted">
                Совместимость уточняется по VIN-номеру автомобиля
              </p>

              {/* Lead form */}
              <div className="mt-6">
                <LeadForm subject={subject} ctaLabel="Заказать ноускат" />
              </div>
            </div>
          </div>

          {/* Description */}
          {entry.description && (
            <section className="mt-12">
              <h2 className="font-heading text-2xl font-bold text-text">Описание</h2>
              <p className="mt-4 leading-relaxed text-text-muted">{entry.description}</p>
            </section>
          )}

          {/* Delivery */}
          <NoscutDelivery />

          {/* Wholesale CTA */}
          <section className="mt-12 rounded-2xl bg-surface p-6 md:p-10">
            <h2 className="font-heading text-2xl font-bold text-text">Для оптовых покупателей</h2>
            <p className="mt-2 text-text-muted">
              Поставляем от одного ноуската до контейнерных партий. Подберём любую модель
              из Азии — не только то, что есть в каталоге. Цена зависит от объёма и обсуждается персонально.
            </p>
            <div className="mt-6">
              <LeadFormTrigger
                subject="Оптовые условия"
                triggerLabel="Узнать условия"
                ctaLabel="Отправить заявку"
                modalTitle="Условия для оптовых покупателей"
                triggerVariant="outline"
              />
            </div>
          </section>

          {/* Not found block */}
          <NoModelFound />
        </div>
      </div>
    </>
  );
}
