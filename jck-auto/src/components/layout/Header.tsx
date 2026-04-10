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
          <div className="flex items-center gap-2">
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2AABEE] text-white transition-opacity hover:opacity-90"
            >
              <Send className="h-4 w-4" />
            </a>
            <a
              href={CONTACTS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white transition-opacity hover:opacity-90"
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
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0077FF] text-white transition-opacity hover:opacity-90"
            >
              <Image src="/images/max-icon.svg" alt="Max" width={20} height={20} className="h-5 w-5" />
            </a>
          </div>
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
