import Link from "next/link";
import Image from "next/image";
import { Phone, Send, Youtube } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

const NAV_ITEMS = [
  { label: "Главная", href: "/" },
  { label: "Калькулятор", href: "/calculator" },
  { label: "О компании", href: "/about" },
  { label: "Блог", href: "/blog" },
];

export default function Footer() {
  return (
    <footer className="bg-primary py-16 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" aria-label="JCK AUTO">
              <Image
                src="/images/logo-light.svg"
                alt="JCK AUTO"
                width={140}
                height={49}
              />
            </Link>
            <p className="mt-4 text-sm text-white/70">
              Импорт автомобилей из Китая, Кореи и Японии с полным
              сопровождением. Прозрачные цены и гарантия качества.
            </p>
          </div>

          <div>
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/50">
              Навигация
            </h3>
            <nav className="mt-4 flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-white/70 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/50">
              Контакты
            </h3>
            <div className="mt-4 flex flex-col gap-3">
              <a
                href={`tel:${CONTACTS.phoneRaw}`}
                className="flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4" />
                {CONTACTS.phone}
              </a>
              <a
                href={CONTACTS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
              >
                <Send className="h-4 w-4" />
                Telegram {CONTACTS.telegramHandle}
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/50">
              Мы в соцсетях
            </h3>
            <div className="mt-4 flex gap-3">
              <a
                href={CONTACTS.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
                aria-label="YouTube"
              >
                <Youtube className="h-5 w-5" />
              </a>
              <a
                href={CONTACTS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
                aria-label="Telegram"
              >
                <Send className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8 text-center text-xs text-white/50">
          &copy; {new Date().getFullYear()} {CONTACTS.company}. {CONTACTS.legal}
        </div>
      </div>
    </footer>
  );
}
