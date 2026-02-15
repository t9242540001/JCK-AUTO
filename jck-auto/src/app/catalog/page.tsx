"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { mockCars } from "@/data/mockCars";
import CatalogFilters, {
  type Filters,
} from "@/components/catalog/CatalogFilters";
import CarGrid from "@/components/catalog/CarGrid";

const initialFilters: Filters = {
  country: "all",
  brand: "all",
  bodyType: "Все",
  priceFrom: "",
  priceTo: "",
};

export default function CatalogPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const availableBrands = useMemo(() => {
    const brands = new Set(mockCars.map((c) => c.brand));
    return Array.from(brands).sort();
  }, []);

  const filteredCars = useMemo(() => {
    return mockCars.filter((car) => {
      if (filters.country !== "all" && car.country !== filters.country)
        return false;
      if (filters.brand !== "all" && car.brand !== filters.brand) return false;
      if (filters.bodyType !== "Все" && car.bodyType !== filters.bodyType)
        return false;
      if (filters.priceFrom && car.price < Number(filters.priceFrom))
        return false;
      if (filters.priceTo && car.price > Number(filters.priceTo)) return false;
      return true;
    });
  }, [filters]);

  return (
    <>
      {/* Hero */}
      <section className="bg-surface pb-10 pt-28 sm:pb-16">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-medium uppercase tracking-wider text-secondary">
              Каталог
            </p>
            <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl lg:text-5xl">
              Автомобили в наличии
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-text-muted sm:text-lg">
              Выберите автомобиль — мы доставим его под ключ с гарантией до 2 лет
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filters + Grid */}
      <section className="bg-white py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <CatalogFilters
            filters={filters}
            onFiltersChange={setFilters}
            availableBrands={availableBrands}
          />

          <div className="mt-8">
            <CarGrid cars={filteredCars} />
          </div>
        </div>
      </section>
    </>
  );
}
