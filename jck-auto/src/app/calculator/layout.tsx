import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Калькулятор стоимости",
  description:
    "Рассчитайте приблизительную стоимость импорта автомобиля из Китая, Кореи или Японии «под ключ».",
};

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
