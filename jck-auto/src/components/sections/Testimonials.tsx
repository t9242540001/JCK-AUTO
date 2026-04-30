"use client";

import { useEffect, useRef, useState } from "react";
import * as m from "framer-motion/m";
import { Star } from "lucide-react";
import { testimonials } from "@/data/testimonials";
import { CONTACTS } from "@/lib/constants";

const countryFlag: Record<string, string> = {
  china: "🇨🇳",
  korea: "🇰🇷",
  japan: "🇯🇵",
};

export default function Testimonials() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // RULE: IntersectionObserver MUST use `root: containerRef.current` because
  // the horizontal scroll happens INSIDE the container, not in the page
  // viewport. With default root (viewport), the observer never fires while
  // the user swipes — the page itself doesn't scroll. Threshold list lets
  // us pick the entry with the maximum intersectionRatio as "most visible".
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIdx = -1;
        let bestRatio = 0;
        for (const entry of entries) {
          const idx = cardRefs.current.indexOf(entry.target as HTMLDivElement);
          if (idx === -1) continue;
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIdx = idx;
          }
        }
        if (bestIdx !== -1) setActiveIndex(bestIdx);
      },
      { root, threshold: [0, 0.5, 1] },
    );

    cardRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="testimonials" className="bg-surface-alt py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Отзывы
          </p>
          <h2 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl">
            Что говорят клиенты
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-text-muted sm:text-lg">
            Реальные отзывы людей, которые уже привезли авто с нашей помощью
          </p>
        </m.div>

        {/* Desktop grid */}
        <div className="mt-12 hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
          {testimonials.slice(0, 3).map((t, i) => (
            <m.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-border bg-white p-6"
            >
              <div className="flex gap-1">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star
                    key={j}
                    className="h-4 w-4 fill-secondary text-secondary"
                  />
                ))}
              </div>
              <p className="mt-4 text-sm text-text-muted">
                &laquo;{t.text}&raquo;
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <div>
                  <p className="text-sm font-medium text-text">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.city}</p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-alt px-3 py-1 text-xs font-medium text-text-muted">
                  {countryFlag[t.country]} {t.car}
                </span>
              </div>
            </m.div>
          ))}
        </div>

        {/* Mobile horizontal scroll */}
        <div
          ref={containerRef}
          className="mt-12 flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory md:hidden"
        >
          {testimonials.map((t, idx) => (
            // RULE: deterministic card width is required for horizontal scroll
            // with shrink-0. `min-w-` alone lets the card grow to fit the
            // intrinsic single-line width of the inner <p> (long testimonial
            // text expands the card past the viewport edge — the bug
            // observed after P-12 deploy). Use `w-[85vw]` (anchors to
            // viewport so the card always fits with a peek of the next),
            // capped by `max-w-[320px]` for wider mobile devices, and keep
            // `shrink-0` so flex never collapses cards below this width.
            <div
              key={t.id}
              ref={(el) => {
                cardRefs.current[idx] = el;
              }}
              className="w-[85vw] max-w-[320px] shrink-0 rounded-2xl border border-border bg-white p-6 snap-start"
            >
              <div className="flex gap-1">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star
                    key={j}
                    className="h-4 w-4 fill-secondary text-secondary"
                  />
                ))}
              </div>
              <p className="mt-4 text-sm text-text-muted">
                &laquo;{t.text}&raquo;
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <div>
                  <p className="text-sm font-medium text-text">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.city}</p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-alt px-3 py-1 text-xs font-medium text-text-muted">
                  {countryFlag[t.country]} {t.car}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination dots — mobile only, decorative */}
        <div
          className="mt-4 flex justify-center gap-2 md:hidden"
          aria-hidden="true"
        >
          {testimonials.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === activeIndex ? "w-6 bg-primary" : "w-2 bg-border"
              }`}
            />
          ))}
        </div>

        <m.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <a
            href={CONTACTS.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Больше отзывов на YouTube &rarr;
          </a>
        </m.div>
      </div>
    </section>
  );
}
