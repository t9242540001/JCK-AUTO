"use client";

import { Send } from "lucide-react";
import type { Car } from "@/types/car";
import { CONTACTS } from "@/lib/constants";
import CarCard from "./CarCard";

interface CarGridProps {
  cars: Car[];
}

export default function CarGrid({ cars }: CarGridProps) {
  if (cars.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-lg font-medium text-text">
          Автомобилей по вашему запросу не найдено
        </p>
        <p className="mt-2 text-text-muted">
          Напишите нам — подберём индивидуально
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
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {cars.map((car, i) => (
        <CarCard key={car.id} car={car} index={i} />
      ))}
    </div>
  );
}
