import type { Metadata } from "next";
import { readCatalogJson } from "@/lib/blobStorage";
import { mockCars } from "@/data/mockCars";
import CatalogClient from "@/components/catalog/CatalogClient";
import SocialFollow from "@/components/sections/SocialFollow";

export const metadata: Metadata = {
  title: "Каталог автомобилей из Китая — цены под ключ в рублях",
  description:
    "Автомобили из Китая, Кореи и Японии в наличии. Цена под ключ в рублях с доставкой и растаможкой. Гарантия ВСК до 2 лет.",
  keywords:
    "купить авто из Китая, каталог авто из Японии, авто в наличии, цена под ключ",
  openGraph: {
    title: "Каталог автомобилей — JCK AUTO",
    description:
      "Авто из Китая, Кореи и Японии в наличии с ценой под ключ в рублях.",
    url: "https://jckauto.ru/catalog",
  },
  alternates: {
    canonical: "https://jckauto.ru/catalog",
  },
};

export const revalidate = 3600;

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

      <SocialFollow />
    </>
  );
}
