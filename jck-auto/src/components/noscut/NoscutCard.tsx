"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import LeadForm from "@/components/LeadForm";


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
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isModalOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsModalOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isModalOpen]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index, 4) * 0.08 }}
    >
      <div className={`relative overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all duration-200 ${!isModalOpen ? 'hover:scale-[1.02] hover:shadow-md' : ''}`}>
        <Link
          href={`/catalog/noscut/${entry.slug}`}
          className="group block"
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src={entry.image}
              alt={`${entry.make} ${entry.model} ${entry.generation} ноускат`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            {entry.inStock && (
              <span className="absolute top-3 right-3 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
                В наличии
              </span>
            )}
          </div>

          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-secondary">
              Ноускат
            </p>
            <h3 className="mt-0.5 font-heading text-lg font-bold text-text">
              {entry.make} {entry.model} {entry.generation}
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              {entry.yearStart}–{entry.yearEnd}
            </p>

            <div className="mt-3">
              <p className="font-heading text-xl font-bold text-primary">
                от {entry.priceFrom.toLocaleString("ru-RU")} ₽
              </p>
              {entry.marketPriceRu && entry.marketPriceRu > entry.priceFrom && (
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

        {/* CTA button — outside Link to avoid nested interactive elements */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-2 w-full cursor-pointer rounded-xl border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Оставить заявку
          </button>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 px-4"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute right-4 top-4 cursor-pointer text-gray-400 hover:text-gray-600"
                aria-label="Закрыть"
              >
                ✕
              </button>
              <h2 className="mb-4 font-heading text-lg font-bold text-text">
                {entry.make} {entry.model} {entry.generation}
              </h2>
              <LeadForm
                subject={`${entry.make} ${entry.model} ${entry.generation} ноускат`}
                ctaLabel="Отправить заявку"
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
