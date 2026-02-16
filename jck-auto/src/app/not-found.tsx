"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-white pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-md px-4 text-center"
      >
        <p className="font-heading text-8xl font-bold text-gray-200">404</p>
        <h1 className="mt-4 font-heading text-2xl font-bold text-text">
          Страница не найдена
        </h1>
        <p className="mt-2 text-text-muted">
          Возможно, она была перемещена или удалена
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="rounded-xl bg-[#1E3A5F] px-6 py-3 font-medium text-white transition-colors hover:bg-[#2A4A73]"
          >
            На главную
          </Link>
          <Link
            href="/catalog"
            className="rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Каталог автомобилей
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
