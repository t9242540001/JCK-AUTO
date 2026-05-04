/**
 * @file Inline SVG glyphs for messenger channels.
 * @important All glyphs use `currentColor` so the parent button can
 *   set color via `text-white` / `text-current` classes. Glyph size is
 *   controlled by parent via `className` prop (typically "h-5 w-5").
 *
 * @rule MaxGlyph path uses fill-rule="evenodd" — this produces the
 *   inner dot via subpath subtraction. Removing the attribute
 *   collapses the dot into a solid bubble (loses Max brand recognition).
 *
 * @dependencies Used by FloatingMessengers.tsx, ContactChannels.tsx,
 *   and src/lib/messengerChannels.tsx.
 */

import { Send, Phone } from "lucide-react";

interface GlyphProps {
  className?: string;
}

export function TelegramGlyph({ className = "h-5 w-5" }: GlyphProps) {
  return <Send className={className} aria-hidden />;
}

export function WhatsAppGlyph({ className = "h-5 w-5" }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function MaxGlyph({ className = "h-5 w-5" }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.5 4C7.81 4 4 7.81 4 12.5c0 1.93.65 3.71 1.74 5.13L4.5 21l3.5-1.21A8.43 8.43 0 0 0 12.5 21c4.69 0 8.5-3.81 8.5-8.5S17.19 4 12.5 4Zm0 11.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"
      />
    </svg>
  );
}

export function PhoneGlyph({ className = "h-5 w-5" }: GlyphProps) {
  return <Phone className={className} aria-hidden />;
}
