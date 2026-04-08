"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const COUNTRY_BG: Record<string, string> = {
  china: "bg-china",
  korea: "bg-korea",
  japan: "bg-japan",
};

const COUNTRY_FLAG: Record<string, string> = {
  japan: "🇯🇵",
  korea: "🇰🇷",
  china: "🇨🇳",
};

const COUNTRY_LABEL: Record<string, string> = {
  japan: "Япония",
  korea: "Корея",
  china: "Китай",
};

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

interface NoscutCardProps {
  entry: NoscutEntry;
  index?: number;
}

export default function NoscutCard({ entry, index = 0 }: NoscutCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
    >
      <Link
        href={`/catalog/noscut/${entry.slug}`}
        className="group block overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={entry.image}
            alt={`${entry.make} ${entry.model} ${entry.generation} ноускат`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <span
            className={`absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-medium text-white ${COUNTRY_BG[entry.country] ?? "bg-gray-500"}`}
          >
            {COUNTRY_FLAG[entry.country]} {COUNTRY_LABEL[entry.country]}
          </span>
          {entry.inStock && (
            <span className="absolute top-3 right-3 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
              В наличии
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="font-heading text-lg font-bold text-text">
            {entry.make} {entry.model} {entry.generation}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {entry.yearStart}–{entry.yearEnd}
          </p>

          <div className="mt-3">
            <p className="font-heading text-xl font-bold text-primary">
              от {entry.priceFrom.toLocaleString("ru-RU")} ₽
            </p>
            {entry.marketPriceRu && (
              <p className="mt-0.5 text-xs text-text-muted">
                Рынок: ~{entry.marketPriceRu.toLocaleString("ru-RU")} ₽
              </p>
            )}
          </div>

          <span className="mt-3 inline-block text-sm font-medium text-secondary transition-colors group-hover:text-secondary-hover">
            Подробнее →
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
