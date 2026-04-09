"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Car } from "@/types/car";
import {
  formatPrice,
  getCountryLabel,
  getCountryFlag,
  getTransmissionLabel,
  cleanBrand,
} from "@/lib/carUtils";
import LeadForm from "@/components/LeadForm";

const COUNTRY_BG: Record<string, string> = {
  china: "bg-china",
  korea: "bg-korea",
  japan: "bg-japan",
};

interface CarCardProps {
  car: Car;
  index?: number;
}

export default function CarCard({ car, index = 0 }: CarCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isModalOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsModalOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isModalOpen]);

  const specs = [
    car.mileage > 0 ? `${car.mileage.toLocaleString("ru-RU")} км` : "Новый",
    `${car.engineVolume} л`,
    getTransmissionLabel(car.transmission),
    car.drivetrain,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="relative">
        <Link
          href={`/catalog/cars/${car.id}`}
          className="group block overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src={car.photos[0]}
              alt={`${cleanBrand(car.brand)} ${car.model} ${car.year}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            <span
              className={`absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-medium text-white ${COUNTRY_BG[car.country]}`}
            >
              {getCountryFlag(car.country)} {getCountryLabel(car.country)}
            </span>
          </div>

          <div className="p-4">
            <h3 className="font-heading text-lg font-bold text-text">
              {cleanBrand(car.brand)} {car.model} {car.year}
            </h3>

            <p className="mt-1 text-sm text-text-muted">
              {specs.join(" • ")}
            </p>

            {car.priceRub ? (
              <p className="mt-3 font-heading text-xl font-bold text-primary">
                ≈ {car.priceRub.toLocaleString("ru-RU")} ₽
              </p>
            ) : car.price > 0 ? (
              <p className="mt-3 font-heading text-xl font-bold text-primary">
                {formatPrice(car.price, car.currency)}
              </p>
            ) : (
              <span className="mt-3 inline-block font-heading text-lg font-semibold text-secondary">
                Узнать цену →
              </span>
            )}

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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
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
                {cleanBrand(car.brand)} {car.model} {car.year}
              </h2>
              <LeadForm
                subject={`${cleanBrand(car.brand)} ${car.model} ${car.year}`}
                ctaLabel="Отправить заявку"
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
