"use client";

import { useState } from "react";
import NoscutCard from "./NoscutCard";

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

interface NoscutGridProps {
  entries: NoscutEntry[];
}

const PAGE_SIZE = 24;

export default function NoscutGrid({ entries }: NoscutGridProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  const shown = entries.slice(0, visible);
  const hasMore = visible < entries.length;

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((entry, i) => (
          <NoscutCard key={entry.slug} entry={entry} index={i % PAGE_SIZE} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-xl border border-border px-8 py-3 font-medium text-text transition-colors hover:bg-gray-50"
          >
            Показать ещё
          </button>
        </div>
      )}
    </div>
  );
}
