"use client";

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
      <Link
        href={`/catalog/${car.id}`}
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
          ) : (
            <p className="mt-3 font-heading text-xl font-bold text-primary">
              {formatPrice(car.price, car.currency)}
            </p>
          )}

          <span className="mt-3 inline-block text-sm font-medium text-secondary transition-colors group-hover:text-secondary-hover">
            Подробнее →
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
