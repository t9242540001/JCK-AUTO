import {
  Calendar,
  Gauge,
  Fuel,
  Cog,
  CircleDot,
  Palette,
  Car,
  Zap,
  MapPin,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import type { Car as CarType } from "@/types/car";
import { getTransmissionLabel } from "@/lib/carUtils";

interface CarSpecsProps {
  car: CarType;
}

export default function CarSpecs({ car }: CarSpecsProps) {
  const specs = [
    { icon: Calendar, label: "Год", value: String(car.year) },
    {
      icon: Gauge,
      label: "Пробег",
      value:
        car.mileage > 0
          ? `${car.mileage.toLocaleString("ru-RU")} км`
          : "Новый",
    },
    { icon: Fuel, label: "Двигатель", value: `${car.engineVolume} л` },
    { icon: Zap, label: "Мощность", value: `${car.power} л.с.` },
    {
      icon: Cog,
      label: "КПП",
      value: getTransmissionLabel(car.transmission),
    },
    { icon: CircleDot, label: "Привод", value: car.drivetrain },
    { icon: Fuel, label: "Топливо", value: car.fuelType },
    { icon: Palette, label: "Цвет", value: car.color },
    { icon: Car, label: "Кузов", value: car.bodyType },
    {
      icon: ShieldCheck,
      label: "Родной пробег",
      value: car.isNativeMileage ? "Да ✅" : "Нет ❌",
    },
    {
      icon: FileCheck,
      label: "Отчёт о проверке",
      value: car.hasInspectionReport ? "Да ✅" : "Нет ❌",
    },
    { icon: MapPin, label: "Местоположение", value: car.location },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {specs.map((s) => (
        <div
          key={s.label}
          className="flex items-start gap-3 rounded-lg bg-surface p-3"
        >
          <s.icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className="text-sm font-medium text-text">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
