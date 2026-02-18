"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const popularCars = [
  {
    name: "Haval Jolion",
    specs: "1.5T \u2022 150 л.с.",
    priceRange: "от 2.1 млн \u20BD",
    country: "Китай",
    image: "\uD83C\uDDE8\uD83C\uDDF3",
  },
  {
    name: "Chery Tiggo 7 Pro",
    specs: "1.5T \u2022 147 л.с.",
    priceRange: "от 2.0 млн \u20BD",
    country: "Китай",
    image: "\uD83C\uDDE8\uD83C\uDDF3",
  },
  {
    name: "Hyundai Tucson",
    specs: "2.0 \u2022 156 л.с.",
    priceRange: "от 1.8 млн \u20BD",
    country: "Корея",
    image: "\uD83C\uDDF0\uD83C\uDDF7",
  },
  {
    name: "Toyota Corolla",
    specs: "1.2T \u2022 116 л.с.",
    priceRange: "от 1.5 млн \u20BD",
    country: "Китай",
    image: "\uD83C\uDDE8\uD83C\uDDF3",
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
              className="rounded-xl border border-border p-4"
            >
              <div className="mb-2 text-3xl">{car.image}</div>
              <h3 className="font-bold text-text">{car.name}</h3>
              <p className="text-sm text-text-muted">{car.specs}</p>
              <p className="mt-1 text-sm text-text-muted">{car.country}</p>
              <p className="mt-2 font-bold text-primary">{car.priceRange}</p>
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
