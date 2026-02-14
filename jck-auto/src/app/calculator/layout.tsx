import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Калькулятор растаможки авто — рассчитайте стоимость под ключ",
  description:
    "Онлайн-калькулятор стоимости импорта автомобиля из Китая, Кореи и Японии. Учитывает таможенные пошлины, утилизационный сбор, доставку. Точный расчёт за 30 секунд.",
  keywords:
    "калькулятор растаможки, расчёт стоимости авто из Китая, таможенные пошлины автомобиль, утилизационный сбор, калькулятор импорта авто",
};

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
