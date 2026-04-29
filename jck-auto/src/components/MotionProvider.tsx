"use client";

/**
 * @file        src/components/MotionProvider.tsx
 * @purpose     Глобальная LazyMotion обёртка для tree-shake'инга framer-motion.
 *              Позволяет использовать `m.X` вместо `motion.X` во всех client-компонентах,
 *              сокращая initial bundle с ~34 KB до ~4.6 KB.
 * @usage       Обёрнут вокруг <main> в src/app/layout.tsx. Все потомки могут
 *              использовать `import * as m from "framer-motion/m"` для motion-элементов.
 * @rule        НЕ ИСПОЛЬЗОВАТЬ `motion` напрямую (только `m`) внутри обёртки —
 *              иначе bundle снова раздуется до полного motion (~34 KB).
 *              После полной миграции проекта `strict` будет включён, и `motion`
 *              начнёт бросать runtime error.
 * @dependencies framer-motion (LazyMotion, domAnimation)
 * @lastModified 2026-04-29
 */

import { LazyMotion, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

export default function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
