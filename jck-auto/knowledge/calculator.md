# Калькулятор — бизнес-логика расчёта стоимости
> Обновлено: 2026-04-08

## Единый движок

**src/lib/calculator.ts** — единственный источник формул. Используется:
- Сайт: CalculatorCore.tsx, CustomsClient.tsx
- Бот: bot/handlers/calculator.ts
- Encar: api/tools/encar/route.ts
- Legacy обёртка: priceCalculator.ts

## Формула «под ключ» (5 шагов)

```
Шаг 1: priceInCurrency + логистика по стране (DELIVERY_COST в tariffs.ts)
Шаг 2: carValueRub = шаг1 × операционный курс (из fetchCBRRates, УЖЕ с наценкой)
Шаг 3: customs = customsFee + ETS/duties + recyclingFee
Шаг 4: russiaExpenses = фиксированная сумма ₽ (СБКТС, СВХ, брокер, логистика)
Шаг 5: commission = комиссия JCK AUTO
ИТОГО: totalRub = carValueRub + customs + russiaExpenses + commission
```

## CalcInput интерфейс

```typescript
interface CalcInput {
  priceInCurrency: number;      // цена в валюте
  currencyCode: CurrencyCode;   // CNY | KRW | JPY | EUR | USD
  engineVolume: number;          // см³ (0 для электро)
  enginePower: number;           // л.с.
  carAge: CarAge;                // under3 | 3to5 | 5to7 | over7
  buyerType: 'individual' | 'company';
  personalUse: boolean;
  country?: Country;             // china | korea | japan (добавляет логистику)
  engineType?: EngineType;       // petrol | diesel | hybrid | electric
}
```

## Два режима калькулятора

| Калькулятор | URL | Scope | Покупатель |
|-----------|-----|-------|------------|
| «Под ключ» | /tools/calculator | Полная стоимость с логистикой | Только физлицо |
| Пошлин | /tools/customs | Только таможня, без логистики | Физ + юр (два столбца) |

## Shared UI

`src/components/calculator/CalculatorCore.tsx` — единый компонент формы и результата:
- Используется на /tools/calculator (CalculatorClient.tsx — тонкий враппер с h1, BetaBadge)
- Используется на главной (sections/Calculator.tsx — тонкий враппер с h2, showDeepLink)
- Prop `showDeepLink` — ссылка «Открыть полный калькулятор →» на главной
- Загружает курсы через `/api/exchange-rates` (НЕ через fetchCBRRates напрямую)

## Тарифные данные

Источник: `src/lib/tariffs.ts` (бывший calculator-data.ts)
- TARIFF_META: lastUpdated, validUntil, sources (нормативные документы)
- Все ставки: ЕТС, пошлины, акциз, утильсбор, фиксированные расходы
- **@rule: НЕ менять числа без проверки нормативки**
- Подробности правил → `knowledge/customs-reference.md`
