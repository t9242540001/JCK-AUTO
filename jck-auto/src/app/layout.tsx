import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import JsonLd from "@/components/layout/JsonLd";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FloatingCTA from "@/components/layout/FloatingCTA";

/* TODO: Add og-image.jpg 1200x630 to public/images/ */

export const metadata: Metadata = {
  metadataBase: new URL("https://jckauto.ru"),
  title: {
    default: "JCK AUTO — импорт автомобилей из Китая, Кореи и Японии",
    template: "%s | JCK AUTO",
  },
  description:
    "Импорт автомобилей из Китая, Кореи и Японии под ключ. Подбор, проверка, доставка, растаможка. Гарантия ВСК до 2 лет.",
  keywords: [
    "импорт авто",
    "авто из Китая",
    "авто из Кореи",
    "авто из Японии",
    "JCK AUTO",
    "растаможка",
    "авто под заказ",
  ],
  authors: [{ name: "JCK AUTO" }],
  creator: "JCK AUTO",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "JCK AUTO",
    title: "JCK AUTO — импорт автомобилей из Китая, Кореи и Японии",
    description:
      "Привезём автомобиль из Азии под ключ. Подбор, проверка, доставка, таможня, гарантия.",
  },
  twitter: {
    card: "summary_large_image",
    title: "JCK AUTO — импорт авто из Азии",
    description:
      "Привезём автомобиль из Китая, Кореи или Японии под ключ.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://jckauto.ru",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <JsonLd />
        <Header />
        <main>{children}</main>
        <Footer />
        <FloatingCTA />
      </body>
    </html>
  );
}
