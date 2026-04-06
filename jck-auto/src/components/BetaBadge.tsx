/**
 * @file BetaBadge.tsx
 * @description Универсальные компоненты бета-метки для раздела «Сервисы»
 * @runs browser
 * @rule Когда инструменты готовы к продакшну — поменять BETA_MODE на false, все badge исчезнут
 */

import { Construction } from "lucide-react";
import { CONTACTS } from "@/lib/constants";

// @important: единый флаг — false убирает все бета-метки с сайта
export const BETA_MODE = true;

/** Inline badge «БЕТА» рядом с заголовком */
export function BetaBadge() {
  if (!BETA_MODE) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      БЕТА
    </span>
  );
}

/** Тонкая полоска-баннер вверху контентной области */
export function BetaBanner() {
  if (!BETA_MODE) return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 py-2 px-4 text-center">
      <p className="text-xs text-amber-700 inline-flex items-center gap-1.5">
        <Construction className="h-3.5 w-3.5" />
        Инструмент в разработке. Нашли ошибку?{" "}
        <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="text-amber-700 underline">
          Напишите нам
        </a>
      </p>
    </div>
  );
}
