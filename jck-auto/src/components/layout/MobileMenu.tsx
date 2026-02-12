"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { CONTACTS } from "@/lib/constants";

const NAV_LINKS = [
  { href: "/", label: "Главная" },
  { href: "/calculator", label: "Калькулятор" },
  { href: "/about", label: "О компании" },
  { href: "/blog", label: "Блог" },
];

interface MobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMenu({ open, onOpenChange }: MobileMenuProps) {
  const pathname = usePathname();

  const handleLinkClick = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-80 flex-col">
        <SheetTitle className="sr-only">Меню навигации</SheetTitle>

        {/* Logo */}
        <div className="font-heading text-xl">
          <span className="font-bold text-primary">JCK</span>
          <span className="font-light text-text-muted">AUTO</span>
        </div>

        {/* Navigation */}
        <nav className="mt-8 flex flex-col">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleLinkClick}
              className={`py-3 text-lg transition-colors hover:text-primary ${
                pathname === link.href
                  ? "font-medium text-primary"
                  : "text-text"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Separator className="my-4" />

        {/* Contacts */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-text-muted">Контакты</p>
          {CONTACTS.team.map((member) => (
            <a
              key={member.phone}
              href={`tel:${member.phone.replace(/[\s()-]/g, "")}`}
              className="flex items-center gap-2 text-sm text-text transition-colors hover:text-primary"
            >
              <span>{member.flag}</span>
              <span>{member.name}</span>
              <span className="text-text-muted">{member.phone}</span>
            </a>
          ))}
        </div>

        {/* Social buttons */}
        <div className="mt-auto flex gap-3 pb-4">
          <a
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Send className="h-4 w-4" />
            Telegram
          </a>
          <a
            href={`${CONTACTS.whatsappBase}${CONTACTS.team[0].whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
