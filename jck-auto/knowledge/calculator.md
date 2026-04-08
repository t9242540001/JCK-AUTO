<!--
  @file:        knowledge/calculator.md
  @project:     JCK AUTO
  @description: Customs/price calculation business logic, formulas, critical rules
  @updated:     2026-04-08
  @version:     1.0
  @lines:       120
-->

# Calculator Business Logic

## Source of Truth

- **Calculation engine:** `src/lib/calculator.ts` — used by BOTH site and bot
- **Tariff data:** `src/lib/tariffs.ts` (formerly `calculator-data.ts`)
- **Currency rates:** `src/lib/currencyRates.ts` (formerly `currency.ts`)
- **Legacy wrapper:** `src/lib/priceCalculator.ts` (thin wrapper for bot/scripts)
- **Shared UI:** `src/components/calculator/CalculatorCore.tsx`

## "Pod Klyuch" Formula (5 steps)

```
Step 1: totalCurrency = priceCurrency + domesticLogistics (country-specific)
Step 2: carValueRub = totalCurrency × operationalRate (VTB or CBR+markup)
Step 3: customs = customsFee + ETS/duties + recyclingFee
Step 4: russiaExpenses = fixed ₽ (SBKTS, SVH, broker, logistics)
Step 5: commission = JCK AUTO fee
TOTAL: priceRub = carValueRub + customs + russiaExpenses + commission
```

## Exchange Rates

- Rates from `fetchCBRRates()` ALREADY include bank markup
- Do NOT multiply by any additional markup constant
- UI shows "Ориентировочный курс" (not "Курс ЦБ РФ")
- Disclaimer: "Расчёт ориентировочный. Реальный курс уточняется при оформлении заявки"

## CalcInput Interface

```typescript
interface CalcInput {
  priceInCurrency: number;
  currencyCode: CurrencyCode;     // CNY | KRW | JPY | EUR | USD
  engineVolume: number;            // cm³ (0 for electric)
  enginePower: number;             // hp
  carAge: CarAge;                  // under3 | 3to5 | 5to7 | over7
  buyerType: 'individual' | 'company';
  personalUse: boolean;
  country?: Country;               // china | korea | japan (adds logistics)
  engineType?: EngineType;         // petrol | diesel | hybrid | electric
}
```

## Age Categories (ETS for individuals)

| Age | CarAge value | ETS basis | Note |
|-----|-------------|-----------|------|
| 0–2 years (< 3) | `under3` | % of EUR value | Higher of % or per-cc rate |
| 3–5 years (**≤ 5**) | `3to5` | volume × rate × EUR | Per-cc brackets |
| 5–7 years | `5to7` | volume × rate × EUR | Higher per-cc rates |
| 7+ years | `over7` | volume × rate × EUR | Highest per-cc rates |

**CRITICAL:** The 5-year boundary is INCLUSIVE — a car exactly 5 years old = `3to5`.
Historical bug: `years < 5` instead of `years <= 5` caused ~218,000 ₽ overcharge for 2021 cars.

## Recycling Fee (Individuals)

Preferential rate applies when **BOTH** conditions are true:
- Engine power **≤ 160 hp** (inclusive)
- Engine volume **≤ 3000 cm³** (inclusive)
- `personalUse === true`

If ANY condition fails → commercial rate (jump to ~1,900,000+ ₽).

| Condition | Under 3 years | 3+ years |
|-----------|--------------|----------|
| Preferential (≤160hp AND ≤3L) | 3,400 ₽ | 5,200 ₽ |
| Commercial (>160hp OR >3L) | ~662K–4.1M ₽ | ~1M–4.1M ₽ |

## Bracket Logic

`findBracket` uses `value <= row[key]` — upper boundary is **INCLUSIVE**.
Example: 1500cc → bracket "up to 1500" (rate 1.7), 1501cc → bracket "up to 1800" (rate 2.5).

## Two Calculator Modes

| Calculator | URL | Scope | Buyer types |
|-----------|-----|-------|-------------|
| "Pod klyuch" | /tools/calculator | Full cost with logistics | Individual only |
| Customs | /tools/customs | Duties only, no logistics | Individual + Company side-by-side |

## Reference Data

Normative source: `Калькулятор_и_полный_справочник_нормативных_данных.xlsx`
When rates change — verify against this file, then update `src/lib/tariffs.ts`.
