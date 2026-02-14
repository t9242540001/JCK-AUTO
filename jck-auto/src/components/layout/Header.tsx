"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Phone, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTACTS } from "@/lib/constants";
import MobileMenu from "./MobileMenu";

const NAV_ITEMS = [
  { label: "Главная", href: "/" },
  { label: "Калькулятор", href: "/calculator" },
  { label: "О компании", href: "/about" },
  { label: "Блог", href: "/blog" },
];

export default function Header() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 50);
      setIsVisible(currentScrollY < lastScrollY || currentScrollY < 50);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        "bg-white shadow-sm",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" aria-label="JCK AUTO">
          <Image
            src="/images/logo-dark.svg"
            alt="JCK AUTO"
            width={120}
            height={50}
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" role="navigation">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm transition-colors hover:text-primary",
                pathname === item.href
                  ? "font-medium text-primary"
                  : "text-text-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a
            href={`tel:${CONTACTS.phoneRaw}`}
            className="flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-primary"
          >
            <Phone className="h-4 w-4" />
            {CONTACTS.phone}
          </a>
          <a
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-secondary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover"
          >
            Оставить заявку
          </a>
        </div>

        <button
          className="lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Открыть меню"
        >
          <Menu className="h-6 w-6 text-primary" />
        </button>
      </div>

      <MobileMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
    </header>
  );
}
