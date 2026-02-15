import { readCatalogJson } from "@/lib/blobStorage";
import { mockCars } from "@/data/mockCars";
import CatalogClient from "@/components/catalog/CatalogClient";

export default async function CatalogPage() {
  // Try Blob first, fall back to mock data
  let cars = await readCatalogJson();
  if (cars.length === 0) {
    cars = mockCars;
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-surface pb-10 pt-28 sm:pb-16">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Каталог
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl lg:text-5xl">
            Автомобили в наличии
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-text-muted sm:text-lg">
            Выберите автомобиль — мы доставим его под ключ с гарантией до 2 лет
          </p>
        </div>
      </section>

      {/* Filters + Grid */}
      <section className="bg-white py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <CatalogClient cars={cars} />
        </div>
      </section>
    </>
  );
}
