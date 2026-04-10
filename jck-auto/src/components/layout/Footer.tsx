import Link from "next/link";
import Image from "next/image";
import { Phone, Send, Youtube } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="bg-primary py-16 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1 — Logo + description */}
          <div className="md:col-span-1 lg:col-span-1">
            <Link href="/" aria-label="JCK AUTO">
              <Image
                src="/images/logo-light.svg"
                alt="JCK AUTO"
                width={120}
                height={50}
              />
            </Link>
            <p className="mt-4 text-sm text-white/70">
              Импорт автомобилей из Китая, Кореи и Японии с полным
              сопровождением. Прозрачные цены и гарантия качества.
            </p>
          </div>

          {/* Column 2-3 — Navigation */}
          <div className="md:col-span-2 lg:col-span-2">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/50">
              Навигация
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {/* Group 1 — Компания */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Компания</p>
                <div className="mt-2 flex flex-col gap-1">
                  <Link href="/" className="text-sm text-white/70 transition-colors hover:text-white">Главная</Link>
                  <Link href="/about" className="text-sm text-white/70 transition-colors hover:text-white">О компании</Link>
                  <Link href="/blog" className="text-sm text-white/70 transition-colors hover:text-white">Блог</Link>
                  <Link href="/news" className="text-sm text-white/70 transition-colors hover:text-white">Новости</Link>
                </div>
              </div>

              {/* Group 2 — Каталог */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Каталог</p>
                <div className="mt-2 flex flex-col gap-1">
                  <Link href="/catalog" className="text-sm text-white/70 transition-colors hover:text-white">Автомобили</Link>
                  <Link href="/catalog/noscut" className="text-sm text-white/70 transition-colors hover:text-white">Ноускаты</Link>
                </div>
              </div>

              {/* Group 3 — Сервисы */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Сервисы</p>
                <div className="mt-2 flex flex-col gap-1">
                  <Link href="/tools/calculator" className="text-sm text-white/70 transition-colors hover:text-white">Калькулятор «под ключ»</Link>
                  <Link href="/tools/customs" className="text-sm text-white/70 transition-colors hover:text-white">Калькулятор пошлин</Link>
                  <Link href="/tools/auction-sheet" className="text-sm text-white/70 transition-colors hover:text-white">Аукционные листы</Link>
                  <Link href="/tools/encar" className="text-sm text-white/70 transition-colors hover:text-white">Анализатор Encar</Link>
                </div>
              </div>
            </div>
          </div>

          {/* Column 4 — Contacts */}
          <div className="md:col-span-1 lg:col-span-1">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/50">
              Контакты
            </h3>
            <a
              href={`tel:${CONTACTS.phoneRaw}`}
              className="mt-4 flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
            >
              <Phone className="h-4 w-4" />
              {CONTACTS.phone}
            </a>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={CONTACTS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
              >
                <Send className="h-5 w-5" />
              </a>
              <a
                href={CONTACTS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
              <a
                href={CONTACTS.max}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Max"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
              >
                <Image src="/images/max-icon.svg" alt="Max" width={20} height={20} className="h-5 w-5" />
              </a>
              <a
                href={CONTACTS.youtube}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
              >
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col items-center gap-3 text-xs text-white/50 sm:flex-row sm:justify-between">
            <p>
              &copy; {new Date().getFullYear()} {CONTACTS.company}. {CONTACTS.legal}
            </p>
            <div className="flex gap-4">
              <Link href="/privacy" className="transition-colors hover:text-white">
                Политика конфиденциальности
              </Link>
              <Link href="/terms" className="transition-colors hover:text-white">
                Пользовательское соглашение
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
