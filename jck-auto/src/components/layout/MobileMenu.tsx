"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, Send, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { CONTACTS } from "@/lib/constants";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface MobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MobileNavItem({ item, pathname, onClose }: { item: NavItem; pathname: string; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);

  if (!item.children) {
    return (
      <Link
        href={item.href}
        onClick={onClose}
        className={cn(
          "py-3 text-lg transition-colors hover:text-primary",
          pathname === item.href ? "font-medium text-primary" : "text-text"
        )}
      >
        {item.label}
      </Link>
    );
  }

  const isActive = pathname.startsWith(item.href);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center justify-between py-3 text-lg transition-colors hover:text-primary",
          isActive ? "font-medium text-primary" : "text-text"
        )}
      >
        {item.label}
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: expanded ? `${item.children.length * 48}px` : "0" }}
      >
        {item.children.map((child) => (
          <Link
            key={child.href}
            href={child.href}
            onClick={onClose}
            className={cn(
              "block py-2.5 pl-4 text-base transition-colors hover:text-primary",
              pathname === child.href ? "font-medium text-primary" : "text-text-muted"
            )}
          >
            {child.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function MobileMenu({ open, onOpenChange }: MobileMenuProps) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[85vw] max-w-80 p-0">
        <div className="flex flex-col h-full">
          <div className="p-6">
            <SheetTitle className="font-heading text-xl">
              <span className="font-bold text-primary">JCK</span>
              <span className="font-light text-text-muted"> AUTO</span>
            </SheetTitle>
          </div>

          <nav className="flex flex-col px-6">
            {NAV_ITEMS.map((item) => (
              <MobileNavItem
                key={item.href}
                item={item}
                pathname={pathname}
                onClose={() => onOpenChange(false)}
              />
            ))}
          </nav>

          <Separator className="mx-6 my-4" />

          <div className="flex flex-col gap-4 px-6">
            <p className="text-sm font-medium text-text-muted uppercase tracking-wider">
              Контакты
            </p>
            <a
              href={`tel:${CONTACTS.phoneRaw}`}
              className="flex items-center gap-3 text-sm"
            >
              <Phone className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-text">{CONTACTS.phone}</p>
              </div>
            </a>
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm"
            >
              <Send className="h-4 w-4 text-[#2AABEE]" />
              <p className="font-medium text-text">Telegram</p>
            </a>
            <a
              href={CONTACTS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-[#25D366] shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <p className="font-medium text-text">WhatsApp</p>
            </a>
            <a
              href={CONTACTS.max}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0077FF] text-[9px] font-bold text-white shrink-0">M</span>
              <p className="font-medium text-text">Max</p>
            </a>
          </div>

          <div className="mt-auto flex gap-3 p-6">
            <a
              href={`tel:${CONTACTS.phoneRaw}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              aria-label="Позвонить"
            >
              <Phone className="h-4 w-4" />
              Позвонить
            </a>
            <div className="flex items-center gap-2">
              <a
                href={CONTACTS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2AABEE] text-white transition-opacity hover:opacity-90"
              >
                <Send className="h-5 w-5" />
              </a>
              <a
                href={CONTACTS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366] text-white transition-opacity hover:opacity-90"
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
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0077FF] text-white font-bold transition-opacity hover:opacity-90"
              >
                M
              </a>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
