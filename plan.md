# План реализации SEO для jckauto.ru

## Текущее состояние (аудит)

| Страница | title | description | keywords | OG | canonical | JSON-LD |
|---|---|---|---|---|---|---|
| layout.tsx (база) | ✅ template | ✅ | ✅ | ⚠️ нет image | ✅ | ✅ Organization + WebSite |
| `/` (page.tsx) | ✅ absolute | ✅ | ✅ | наследует layout (нет image) | наследует | наследует |
| `/about` | ✅ absolute | ✅ | ✅ | ❌ нет своего OG | ❌ нет canonical | ❌ нет AboutPage JSON-LD |
| `/calculator` | ❌ **нет metadata** (use client) | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/catalog` | ❌ **нет metadata** | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/catalog/[id]` | ✅ generateMetadata | ✅ | ✅ | ⚠️ есть, но нет OG image fallback | ❌ нет canonical | ❌ нет Product JSON-LD |
| `/blog` | ✅ absolute | ✅ | ✅ | ❌ нет своего OG | ❌ нет canonical | ❌ |

**Главные проблемы:**
1. OG image отсутствует на всех страницах (TODO в layout.tsx)
2. `/calculator` — "use client", поэтому metadata export невозможен → нужен рефакторинг
3. `/catalog` — вообще нет metadata export
4. JSON-LD только Organization + WebSite в layout, нет LocalBusiness, Product, AboutPage
5. Нет canonical на дочерних страницах
6. Нет robots.txt (только robots в metadata)

---

## Файлы для изменения

### 1. `public/images/og-image.jpg` — СОЗДАТЬ
- **Действие:** Создать OG-картинку 1200×630 px
- **Содержание:** Логотип JCK AUTO, текст "Импорт авто из Китая, Кореи и Японии под ключ", фон с фото авто
- **Примечание:** Если нет дизайна — сделать программно через Next.js `opengraph-image.tsx` (ImageResponse API) или попросить пользователя предоставить

### 2. `src/app/layout.tsx` — ИЗМЕНИТЬ

**Добавить OG image:**
```tsx
openGraph: {
  // ...existing
  images: [
    {
      url: "/images/og-image.jpg",
      width: 1200,
      height: 630,
      alt: "JCK AUTO — импорт авто из Китая, Кореи и Японии",
    },
  ],
},
twitter: {
  // ...existing
  images: ["/images/og-image.jpg"],
},
```

**JSON-LD — расширить компонент `<JsonLd />`** (или перенести данные в layout):
- Не трогать существующий Organization и WebSite — они корректны

### 3. `src/components/layout/JsonLd.tsx` — ИЗМЕНИТЬ

**Добавить `LocalBusiness`** (на всех страницах, т.к. компонент в layout):
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "JCK AUTO",
  "description": "Импорт автомобилей из Китая, Кореи и Японии под ключ",
  "url": "https://jckauto.ru",
  "telephone": "+7-914-732-19-50",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Уссурийск",
    "addressRegion": "Приморский край",
    "addressCountry": "RU"
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    "opens": "09:00",
    "closes": "19:00"
  },
  "sameAs": [
    "https://t.me/jck_auto_manager",
    "https://youtube.com/@JCK_AUTO"
  ]
}
```

> Вариант: LocalBusiness вместо Organization (LocalBusiness наследует Organization, так что sameAs, telephone и остальные поля остаются). Можно объединить в один блок, чтобы не дублировать.

### 4. `src/app/page.tsx` (Главная `/`) — ИЗМЕНИТЬ

**Добавить OG и canonical:**
```tsx
export const metadata: Metadata = {
  title: {
    absolute: "JCK AUTO — импорт авто из Китая, Кореи и Японии под ключ",
  },
  description: "Привезём автомобиль из Китая, Кореи или Японии под ключ. Подбор, проверка, доставка, таможенное оформление. Гарантия ВСК до 2 лет. Рассчитайте стоимость онлайн.",
  keywords: "купить авто из Китая, автомобиль из Кореи, машина из Японии, импорт авто, авто под заказ, JCK AUTO, растаможка авто",
  openGraph: {
    title: "JCK AUTO — импорт авто из Китая, Кореи и Японии под ключ",
    description: "Привезём автомобиль из Китая, Кореи или Японии под ключ. Подбор, проверка, доставка, гарантия ВСК до 2 лет.",
    url: "https://jckauto.ru",
  },
  alternates: {
    canonical: "https://jckauto.ru",
  },
};
```
> OG image наследуется из layout, дублировать не нужно.

### 5. `src/app/about/page.tsx` (`/about`) — ИЗМЕНИТЬ

**Добавить OG, canonical, JSON-LD:**
```tsx
export const metadata: Metadata = {
  title: {
    absolute: "О компании JCK AUTO — надёжный импорт автомобилей из Азии",
  },
  description: "JCK AUTO — импорт автомобилей из Китая, Кореи и Японии с полным сопровождением. Проверка перед покупкой, доставка, таможня, гарантия ВСК до 2 лет.",
  keywords: "JCK AUTO, импорт авто из Китая Кореи Японии, компания по ввозу автомобилей, гарантия ВСК автомобиль",
  openGraph: {
    title: "О компании JCK AUTO — надёжный импорт автомобилей из Азии",
    description: "JCK AUTO — импорт автомобилей из Китая, Кореи и Японии с полным сопровождением.",
    url: "https://jckauto.ru/about",
  },
  alternates: {
    canonical: "https://jckauto.ru/about",
  },
};
```

**Добавить JSON-LD `AboutPage`:**
Внутри компонента — `<script type="application/ld+json">` с:
```json
{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "О компании JCK AUTO",
  "description": "Импорт автомобилей из Китая, Кореи и Японии под ключ",
  "url": "https://jckauto.ru/about",
  "mainEntity": {
    "@type": "Organization",
    "name": "JCK AUTO"
  }
}
```

### 6. `src/app/calculator/page.tsx` (`/calculator`) — РЕФАКТОРИНГ

**Проблема:** Файл помечен `"use client"` → нельзя экспортировать `metadata`.

**Решение:** Разделить на 2 файла:
- `src/app/calculator/page.tsx` — серверный компонент с metadata + импорт клиентского
- `src/app/calculator/CalculatorClient.tsx` — перенести сюда текущий "use client" код

**page.tsx (новый, серверный):**
```tsx
import type { Metadata } from "next";
import CalculatorClient from "./CalculatorClient";

export const metadata: Metadata = {
  title: "Калькулятор растаможки авто из Китая — рассчитайте стоимость под ключ",
  description: "Онлайн-калькулятор полной стоимости авто из Китая, Кореи, Японии. Растаможка, доставка, ЭПТС, СБКТС — все расходы в одном расчёте.",
  keywords: "калькулятор растаможки, стоимость авто из Китая, растаможка авто калькулятор, авто из Японии стоимость",
  openGraph: {
    title: "Калькулятор растаможки авто — JCK AUTO",
    description: "Рассчитайте полную стоимость авто из Китая, Кореи или Японии под ключ.",
    url: "https://jckauto.ru/calculator",
  },
  alternates: {
    canonical: "https://jckauto.ru/calculator",
  },
};

export default function CalculatorPage() {
  return <CalculatorClient />;
}
```

**CalculatorClient.tsx** — всё текущее содержимое page.tsx (без изменений, только переименование).

### 7. `src/app/catalog/page.tsx` (`/catalog`) — ИЗМЕНИТЬ

**Добавить metadata** (файл серверный, можно экспортировать metadata напрямую):
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Каталог автомобилей из Китая — цены под ключ в рублях",
  description: "Автомобили из Китая, Кореи и Японии в наличии. Цена под ключ в рублях с доставкой и растаможкой. Гарантия ВСК до 2 лет.",
  keywords: "купить авто из Китая, каталог авто из Японии, авто в наличии, цена под ключ",
  openGraph: {
    title: "Каталог автомобилей — JCK AUTO",
    description: "Авто из Китая, Кореи и Японии в наличии с ценой под ключ в рублях.",
    url: "https://jckauto.ru/catalog",
  },
  alternates: {
    canonical: "https://jckauto.ru/catalog",
  },
};
```

### 8. `src/app/catalog/[id]/page.tsx` (`/catalog/[id]`) — ИЗМЕНИТЬ

**a) Добавить canonical в generateMetadata:**
```tsx
alternates: {
  canonical: `https://jckauto.ru/catalog/${id}`,
},
```

**b) Добавить OG image fallback:**
```tsx
openGraph: {
  // ...existing
  images: car.photos.length > 0
    ? [{ url: car.photos[0], width: 800, height: 600, alt: `${brand} ${car.model} ${car.year}` }]
    : [{ url: "/images/og-image.jpg", width: 1200, height: 630, alt: "JCK AUTO" }],
},
```

**c) Добавить JSON-LD `Product`** в компоненте CarDetailPage:
```tsx
const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": `${brand} ${car.model} ${car.year}`,
  "description": `${brand} ${car.model} ${car.year}, ${car.engineVolume} ${car.transmission}`,
  "image": car.photos[0] || "",
  "brand": { "@type": "Brand", "name": brand },
  "model": car.model,
  "vehicleModelDate": String(car.year),
  "offers": {
    "@type": "Offer",
    "price": car.priceRub || car.price,
    "priceCurrency": car.priceRub ? "RUB" : "CNY",
    "availability": "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "JCK AUTO" }
  }
};

// В JSX:
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
```

### 9. `src/app/blog/page.tsx` (`/blog`) — ИЗМЕНИТЬ

**Обновить title и добавить OG + canonical:**
```tsx
export const metadata: Metadata = {
  title: {
    absolute: "Блог JCK AUTO — гайды по импорту авто из Азии",
  },
  description: "Полезные статьи об импорте автомобилей из Китая, Кореи и Японии: растаможка, выбор авто, обзоры, советы покупателям.",
  keywords: "блог импорт авто, статьи растаможка, обзоры китайских авто, как привезти авто из Японии",
  openGraph: {
    title: "Блог JCK AUTO — гайды по импорту авто из Азии",
    description: "Полезные статьи об импорте автомобилей из Китая, Кореи и Японии.",
    url: "https://jckauto.ru/blog",
  },
  alternates: {
    canonical: "https://jckauto.ru/blog",
  },
};
```

---

## Сводка изменений

| # | Файл | Действие | Что добавляется |
|---|---|---|---|
| 1 | `public/images/og-image.jpg` | Создать | OG-картинка 1200×630 |
| 2 | `src/app/layout.tsx` | Изменить | OG image в metadata |
| 3 | `src/components/layout/JsonLd.tsx` | Изменить | LocalBusiness (адрес, часы работы) |
| 4 | `src/app/page.tsx` | Изменить | OG, canonical |
| 5 | `src/app/about/page.tsx` | Изменить | OG, canonical, title, JSON-LD AboutPage |
| 6 | `src/app/calculator/page.tsx` | Рефакторинг | Разделить на server page + client component |
| 6b| `src/app/calculator/CalculatorClient.tsx` | Создать | Текущий код калькулятора |
| 7 | `src/app/catalog/page.tsx` | Изменить | metadata: title, description, keywords, OG, canonical |
| 8 | `src/app/catalog/[id]/page.tsx` | Изменить | canonical, OG image fallback, JSON-LD Product |
| 9 | `src/app/blog/page.tsx` | Изменить | OG, canonical, обновить title |

**Итого: 8 файлов изменить + 2 файла создать (OG image + CalculatorClient.tsx)**

## Порядок выполнения

1. Рефакторинг калькулятора (split use client) — обязательно первый, т.к. без него metadata невозможен
2. Добавить metadata на все страницы (catalog, calculator, обновить about, blog)
3. Добавить OG image в layout.tsx
4. Расширить JsonLd.tsx — добавить LocalBusiness
5. Добавить JSON-LD Product на /catalog/[id]
6. Добавить JSON-LD AboutPage на /about
7. Создать/сгенерировать OG-изображение
8. Проверить сборку (`npm run build`)
