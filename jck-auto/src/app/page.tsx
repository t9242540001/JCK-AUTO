import type { Metadata } from "next";
import Hero from "@/components/sections/Hero";
import Countries from "@/components/sections/Countries";
import HowItWorks from "@/components/sections/HowItWorks";
import Calculator from "@/components/sections/Calculator";
import Values from "@/components/sections/Values";
import Warranty from "@/components/sections/Warranty";
import Testimonials from "@/components/sections/Testimonials";
import FAQ from "@/components/sections/FAQ";
import ContactCTA from "@/components/sections/ContactCTA";

export const metadata: Metadata = {
  title: {
    absolute:
      "JCK AUTO — импорт автомобилей из Китая, Кореи и Японии под ключ",
  },
  description:
    "Привезём автомобиль из Китая, Кореи или Японии под ключ. Подбор, проверка, доставка, таможенное оформление. Гарантия ВСК до 2 лет. Рассчитайте стоимость онлайн.",
  keywords:
    "купить авто из Китая, автомобиль из Кореи, машина из Японии, импорт авто, авто под заказ, JCK AUTO, растаможка авто",
};

export default function Home() {
  return (
    <>
      <Hero />
      <Countries />
      <HowItWorks />
      <Calculator />
      <Values />
      <Warranty />
      <Testimonials />
      <FAQ />
      <ContactCTA />
    </>
  );
}
