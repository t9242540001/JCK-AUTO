import type { Metadata } from "next";
import CalculatorClient from "./CalculatorClient";

export const metadata: Metadata = {
  title: "Калькулятор растаможки авто из Китая — рассчитайте стоимость под ключ",
  description:
    "Онлайн-калькулятор полной стоимости авто из Китая, Кореи, Японии. Растаможка, доставка, ЭПТС, СБКТС — все расходы в одном расчёте.",
  keywords:
    "калькулятор растаможки, стоимость авто из Китая, растаможка авто калькулятор, авто из Японии стоимость",
  openGraph: {
    title: "Калькулятор растаможки авто — JCK AUTO",
    description:
      "Рассчитайте полную стоимость авто из Китая, Кореи или Японии под ключ.",
    url: "https://jckauto.ru/calculator",
  },
  alternates: {
    canonical: "https://jckauto.ru/calculator",
  },
};

export default function CalculatorPage() {
  return <CalculatorClient />;
}
