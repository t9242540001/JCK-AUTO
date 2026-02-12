import Link from "next/link";
import { Youtube, Send } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

const NAV_LINKS = [
  { href: "/", label: "Главная" },
  { href: "/calculator", label: "Калькулятор" },
  { href: "/about", label: "О компании" },
  { href: "/blog", label: "Блог" },
];

export function Footer() {
  return (
    <footer className="bg-primary py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Logo + description */}
          <div>
            <div className="font-heading text-xl text-white">
              <span className="font-bold">JCK</span>{" "}
              <span className="font-light">AUTO</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Импорт автомобилей из Китая, Кореи и Японии с полным
              сопровождением
            </p>
          </div>

          {/* Column 2: Navigation */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Навигация
            </h3>
            <nav className="mt-4 flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-white/70 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Column 3: Contacts */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Контакты
            </h3>
            <div className="mt-4 flex flex-col gap-3">
              {CONTACTS.team.map((member) => (
                <a
                  key={member.phone}
                  href={`tel:${member.phone.replace(/[\s()-]/g, "")}`}
                  className="flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
                >
                  <span>{member.flag}</span>
                  <span>{member.name}</span>
                  <span>{member.phone}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Column 4: Social */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Мы в сети
            </h3>
            <div className="mt-4 flex gap-4">
              <a
                href={CONTACTS.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white transition-opacity hover:opacity-80"
                aria-label="YouTube"
              >
                <Youtube className="h-5 w-5" />
              </a>
              <a
                href={CONTACTS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white transition-opacity hover:opacity-80"
                aria-label="Telegram"
              >
                <Send className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-sm text-white/40">
              &copy; 2025 {CONTACTS.company}. {CONTACTS.legal}
            </p>
            <p className="text-sm text-white/40">Все права защищены</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
