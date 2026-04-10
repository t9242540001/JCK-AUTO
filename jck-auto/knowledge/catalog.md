<!--
  @file:        knowledge/catalog.md
  @project:     JCK AUTO
  @description: Google Drive conventions, 5-step sync chain, screenshot priority
  @updated:     2026-04-08
  @version:     1.0
  @lines:       85
-->

# Catalog System

## Google Drive File Naming Convention

| Filename | Role | Detection |
|----------|------|-----------|
| `1.jpg` / `1.jpeg` / `1.png` | **Cover** photo for card | `findCoverPhotoIndex()` in catalogSync.ts |
| `2.jpg` / `2.jpeg` / `2.png` | **Screenshot** for AI parsing | `isScreenshot()` in googleDrive.ts |
| `3.jpg`, `4.jpg`... | **Gallery** photos | Everything else → photos[] |
| `front*.jpg` / `cover*.jpg` | Alt cover name | `findCoverPhotoIndex()` |
| `screen*.png` / `скрин*.png` | Alt screenshot name | `isScreenshot()` |

**Note:** `.jpg` and `.jpeg` are treated identically — extension stripped after last dot.

## 5-Step Sync Chain

```
Step 1 — VDS: sync-catalog.ts
  → Downloads from Drive, separates cover/screenshot/gallery
  → Writes catalog.json (SKIP_BUILD=true, no AI)

Step 2 — GitHub Actions runner:
  → SCP downloads catalog.json + screenshots from VDS

Step 3 — GitHub Actions runner: process-ai-pending.ts
  → Claude Vision API → car specs from screenshot
  → CBR rate → priceRub
  → exit(1) if 0 processed and errors exist

Step 3.5 — GitHub Actions runner: generate-descriptions.ts
  → Claude Text API → description (80-150 words)
  → Rate limit: 2 sec between requests
  → Does NOT overwrite existing descriptions

Step 4 — GitHub Actions runner:
  → SCP uploads updated catalog.json back to VDS

Step 5 — VDS:
  → npm run build && pm2 restart jckauto
```

## Screenshot Selection Priority (5 levels)

1. File named `2.*` (any extension)
2. File named `screenshot.*` or containing `скрин`, `screen`, `spec`, `info`
3. First file from screenshots[]
4. First PNG among photos[]
5. All folder files (up to 5, sorted by size DESC) — multi-image mode

**Screenshot is excluded from gallery** — removed from photos[] before forming orderedPhotos.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/catalogSync.ts` | Main sync logic, cover selection |
| `src/lib/googleDrive.ts` | Drive API, screenshot detection |
| `src/lib/screenshotParser.ts` | AI image parsing |
| `scripts/sync-catalog.ts` | Cron orchestrator (VDS side) |
| `scripts/process-ai-pending.ts` | AI processing (runner side) |
| `scripts/generate-descriptions.ts` | AI descriptions (runner side) |

## Storage

- Catalog JSON: `/var/www/jckauto/storage/catalog/catalog.json`
- Car photos: `/var/www/jckauto/storage/catalog/{carId}/`
- Site reads catalog via `readCatalogJson()` from `src/lib/blobStorage.ts`
- ISR revalidation: 1 hour for `/catalog` page

## Noscut Models Selection Criteria

**Rule:** The noscut catalog covers the most popular imported cars in Russia
over the last 5 years (2020–2025), based on official sales statistics and
parallel import data (Autostat, AEB).

Sources considered:
- New car sales (official + authorized dealers)
- Parallel import volumes by brand and model
- Secondary market demand

Current coverage: Toyota, Lexus, Honda, Nissan, Mitsubishi, Hyundai, Kia,
Genesis, Haval, Chery, Geely, BYD, Li Auto, NIO, Changan.

Missing brands identified for addition: BMW, Mercedes-Benz, Volkswagen,
Subaru, Mazda, Audi, Skoda.
