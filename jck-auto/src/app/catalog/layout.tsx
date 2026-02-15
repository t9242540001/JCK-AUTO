import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Каталог автомобилей из Китая, Кореи и Японии | JCK AUTO",
  description:
    "Автомобили в наличии для заказа. Подбор, проверка, доставка и растаможка под ключ.",
};

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
