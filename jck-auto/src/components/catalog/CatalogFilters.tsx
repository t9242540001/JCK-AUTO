"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

const COUNTRY_TABS = [
  { value: "all", label: "Все" },
  { value: "china", label: "🇨🇳 Китай" },
  { value: "korea", label: "🇰🇷 Корея" },
  { value: "japan", label: "🇯🇵 Япония" },
] as const;

const BODY_TYPES = ["Все", "Кроссовер", "Седан", "Минивэн", "Хэтчбек"];

export interface Filters {
  country: string;
  brand: string;
  bodyType: string;
  priceFrom: string;
  priceTo: string;
}

interface CatalogFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  availableBrands: string[];
}

const selectClass =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text outline-none transition-colors focus:border-primary";
const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text outline-none transition-colors focus:border-primary";

function FilterFields({
  filters,
  onFiltersChange,
  availableBrands,
}: CatalogFiltersProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-text">Марка</label>
        <select
          value={filters.brand}
          onChange={(e) =>
            onFiltersChange({ ...filters, brand: e.target.value })
          }
          className={selectClass}
        >
          <option value="all">Все марки</option>
          {availableBrands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-text">Кузов</label>
        <select
          value={filters.bodyType}
          onChange={(e) =>
            onFiltersChange({ ...filters, bodyType: e.target.value })
          }
          className={selectClass}
        >
          {BODY_TYPES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-text">Цена</label>
        <div className="mt-1 flex gap-2">
          <input
            type="number"
            placeholder="от"
            value={filters.priceFrom}
            onChange={(e) =>
              onFiltersChange({ ...filters, priceFrom: e.target.value })
            }
            className={inputClass}
          />
          <input
            type="number"
            placeholder="до"
            value={filters.priceTo}
            onChange={(e) =>
              onFiltersChange({ ...filters, priceTo: e.target.value })
            }
            className={inputClass}
          />
        </div>
      </div>

      <button
        onClick={() =>
          onFiltersChange({
            country: filters.country,
            brand: "all",
            bodyType: "Все",
            priceFrom: "",
            priceTo: "",
          })
        }
        className="flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-primary"
      >
        <X className="h-3.5 w-3.5" />
        Сбросить фильтры
      </button>
    </div>
  );
}

export default function CatalogFilters({
  filters,
  onFiltersChange,
  availableBrands,
}: CatalogFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div>
      {/* Country tabs — always visible */}
      <div className="flex flex-wrap gap-2">
        {COUNTRY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() =>
              onFiltersChange({ ...filters, country: tab.value })
            }
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              filters.country === tab.value
                ? "bg-primary text-white"
                : "bg-surface-alt text-text-muted hover:bg-border"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop filters */}
      <div className="mt-4 hidden md:block">
        <div className="grid grid-cols-4 gap-4 rounded-xl border border-border bg-white p-4">
          <div>
            <label className="text-sm font-medium text-text">Марка</label>
            <select
              value={filters.brand}
              onChange={(e) =>
                onFiltersChange({ ...filters, brand: e.target.value })
              }
              className={selectClass}
            >
              <option value="all">Все марки</option>
              {availableBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-text">Кузов</label>
            <select
              value={filters.bodyType}
              onChange={(e) =>
                onFiltersChange({ ...filters, bodyType: e.target.value })
              }
              className={selectClass}
            >
              {BODY_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-text">Цена от</label>
            <input
              type="number"
              placeholder="от"
              value={filters.priceFrom}
              onChange={(e) =>
                onFiltersChange({ ...filters, priceFrom: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text">Цена до</label>
            <input
              type="number"
              placeholder="до"
              value={filters.priceTo}
              onChange={(e) =>
                onFiltersChange({ ...filters, priceTo: e.target.value })
              }
              className={inputClass}
            />
          </div>
        </div>
        <button
          onClick={() =>
            onFiltersChange({
              country: filters.country,
              brand: "all",
              bodyType: "Все",
              priceFrom: "",
              priceTo: "",
            })
          }
          className="mt-2 flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-primary"
        >
          <X className="h-3.5 w-3.5" />
          Сбросить фильтры
        </button>
      </div>

      {/* Mobile filter button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="mt-4 flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-alt md:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Фильтры
      </button>

      {/* Mobile filter sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-80 p-6">
          <SheetTitle className="font-heading text-lg font-bold">
            Фильтры
          </SheetTitle>
          <div className="mt-6">
            <FilterFields
              filters={filters}
              onFiltersChange={(f) => {
                onFiltersChange(f);
                setMobileOpen(false);
              }}
              availableBrands={availableBrands}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
