/**
 * @file Single source of truth for messenger / contact channel config.
 * @important Used by both FloatingMessengers FAB (3 channels) and
 *   ContactChannels inline block (4 channels with Phone). Adding a new
 *   messenger here automatically propagates to both surfaces.
 *
 * @rule Phone is NOT a messenger — it has tel: href (opens dialer,
 *   not chat). Keep it in CONTACT_CHANNELS only, never in
 *   MESSENGER_CHANNELS.
 *
 * @dependencies Used by:
 *   - src/components/FloatingMessengers.tsx (MESSENGER_CHANNELS)
 *   - src/components/ContactChannels.tsx (CONTACT_CHANNELS) — added in Промпт B
 */

import type { ReactNode } from "react";
import { CONTACTS } from "@/lib/constants";
import {
  TelegramGlyph,
  WhatsAppGlyph,
  MaxGlyph,
  PhoneGlyph,
} from "@/components/icons/messengerGlyphs";

export type ContactChannelKind = "messenger" | "phone";

export interface ContactChannel {
  name: string;
  href: string;
  /** Tailwind classes for button background (solid color or gradient) */
  bg: string;
  /** Inline SVG glyph component, rendered as ReactNode */
  glyph: ReactNode;
  ariaLabel: string;
  kind: ContactChannelKind;
}

const TELEGRAM: ContactChannel = {
  name: "Telegram",
  href: CONTACTS.telegram,
  bg: "bg-[#2AABEE]",
  glyph: <TelegramGlyph />,
  ariaLabel: "Написать в Telegram",
  kind: "messenger",
};

const WHATSAPP: ContactChannel = {
  name: "WhatsApp",
  href: CONTACTS.whatsapp,
  bg: "bg-[#25D366]",
  glyph: <WhatsAppGlyph />,
  ariaLabel: "Написать в WhatsApp",
  kind: "messenger",
};

const MAX: ContactChannel = {
  name: "Max",
  href: CONTACTS.max,
  bg: "bg-gradient-to-br from-[#3FB8FF] to-[#8B38E6]",
  glyph: <MaxGlyph />,
  ariaLabel: "Написать в Max",
  kind: "messenger",
};

const PHONE: ContactChannel = {
  name: "Позвонить",
  href: `tel:${CONTACTS.phoneRaw}`,
  bg: "bg-primary",
  glyph: <PhoneGlyph />,
  ariaLabel: "Позвонить",
  kind: "phone",
};

/** 3 messenger channels for FAB (FloatingMessengers). Phone excluded. */
export const MESSENGER_CHANNELS: readonly ContactChannel[] = [
  TELEGRAM,
  WHATSAPP,
  MAX,
] as const;

/** 4 contact channels for inline blocks (e.g. calculator results). */
export const CONTACT_CHANNELS: readonly ContactChannel[] = [
  ...MESSENGER_CHANNELS,
  PHONE,
] as const;
