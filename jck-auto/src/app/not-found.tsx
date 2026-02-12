import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white">
      <div className="mx-auto max-w-md px-4 text-center">
        <p className="font-heading text-8xl font-bold text-primary/20">404</p>
        <h1 className="mt-4 text-2xl font-bold text-text">
          Страница не найдена
        </h1>
        <p className="mt-2 text-muted">
          Возможно, она была перемещена или удалена
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="rounded-xl bg-secondary px-6 py-3 font-medium text-white hover:bg-secondary-hover"
          >
            На главную
          </Link>
          <Link
            href="/calculator"
            className="rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary hover:bg-primary hover:text-white"
          >
            Калькулятор
          </Link>
        </div>
      </div>
    </main>
  );
}
