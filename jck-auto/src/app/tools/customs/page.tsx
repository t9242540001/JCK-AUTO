import type { Metadata } from 'next';
import Link from 'next/link';
import { Send } from 'lucide-react';
import { CONTACTS } from '@/lib/constants';

export const metadata: Metadata = {
  title: { absolute: 'Калькулятор растаможки авто 2026 — расчёт пошлин и утильсбора | JCK AUTO' },
  description: 'Онлайн-калькулятор таможенных платежей: пошлина, акциз, НДС, утилизационный сбор. Расчёт для физических и юридических лиц.',
  openGraph: { url: 'https://jckauto.ru/tools/customs' },
  alternates: { canonical: 'https://jckauto.ru/tools/customs' },
};

export default function CustomsPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 pb-20 pt-28">
      <p className="text-sm font-medium uppercase tracking-wider text-secondary">Скоро</p>
      <h1 className="mt-2 text-center font-heading text-2xl font-bold text-text sm:text-3xl">
        Калькулятор пошлин
      </h1>
      <p className="mt-4 max-w-md text-center text-text-muted">
        Инструмент появится в ближайшее время. Пока мы работаем над ним, вы можете рассчитать
        стоимость в калькуляторе «под ключ».
      </p>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Link href="/tools/calculator" className="rounded-xl bg-secondary px-8 py-3 font-medium text-white transition-colors hover:bg-secondary-hover">
          Калькулятор «под ключ»
        </Link>
        <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-8 py-3 font-medium text-white transition-colors hover:bg-[#229ED9]">
          <Send className="h-4 w-4" /> Написать менеджеру
        </a>
      </div>
      <Link href="/tools" className="mt-8 text-sm text-text-muted hover:text-primary">← Все сервисы</Link>
    </div>
  );
}
