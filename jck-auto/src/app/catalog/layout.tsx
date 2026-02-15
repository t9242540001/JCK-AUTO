import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Каталог автомобилей из Китая, Кореи и Японии | JCK AUTO",
  description:
    "Автомобили в наличии с доставкой под ключ. BMW, Lexus, Toyota, Haval и другие марки. Прозрачные цены, гарантия ВСК до 2 лет.",
  keywords: [
    "купить авто из Китая",
    "автомобили из Кореи",
    "импорт авто из Японии",
    "JCK AUTO каталог",
    "авто под заказ из Азии",
  ],
};

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
