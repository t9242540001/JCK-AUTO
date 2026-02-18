"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const popularCars = [
  {
    name: "Haval Jolion",
    specs: "1.5T • 150 л.с.",
    priceRange: "от 2.1 млн ₽",
    country: "Китай",
    image: "/images/cars/china.jpg",
  },
  {
    name: "Chery Tiggo 7 Pro",
    specs: "1.5T • 147 л.с.",
    priceRange: "от 2.0 млн ₽",
    country: "Китай",
    image: "/images/cars/china.jpg",
  },
  {
    name: "Hyundai Tucson",
    specs: "2.0 • 156 л.с.",
    priceRange: "от 1.8 млн ₽",
    country: "Корея",
    image: "/images/cars/korea.jpg",
  },
  {
    name: "Toyota Corolla",
    specs: "1.2T • 116 л.с.",
    priceRange: "от 1.5 млн ₽",
    country: "Китай",
    image: "/images/cars/china.jpg",
  },
];

export function PopularCars() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 text-center"
        >
          <h2 className="text-2xl font-bold text-text sm:text-3xl">
            Автомобили в нашем каталоге
          </h2>
          <p className="mt-2 text-text-muted">
            Цены рассчитаны тем же калькулятором — убедитесь сами
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {popularCars.map((car, i) => (
            <motion.div
              key={car.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="overflow-hidden rounded-xl border border-border"
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={car.image}
                  alt={car.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
              <div className="p-4">
                <h3 className="font-bold text-text">{car.name}</h3>
                <p className="text-sm text-text-muted">{car.specs}</p>
                <p className="mt-1 text-sm text-text-muted">{car.country}</p>
                <p className="mt-2 font-bold text-primary">{car.priceRange}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/catalog"
            className="text-primary hover:underline"
          >
            Смотреть весь каталог &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
