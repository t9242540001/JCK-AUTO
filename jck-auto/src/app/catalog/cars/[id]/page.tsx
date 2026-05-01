import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Calculator, ChevronRight } from "lucide-react";
import { readCatalogJson } from "@/lib/blobStorage";
import { mockCars } from "@/data/mockCars";
import {
  formatPrice,
  getCountryGenitive,
  cleanBrand,
} from "@/lib/carUtils";
import CarGallery from "@/components/catalog/CarGallery";
import CarSpecs from "@/components/catalog/CarSpecs";
import CarTrustBlock from "@/components/catalog/CarTrustBlock";
import CarCard from "@/components/catalog/CarCard";
import CarSidebarActions from "@/components/catalog/CarSidebarActions";
import CarCtaActions from "@/components/catalog/CarCtaActions";
import SocialFollow from "@/components/sections/SocialFollow";
import LeadFormTrigger from "@/components/LeadFormTrigger";

const DELIVERY_CITY: Record<string, string> = {
  china: "Уссурийска",
  korea: "Владивостока",
  japan: "Владивостока",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

// RULE: getAllCars must stay wrapped in React cache() — page.tsx
// calls it twice per request (generateMetadata + page component)
// and force-dynamic means each request runs both. Without cache(),
// catalog.json is read from disk twice (~275ms each = ~550ms
// redundant I/O per request). cache() deduplicates within a single
// request lifecycle. See ADR [2026-04-29] Car detail audit CD-2.
const getAllCars = cache(async () => {
  const blobCars = await readCatalogJson();
  return blobCars.length > 0 ? blobCars : mockCars;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const cars = await getAllCars();
  const car = cars.find((c) => c.id === id);
  if (!car) return { title: "Автомобиль не найден | JCK AUTO" };

  const brand = cleanBrand(car.brand);
  const countryGen = getCountryGenitive(car.country);
  const priceStr = car.priceRub
    ? `≈ ${car.priceRub.toLocaleString("ru-RU")} ₽`
    : formatPrice(car.price, car.currency);

  return {
    title: `${brand} ${car.model} ${car.year} — купить из ${countryGen} | JCK AUTO`,
    description: `${brand} ${car.model} ${car.year}, ${car.engineVolume} ${car.transmission}, ${car.mileage > 0 ? `${car.mileage.toLocaleString("ru-RU")} км` : "новый"}. Цена ${priceStr}. Доставка из ${countryGen} под ключ с гарантией до 2 лет.`,
    keywords: [
      `купить ${brand} ${car.model}`,
      `${brand} ${car.model} из ${countryGen}`,
      `импорт ${brand} ${car.model}`,
      `${brand} ${car.model} ${car.year} цена`,
    ],
    openGraph: {
      title: `${brand} ${car.model} ${car.year} — купить из ${countryGen} | JCK AUTO`,
      description: `${brand} ${car.model} ${car.year}, ${car.engineVolume} ${car.transmission}, ${car.mileage > 0 ? `${car.mileage.toLocaleString("ru-RU")} км` : "новый"}. Цена ${priceStr}. Доставка из ${countryGen} под ключ с гарантией до 2 лет.`,
      images: car.photos.length > 0
        ? [{ url: car.photos[0], width: 800, height: 600, alt: `${brand} ${car.model} ${car.year}` }]
        : [{ url: "/images/og-image.jpg", width: 1200, height: 630, alt: "JCK AUTO" }],
    },
    alternates: {
      canonical: `https://jckauto.ru/catalog/cars/${id}`,
    },
  };
}

export default async function CarDetailPage({ params }: PageProps) {
  const { id } = await params;
  const cars = await getAllCars();
  const car = cars.find((c) => c.id === id);
  if (!car) notFound();

  const otherCars = cars
    .filter((c) => c.id !== car.id)
    .slice(0, 3);

  const brand = cleanBrand(car.brand);
  const countryGen = getCountryGenitive(car.country);

  function truncateForSchema(text: string, maxLen: number): string {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLen) return normalized;
    const sliced = normalized.slice(0, maxLen);
    const lastSpace = sliced.lastIndexOf(" ");
    return lastSpace > 0 ? sliced.slice(0, lastSpace) + "…" : sliced + "…";
  }

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: `${brand} ${car.model} ${car.year}`,
    description: car.description
      ? truncateForSchema(car.description, 300)
      : `${brand} ${car.model} ${car.year}, ${car.engineVolume}L ${car.transmission}`,
    image: car.photos[0] || "",
    brand: { "@type": "Brand", name: brand },
    model: car.model,
    vehicleModelDate: String(car.year),
    // Vehicle-specific fields (Schema.org Vehicle subtype). Drivetrain
    // and engine power deferred to CD-DEBT-1 due to enum/unit ambiguity.
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: car.mileage,
      unitCode: "KMT",
    },
    vehicleEngine: {
      "@type": "EngineSpecification",
      fuelType: car.fuelType,
      engineDisplacement: {
        "@type": "QuantitativeValue",
        value: car.engineVolume,
        unitCode: "LTR",
      },
    },
    vehicleTransmission: car.transmission === "AT" ? "Automatic" : "Manual",
    bodyType: car.bodyType,
    color: car.color,
    offers: {
      "@type": "Offer",
      price: car.priceRub || car.price,
      priceCurrency: car.priceRub ? "RUB" : car.currency,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "JCK AUTO" },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Главная",
        item: "https://jckauto.ru",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Каталог",
        item: "https://jckauto.ru/catalog",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${brand} ${car.model} ${car.year}`,
        item: `https://jckauto.ru/catalog/cars/${car.id}`,
      },
    ],
  };

  return (
    <div className="bg-white pb-12 pt-24 sm:pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="mx-auto max-w-7xl px-4">
        {/* Breadcrumbs */}
        <nav className="flex min-w-0 items-center gap-1 text-sm text-text-muted overflow-hidden">
          <Link href="/" className="shrink-0 transition-colors hover:text-primary">
            Главная
          </Link>
          <ChevronRight className="shrink-0 h-3.5 w-3.5" />
          <Link
            href="/catalog"
            className="shrink-0 transition-colors hover:text-primary"
          >
            Каталог
          </Link>
          <ChevronRight className="shrink-0 h-3.5 w-3.5" />
          <span className="truncate min-w-0 text-text">
            {cleanBrand(car.brand)} {car.model} {car.year}
          </span>
        </nav>

        {/* Main content: Gallery + Info */}
        <div className="mt-6 grid gap-8 lg:grid-cols-5">
          {/* Gallery — 3/5 width on desktop */}
          {/* RULE: min-w-0 required — grid item default min-width is auto
              (= min-content), which lets child flex/scroll containers
              expand the parent past viewport. CarGallery thumbs row uses
              overflow-x-auto + flex-shrink-0 — without min-w-0 here the
              thumbs row stretches the grid, the grid stretches the body,
              and the entire page overflows on mobile. See R-FE-3 in
              rules.md. */}
          <div className="min-w-0 lg:col-span-3">
            <CarGallery
              photos={car.photos}
              alt={`${cleanBrand(car.brand)} ${car.model} ${car.year}`}
            />
          </div>

          {/* Info sidebar — 2/5 width on desktop */}
          {/* RULE: min-w-0 required — same reason as the gallery column.
              Long testimonial-style text with [overflow-wrap:anywhere]
              relies on this. See R-FE-3 in rules.md. */}
          <div className="min-w-0 lg:col-span-2">
            <h1 className="mt-3 font-heading text-2xl font-bold text-text sm:text-3xl break-words [overflow-wrap:anywhere]">
              {car.folderName.replace(/^Used\s+/i, "")}
            </h1>

            {car.priceRub ? (
              <div className="mt-4">
                <p className="font-heading text-2xl font-bold text-primary sm:text-3xl lg:text-4xl">
                  ≈ {car.priceRub.toLocaleString("ru-RU")} ₽<sup className="text-xs text-gray-400 ml-0.5">*</sup>
                </p>
              </div>
            ) : car.price > 0 ? (
              <p className="mt-4 font-heading text-2xl font-bold text-primary sm:text-3xl lg:text-4xl">
                {formatPrice(car.price, car.currency)}
              </p>
            ) : (
              <div className="mt-4">
                <p className="font-heading text-xl font-bold text-text sm:text-2xl">
                  Цена по запросу
                </p>
                <div className="mt-3">
                  <LeadFormTrigger
                    subject="Узнать цену"
                    triggerLabel="Узнать цену"
                    ctaLabel="Отправить заявку"
                    modalTitle="Узнать стоимость автомобиля"
                    triggerVariant="primary"
                  />
                </div>
              </div>
            )}

            {car.description && car.description.length > 100 && (
              <div className="mt-4 rounded-xl bg-gray-50 p-4">
                <p className="mb-1 text-sm font-medium text-gray-900">Описание</p>
                <div className="space-y-3 text-sm leading-relaxed text-text-muted break-words">
                  {car.description.split("\n\n").map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {car.description && car.description.length <= 100 && (
              <p className="mt-4 text-text-muted break-words">{car.description}</p>
            )}

            {car.condition && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm text-gray-600 break-words">
                Отметки: {car.condition}
              </div>
            )}

            <div className="mt-5 space-y-2">
              <p className="text-sm font-medium text-gray-900">Что входит в стоимость:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-[#C9A84C] mt-0.5">✓</span>
                  <span>Стоимость автомобиля</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#C9A84C] mt-0.5">✓</span>
                  <span>Таможенное оформление</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#C9A84C] mt-0.5">✓</span>
                  <span>Единый таможенный сбор</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#C9A84C] mt-0.5">✓</span>
                  <span>Утилизационный сбор</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#C9A84C] mt-0.5">✓</span>
                  <span>СБКТС и ЭПТС</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#C9A84C] mt-0.5">✓</span>
                  <span>Доставка до {DELIVERY_CITY[car.country] || "Владивостока"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#C9A84C] mt-0.5">✓</span>
                  <span>Услуги компании</span>
                </li>
              </ul>
            </div>

            <p className="mt-4 text-xs text-gray-400 leading-relaxed break-words">
              * Цена может измениться как в меньшую, так и в большую сторону в зависимости от курса валют и других факторов. Точную стоимость уточняйте у менеджера.
            </p>

            <CarSidebarActions carName={`${brand} ${car.model} ${car.year}`} />
          </div>
        </div>

        {/* Specs */}
        <section className="mt-12">
          <h2 className="font-heading text-xl font-bold text-text sm:text-2xl">
            Характеристики
          </h2>
          <div className="mt-6">
            <CarSpecs car={car} />
          </div>
        </section>

        {/* Features */}
        {car.features.length > 0 && (
          <section className="mt-12">
            <h2 className="font-heading text-xl font-bold text-text sm:text-2xl">
              Оснащение
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {car.features.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-text"
                >
                  {f}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Trust block */}
        <section className="mt-12">
          <CarTrustBlock />
        </section>

        {/* Wholesale CTA */}
        <section className="mt-12 rounded-2xl bg-surface p-6 md:p-10">
          <h2 className="font-heading text-2xl font-bold text-text">
            Для оптовых покупателей
          </h2>
          <p className="mt-2 text-text-muted">
            Закупаете несколько автомобилей или работаете как посредник?
            Подберём любой автомобиль у мировых производителей и согласуем
            индивидуальные условия в зависимости от объёма.
          </p>
          <div className="mt-6">
            <LeadFormTrigger
              subject="Оптовые условия — автомобили"
              triggerLabel="Узнать условия"
              ctaLabel="Отправить заявку"
              modalTitle="Условия для оптовых покупателей"
              triggerVariant="outline"
            />
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-2xl bg-primary p-6 text-center text-white sm:p-10">
          <h2 className="font-heading text-xl font-bold sm:text-2xl">
            Хотите этот автомобиль?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-base text-white/80 sm:text-lg">
            Напишите нам — рассчитаем точную стоимость доставки под ключ
          </p>
          <div className="mt-6 space-y-4">
            <Link
              href="/calculator"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 sm:px-8 sm:py-4 sm:text-base"
            >
              <Calculator className="h-5 w-5" />
              Рассчитать на калькуляторе
            </Link>
            <CarCtaActions carName={`${brand} ${car.model} ${car.year}`} />
          </div>
        </section>

        {/* Other cars */}
        {otherCars.length > 0 && (
          <section className="mt-12 border-t border-border pt-12">
            <h2 className="font-heading text-xl font-bold text-text sm:text-2xl">
              Другие автомобили
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {otherCars.map((c, i) => (
                <CarCard key={c.id} car={c} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>

      <SocialFollow />
    </div>
  );
}
