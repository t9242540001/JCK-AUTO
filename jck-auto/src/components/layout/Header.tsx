"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, Menu } from "lucide-react";
import { CONTACTS } from "@/lib/constants";
import { MobileMenu } from "./MobileMenu";

const NAV_LINKS = [
  { href: "/", label: "Главная" },
  { href: "/calculator", label: "Калькулятор" },
  { href: "/about", label: "О компании" },
  { href: "/blog", label: "Блог" },
];

export function Header() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const andrey = CONTACTS.team[0];

  useEffect(() => {
    const scrollRef = { current: 0 };
    const onScroll = () => {
      const currentScrollY = window.scrollY;

      setIsScrolled(currentScrollY > 50);

      if (currentScrollY > scrollRef.current && currentScrollY > 100) {
        setIsHidden(true);
      } else {
        setIsHidden(false);
      }

      scrollRef.current = currentScrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/80 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      } ${isHidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between lg:h-20">
          {/* Logo */}
          <Link href="/" className="font-heading text-xl">
            <span className="font-bold text-primary">JCK</span>
            <span className="font-light text-text-muted">AUTO</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors hover:text-primary ${
                  pathname === link.href
                    ? "font-medium text-primary"
                    : "text-text"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Phone */}
            <a
              href={`tel:${andrey.phone.replace(/[\s()-]/g, "")}`}
              className="hidden items-center gap-2 text-sm text-text transition-colors hover:text-primary lg:flex"
            >
              <Phone className="h-4 w-4" />
              <span>{andrey.phone}</span>
            </a>

            {/* CTA Button */}
            <button className="rounded-xl bg-secondary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover">
              Оставить заявку
            </button>

            {/* Mobile hamburger */}
            <button
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Открыть меню"
            >
              <Menu className="h-6 w-6 text-text" />
            </button>
          </div>
        </div>
      </div>

      <MobileMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
    </header>
  );
}
