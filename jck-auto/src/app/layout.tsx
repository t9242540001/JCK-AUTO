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
    default: "JCK AUTO — Импорт автомобилей из Китая, Кореи и Японии",
    template: "%s | JCK AUTO",
  },
  description:
    "Полное сопровождение импорта автомобилей из Азии. Прозрачные цены, проверка каждого авто, гарантия до 2 лет от Страхового Дома ВСК.",
  keywords: [
    "импорт авто",
    "авто из Китая",
    "авто из Кореи",
    "авто из Японии",
    "JCK AUTO",
    "растаможка авто",
    "купить авто из Азии",
  ],
  authors: [{ name: "JCK AUTO" }],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://jckauto.ru",
    siteName: "JCK AUTO",
    title: "JCK AUTO — Импорт автомобилей из Китая, Кореи и Японии",
    description:
      "Полное сопровождение импорта автомобилей из Азии. Прозрачные цены, проверка каждого авто, гарантия до 2 лет.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "JCK AUTO",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JCK AUTO — Импорт автомобилей из Китая, Кореи и Японии",
    description: "Полное сопровождение импорта автомобилей из Азии.",
    images: ["/images/og-image.jpg"],
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
