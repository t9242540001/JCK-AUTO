import type { Metadata } from "next";
import fs from "fs";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Hero from "@/components/sections/Hero";
import Countries from "@/components/sections/Countries";
import HowItWorks from "@/components/sections/HowItWorks";
import Calculator from "@/components/sections/Calculator";
import CatalogPreview from "@/components/sections/CatalogPreview";
import NoscutCard from "@/components/noscut/NoscutCard";
import Values from "@/components/sections/Values";
import Warranty from "@/components/sections/Warranty";
import Testimonials from "@/components/sections/Testimonials";
import FAQ from "@/components/sections/FAQ";
import ContactCTA from "@/components/sections/ContactCTA";
import SocialFollow from "@/components/sections/SocialFollow";

export const metadata: Metadata = {
  title: {
    absolute:
      "JCK AUTO — импорт авто из Китая, Кореи и Японии под ключ",
  },
  description:
    "Привезём автомобиль из Китая, Кореи или Японии под ключ. Подбор, проверка, доставка, таможенное оформление. Гарантия ВСК до 2 лет. Рассчитайте стоимость онлайн.",
  keywords:
    "купить авто из Китая, автомобиль из Кореи, машина из Японии, импорт авто, авто под заказ, JCK AUTO, растаможка авто",
  openGraph: {
    title: "JCK AUTO — импорт авто из Китая, Кореи и Японии под ключ",
    description:
      "Привезём автомобиль из Китая, Кореи или Японии под ключ. Подбор, проверка, доставка, гарантия ВСК до 2 лет.",
    url: "https://jckauto.ru",
  },
  alternates: {
    canonical: "https://jckauto.ru",
  },
};

function loadNoscutPreview() {
  try {
    const raw = fs.readFileSync("/var/www/jckauto/storage/noscut/noscut-catalog.json", "utf-8");
    const entries = JSON.parse(raw) as Array<Record<string, unknown>>;
    return entries.slice(0, 4);
  } catch {
    return [];
  }
}

export default function Home() {
  const noscutEntries = loadNoscutPreview();

  return (
    <>
      <Hero />
      <Countries />
      <CatalogPreview />

      {/* Noscut preview */}
      {noscutEntries.length > 0 && (
        <section className="bg-surface py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center">
              <h2 className="font-heading text-2xl font-bold text-text sm:text-3xl">
                Ноускаты из Азии
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-text-muted">
                Комплекты для восстановления передней части — от 199 000 ₽
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {noscutEntries.map((entry: any, i: number) => (
                <NoscutCard key={entry.slug} entry={entry} index={i} />
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/catalog/noscut"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-primary px-8 py-4 font-medium text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Смотреть все ноускаты
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      <HowItWorks />
      <Calculator />
      <Values />
      <Warranty />
      <Testimonials />
      <FAQ />
      <ContactCTA />
      <SocialFollow />
    </>
  );
}
