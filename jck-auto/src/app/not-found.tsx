import Link from "next/link";
import { Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center bg-white px-4 pt-24 pb-12 text-center">
      <Search className="h-16 w-16 text-primary/40" strokeWidth={1.5} />

      <h1 className="mt-6 font-heading text-3xl font-bold text-primary sm:text-4xl">
        Страница не найдена
      </h1>

      <p className="mt-3 max-w-md text-text-muted">
        Возможно, автомобиль уже продан или ссылка устарела
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/catalog"
          className="rounded-xl bg-primary px-8 py-3 font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Перейти в каталог
        </Link>
        <Link
          href="/"
          className="rounded-xl border-2 border-primary px-8 py-3 font-medium text-primary transition-colors hover:bg-primary/5"
        >
          На главную
        </Link>
      </div>
    </main>
  );
}
