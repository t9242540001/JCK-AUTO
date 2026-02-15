import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Send, Calculator, ChevronRight } from "lucide-react";
import { readCatalogJson } from "@/lib/blobStorage";
import { mockCars } from "@/data/mockCars";
import { CONTACTS } from "@/lib/constants";
import {
  formatPrice,
  getCountryLabel,
  getCountryFlag,
} from "@/lib/carUtils";
import CarGallery from "@/components/catalog/CarGallery";
import CarSpecs from "@/components/catalog/CarSpecs";
import CarTrustBlock from "@/components/catalog/CarTrustBlock";
import CarCard from "@/components/catalog/CarCard";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getAllCars() {
  const blobCars = await readCatalogJson();
  return blobCars.length > 0 ? blobCars : mockCars;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const cars = await getAllCars();
  const car = cars.find((c) => c.id === id);
  if (!car) return { title: "Автомобиль не найден | JCK AUTO" };

  return {
    title: `${car.brand} ${car.model} ${car.year} ${car.folderName.replace(`${car.brand} ${car.model} ${car.year}`, "").trim()} — купить из ${getCountryLabel(car.country)} | JCK AUTO`,
    description: `${car.brand} ${car.model} ${car.year}, ${car.engineVolume} ${car.transmission}, ${car.mileage > 0 ? `${car.mileage.toLocaleString("ru-RU")} км` : "новый"}, ${car.power} л.с. Цена ${formatPrice(car.price, car.currency)}. Доставка из ${getCountryLabel(car.country)} под ключ.`,
  };
}

export function generateStaticParams() {
  return [];
}

export default async function CarDetailPage({ params }: PageProps) {
  const { id } = await params;
  const cars = await getAllCars();
  const car = cars.find((c) => c.id === id);
  if (!car) notFound();

  const otherCars = cars
    .filter((c) => c.id !== car.id)
    .slice(0, 3);

  const COUNTRY_BG: Record<string, string> = {
    china: "bg-china",
    korea: "bg-korea",
    japan: "bg-japan",
  };

  return (
    <div className="bg-white pb-12 pt-24 sm:pb-16">
      <div className="mx-auto max-w-7xl px-4">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm text-text-muted">
          <Link href="/" className="transition-colors hover:text-primary">
            Главная
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href="/catalog"
            className="transition-colors hover:text-primary"
          >
            Каталог
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text">
            {car.brand} {car.model} {car.year}
          </span>
        </nav>

        {/* Main content: Gallery + Info */}
        <div className="mt-6 grid gap-8 lg:grid-cols-5">
          {/* Gallery — 3/5 width on desktop */}
          <div className="lg:col-span-3">
            <CarGallery
              photos={car.photos}
              alt={`${car.brand} ${car.model} ${car.year}`}
            />
          </div>

          {/* Info sidebar — 2/5 width on desktop */}
          <div className="lg:col-span-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-white ${COUNTRY_BG[car.country]}`}
            >
              {getCountryFlag(car.country)} {getCountryLabel(car.country)}
            </span>

            <h1 className="mt-3 font-heading text-2xl font-bold text-text sm:text-3xl">
              {car.folderName}
            </h1>

            {car.priceRub ? (
              <div className="mt-4">
                <p className="font-heading text-3xl font-bold text-primary sm:text-4xl">
                  от {car.priceRub.toLocaleString("ru-RU")} ₽
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  {formatPrice(car.price, car.currency)}
                  {car.exchangeRate
                    ? ` · Курс ЦБ: 1 ${car.currency} = ${car.exchangeRate.toFixed(2)} ₽`
                    : ""}
                </p>
              </div>
            ) : (
              <p className="mt-4 font-heading text-3xl font-bold text-primary sm:text-4xl">
                {formatPrice(car.price, car.currency)}
              </p>
            )}

            {car.condition && (
              <p className="mt-3 text-sm text-text-muted">{car.condition}</p>
            )}

            {car.description && (
              <p className="mt-4 text-text-muted">{car.description}</p>
            )}

            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-4 font-medium text-white transition-colors hover:bg-secondary-hover"
            >
              <Send className="h-5 w-5" />
              Написать в Telegram
            </a>

            <p className="mt-3 text-center text-sm text-text-muted">
              Или позвоните:{" "}
              <a
                href={`tel:${CONTACTS.phoneRaw}`}
                className="font-medium text-text transition-colors hover:text-primary"
              >
                {CONTACTS.phone}
              </a>
            </p>
          </div>
        </div>

        {/* Specs */}
        <section className="mt-12">
          <h2 className="font-heading text-xl font-bold text-text sm:text-2xl">
            Характеристики
          </h2>
          <div className="mt-6">
            <CarSpecs car={car} />
          </div>
        </section>

        {/* Price breakdown */}
        {car.priceRub && car.priceBreakdown && (
          <section className="mt-12">
            <h2 className="font-heading text-xl font-bold text-text sm:text-2xl">
              Из чего складывается цена
            </h2>
            <div className="mt-6 rounded-xl border border-border bg-surface p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Цена автомобиля</span>
                  <span className="font-medium text-text">
                    {formatPrice(car.price, car.currency)} ({car.priceBreakdown.carPriceRub.toLocaleString("ru-RU")} ₽)
                  </span>
                </div>
                {car.country === "china" && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Расходы в Китае (оформление, страховка, погрузка)</span>
                    <span className="font-medium text-text">
                      {Math.round((car.priceBreakdown.deliveryCost > 0 ? (car.priceRub - car.priceBreakdown.carPriceRub - car.priceBreakdown.customsFee - car.priceBreakdown.customsDuty - car.priceBreakdown.recyclingFee - car.priceBreakdown.deliveryCost) : 0)).toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Таможенное оформление</span>
                  <span className="font-medium text-text">
                    {car.priceBreakdown.customsFee.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Единая таможенная ставка</span>
                  <span className="font-medium text-text">
                    {car.priceBreakdown.customsDuty.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Утилизационный сбор</span>
                  <span className="font-medium text-text">
                    {car.priceBreakdown.recyclingFee.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
                {car.priceBreakdown.deliveryCost > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">
                      Доставка до {car.country === "china" ? "Уссурийска" : "Владивостока"}, СБКТС, ЭПТС, брокер
                    </span>
                    <span className="font-medium text-text">
                      {(car.priceBreakdown.deliveryCost + car.priceBreakdown.serviceFee).toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                )}
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-lg font-bold text-text">ИТОГО</span>
                    <span className="font-heading text-lg font-bold text-primary">
                      {car.priceRub.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-text-muted">
                Расчёт по курсу ЦБ на{" "}
                {car.priceCalculatedAt
                  ? new Date(car.priceCalculatedAt).toLocaleDateString("ru-RU")
                  : "—"}
                . Итоговая стоимость может отличаться в зависимости от курса валют на дату оформления.
              </p>
            </div>
          </section>
        )}

        {/* Features */}
        {car.features.length > 0 && (
          <section className="mt-12">
            <h2 className="font-heading text-xl font-bold text-text sm:text-2xl">
              Оснащение
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {car.features.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-text"
                >
                  {f}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Trust block */}
        <section className="mt-12">
          <CarTrustBlock />
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-2xl bg-primary p-6 text-center text-white sm:p-10">
          <h2 className="font-heading text-xl font-bold sm:text-2xl">
            Хотите этот автомобиль?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-base text-white/80 sm:text-lg">
            Напишите нам — рассчитаем полную стоимость доставки под ключ
          </p>
          <div className="mt-6 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-secondary px-8 py-4 font-medium text-white transition-colors hover:bg-secondary-hover"
            >
              <Send className="h-5 w-5" />
              Написать в Telegram
            </a>
            <Link
              href="/calculator"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-8 py-4 font-medium text-white transition-colors hover:bg-white/10"
            >
              <Calculator className="h-5 w-5" />
              Рассчитать на калькуляторе
            </Link>
          </div>
        </section>

        {/* Other cars */}
        {otherCars.length > 0 && (
          <section className="mt-12 border-t border-border pt-12">
            <h2 className="font-heading text-xl font-bold text-text sm:text-2xl">
              Другие автомобили
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {otherCars.map((c, i) => (
                <CarCard key={c.id} car={c} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
