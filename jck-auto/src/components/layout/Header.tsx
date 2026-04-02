"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Phone, Menu, Send, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTACTS } from "@/lib/constants";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation";
import MobileMenu from "./MobileMenu";

function DesktopNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  if (!item.children) {
    return (
      <Link
        href={item.href}
        className={cn(
          "text-sm transition-colors hover:text-primary",
          pathname === item.href ? "font-medium text-primary" : "text-text-muted"
        )}
      >
        {item.label}
      </Link>
    );
  }

  const isActive = pathname.startsWith(item.href);

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-1 text-sm transition-colors hover:text-primary",
          isActive ? "font-medium text-primary" : "text-text-muted"
        )}
      >
        {item.label}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </Link>
      {open && (
        <div className="absolute left-0 top-full pt-2">
          <div className="min-w-56 rounded-xl bg-white py-2 shadow-lg ring-1 ring-black/5">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "block px-4 py-2 text-sm transition-colors hover:bg-surface-alt hover:text-primary",
                  pathname === child.href ? "font-medium text-primary" : "text-text-muted"
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 shadow-sm backdrop-blur-sm">

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
            <DesktopNavItem key={item.href} item={item} pathname={pathname} />
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
            className="flex items-center gap-2 rounded-xl bg-[#2AABEE] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#229ED9]"
          >
            <Send className="h-4 w-4" />
            Написать в Telegram
          </a>
        </div>

        <button
          className="flex h-11 w-11 items-center justify-center rounded-lg lg:hidden"
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
