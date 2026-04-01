"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, Send } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { CONTACTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Главная", href: "/" },
  { label: "Каталог", href: "/catalog" },
  { label: "Калькулятор", href: "/calculator" },
  { label: "О компании", href: "/about" },
  { label: "Блог", href: "/blog" },
  { label: "Новости", href: "/news" },
];

interface MobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "py-3 text-lg transition-colors hover:text-primary",
                  pathname === item.href
                    ? "font-medium text-primary"
                    : "text-text"
                )}
              >
                {item.label}
              </Link>
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
              <div>
                <p className="font-medium text-text">Написать в Telegram</p>
              </div>
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
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#229ED9]"
              aria-label="Telegram"
            >
              <Send className="h-4 w-4" />
              Написать
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
