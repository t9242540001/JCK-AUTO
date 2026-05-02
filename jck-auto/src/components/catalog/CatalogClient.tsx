"use client";

import { useState, useMemo } from "react";
import { Send } from "lucide-react";
import type { Car } from "@/types/car";
import { CONTACTS } from "@/lib/constants";
import CatalogFilters, { type Filters } from "./CatalogFilters";
import CarGrid from "./CarGrid";

const initialFilters: Filters = {
  country: "all",
  brand: "all",
  bodyType: "Все",
  priceFrom: "",
  priceTo: "",
};

interface CatalogClientProps {
  cars: Car[];
}

export default function CatalogClient({ cars }: CatalogClientProps) {
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const availableBrands = useMemo(() => {
    const brands = new Set(cars.map((c) => c.brand));
    return Array.from(brands).sort();
  }, [cars]);

  const filteredCars = useMemo(() => {
    return cars
      .filter((car) => {
        if (filters.country !== "all" && car.country !== filters.country)
          return false;
        if (filters.brand !== "all" && car.brand !== filters.brand) return false;
        if (filters.bodyType !== "Все" && car.bodyType !== filters.bodyType)
          return false;
        if (filters.priceFrom && car.priceRub && car.priceRub < Number(filters.priceFrom))
          return false;
        if (filters.priceTo && car.priceRub && car.priceRub > Number(filters.priceTo))
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [cars, filters]);

  if (cars.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-lg font-medium text-text">
          Каталог обновляется
        </p>
        <p className="mt-2 text-text-muted">
          Напишите нам — подберём автомобиль индивидуально
        </p>
        <a
          href={CONTACTS.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#2AABEE] px-6 py-3 font-medium text-white transition-colors hover:bg-[#229ED9]"
        >
          <Send className="h-4 w-4" />
          Написать в Telegram
        </a>
      </div>
    );
  }

  return (
    <>
      <CatalogFilters
        filters={filters}
        onFiltersChange={setFilters}
        availableBrands={availableBrands}
      />
      <div className="mt-8">
        <CarGrid cars={filteredCars} />
      </div>
    </>
  );
}
