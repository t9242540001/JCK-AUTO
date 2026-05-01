"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface CarGalleryProps {
  photos: string[];
  alt: string;
}

export default function CarGallery({ photos, alt }: CarGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      {/* Main photo */}
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-surface">
        <Image
          src={photos[activeIndex]}
          alt={`${alt} — фото ${activeIndex + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 60vw"
          priority
        />
      </div>

      {/* Thumbnails — scroll-snap on mobile */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
        {photos.map((photo, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            aria-label={`Показать фото ${i + 1} из ${photos.length}`}
            aria-current={i === activeIndex ? "true" : undefined}
            className={cn(
              "relative h-16 w-24 flex-shrink-0 snap-start overflow-hidden rounded-lg transition-all sm:h-20 sm:w-28",
              activeIndex === i
                ? "ring-2 ring-primary ring-offset-2"
                : "opacity-60 hover:opacity-100"
            )}
          >
            <Image
              src={photo}
              alt={`${alt} — миниатюра ${i + 1}`}
              fill
              className="object-cover"
              sizes="112px"
              loading={i === 0 ? "eager" : "lazy"}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
