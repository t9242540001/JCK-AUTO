"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calculator as CalcIcon, Loader2 } from "lucide-react";
import { calculateTotal, type CalcResult, type CarAge, type EngineType } from "@/lib/calculator";
import { fetchCBRRates, type CBRRates, CURRENCIES, type CurrencyCode } from "@/lib/currencyRates";
import { TARIFF_META } from "@/lib/tariffs";

function formatPrice(value: number): string {
  return value.toLocaleString("ru-RU") + " \u20BD";
}

const KW_TO_HP = 1.35962;

const currencyOptions: { value: CurrencyCode; label: string }[] = [
  { value: "CNY", label: "Юань (¥)" },
  { value: "KRW", label: "Вона (₩)" },
  { value: "JPY", label: "Иена (¥)" },
  { value: "EUR", label: "Евро (€)" },
  { value: "USD", label: "Доллар ($)" },
];

const engineTypeOptions: { value: EngineType; label: string }[] = [
  { value: "petrol", label: "Бензин" },
  { value: "diesel", label: "Дизель" },
  { value: "hybrid", label: "Гибрид" },
  { value: "electric", label: "Электро" },
];

const ageOptions: { value: CarAge; label: string }[] = [
  { value: "under3", label: "До 3 лет" },
  { value: "3to5", label: "3\u20135 лет" },
  { value: "5to7", label: "5\u20137 лет" },
  { value: "over7", label: "Старше 7 лет" },
];

const pricePlaceholder: Record<CurrencyCode, string> = {
  CNY: "Например 82000", KRW: "Например 35000000", JPY: "Например 2500000",
  EUR: "Например 15000", USD: "Например 18000",
};

const SBKTS_FEE = 25_000;

interface ResultColumnProps { title: string; result: CalcResult; currencyCode: CurrencyCode; rates: CBRRates }

function ResultColumn({ title, result, currencyCode, rates }: ResultColumnProps) {
  const totalWithSbkts = result.totalRub + SBKTS_FEE;
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="rounded-xl bg-primary/5 p-3">
        <h3 className="font-heading text-lg font-semibold text-text">{title}</h3>
      </div>
      <div className="mt-4 space-y-3">
        {result.breakdown.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-muted">{item.label}</p>
              {item.details && <p className="mt-0.5 text-xs italic text-text-muted/70">{item.details}</p>}
            </div>
            <p className="shrink-0 text-sm font-medium text-text">{formatPrice(item.value)}</p>
          </div>
        ))}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text-muted">СБКТС</p>
            <p className="mt-0.5 text-xs italic text-text-muted/70">сертификат безопасности конструкции ТС</p>
          </div>
          <p className="shrink-0 text-sm font-medium text-text">{formatPrice(SBKTS_FEE)}</p>
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <p className="font-heading font-semibold text-text">Итого</p>
          <p className="text-lg font-bold text-primary">{formatPrice(totalWithSbkts)}</p>
        </div>
      </div>
      <div className="mt-3 text-xs text-text-muted space-y-1">
        <p>
          Ориентировочный курс: 1 {currencyCode} ≈ {rates[currencyCode].toFixed(currencyCode === "KRW" ? 4 : 2)} ₽ | 1 EUR ≈ {rates.EUR.toFixed(2)} ₽
        </p>
        <p>
          Расчёт ориентировочный. Реальный курс уточняется при оформлении заявки — он зависит от дня сделки и канала перевода.
        </p>
      </div>
    </div>
  );
}

export default function CustomsClient() {
  const [rates, setRates] = useState<CBRRates | null>(null);
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>("CNY");
  const [engineType, setEngineType] = useState<EngineType>("petrol");
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [power, setPower] = useState("");
  const [powerUnit, setPowerUnit] = useState<"hp" | "kw">("hp");
  const [age, setAge] = useState<CarAge>("3to5");
  const [personalUse, setPersonalUse] = useState(true);
  const [individualResult, setIndividualResult] = useState<CalcResult | null>(null);
  const [companyResult, setCompanyResult] = useState<CalcResult | null>(null);

  const isElectric = engineType === "electric";

  useEffect(() => { fetchCBRRates().then(setRates); }, []);

  const handleEngineTypeChange = (val: EngineType) => {
    setEngineType(val);
    clearResults();
    if (val === "electric") { setVolume(""); setPowerUnit("kw"); }
    else if (engineType === "electric") { setPowerUnit("hp"); }
  };

  const togglePowerUnit = () => {
    const val = Number(power);
    if (val > 0) {
      if (powerUnit === "hp") setPower(String(Math.round(val / KW_TO_HP)));
      else setPower(String(Math.round(val * KW_TO_HP)));
    }
    setPowerUnit(powerUnit === "hp" ? "kw" : "hp");
    clearResults();
  };

  const getPowerHp = (): number => {
    const val = Number(power);
    return powerUnit === "kw" ? Math.round(val * KW_TO_HP) : val;
  };

  const handleCalculate = () => {
    if (!rates) return;
    const p = Number(price);
    const hp = getPowerHp();
    if (!p || !hp) return;
    const v = isElectric ? 0 : Number(volume);
    if (!isElectric && !v) return;

    const base = { priceInCurrency: p, currencyCode, engineVolume: v, enginePower: hp, carAge: age, engineType };

    setIndividualResult(calculateTotal({ ...base, buyerType: "individual", personalUse }, rates));
    setCompanyResult(calculateTotal({ ...base, buyerType: "company", personalUse: false }, rates));
  };

  const clearResults = () => { setIndividualResult(null); setCompanyResult(null); };

  const inputClass = "mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
  const toggleBtn = (active: boolean) => `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-primary text-white" : "border border-border text-text-muted hover:bg-primary/10"}`;

  return (
    <div className="mx-auto mt-12 max-w-5xl px-4">
      <div className="rounded-2xl border border-border bg-surface p-6 md:p-10">
        {!rates ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Загрузка курсов ЦБ РФ...</span>
          </div>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-text">Валюта</label>
                <select value={currencyCode} onChange={(e) => { setCurrencyCode(e.target.value as CurrencyCode); clearResults(); }} className={inputClass}>
                  {currencyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-text">Тип двигателя</label>
                <select value={engineType} onChange={(e) => handleEngineTypeChange(e.target.value as EngineType)} className={inputClass}>
                  {engineTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-text">Цена авто ({CURRENCIES[currencyCode].symbol})</label>
                <input type="number" value={price} onChange={(e) => { setPrice(e.target.value); clearResults(); }} placeholder={pricePlaceholder[currencyCode]} className={inputClass} />
              </div>
              {!isElectric && (
                <div>
                  <label className="text-sm font-medium text-text">Объём двигателя (см³)</label>
                  <input type="number" value={volume} onChange={(e) => { setVolume(e.target.value); clearResults(); }} placeholder="Например 1500" className={inputClass} />
                  {engineType === "hybrid" && <p className="mt-1 text-xs text-text-muted">Укажите объём ДВС-части</p>}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text">Мощность</label>
                  <div className="flex gap-1">
                    <button type="button" onClick={togglePowerUnit} className={toggleBtn(powerUnit === "hp")}>л.с.</button>
                    <button type="button" onClick={togglePowerUnit} className={toggleBtn(powerUnit === "kw")}>кВт</button>
                  </div>
                </div>
                <input type="number" value={power} onChange={(e) => { setPower(e.target.value); clearResults(); }} placeholder={powerUnit === "kw" ? "Например 150" : "Например 150"} className={inputClass} />
                {isElectric && <p className="mt-1 text-xs text-text-muted">Мощность электромотора (обычно указана в кВт)</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-text">Возраст</label>
                <select value={age} onChange={(e) => { setAge(e.target.value as CarAge); clearResults(); }} className={inputClass}>
                  {ageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
                  <input type="checkbox" checked={personalUse} onChange={(e) => { setPersonalUse(e.target.checked); clearResults(); }} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                  Для личного пользования
                </label>
              </div>
            </div>

            <button onClick={handleCalculate} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3.5 font-medium text-white transition-colors hover:bg-secondary-hover md:w-auto">
              <CalcIcon className="h-5 w-5" /> Рассчитать пошлины
            </button>

            {individualResult && companyResult ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <ResultColumn title="Физическое лицо" result={individualResult} currencyCode={currencyCode} rates={rates} />
                  <ResultColumn title="Юридическое лицо" result={companyResult} currencyCode={currencyCode} rates={rates} />
                </div>
                <p className="mt-4 text-center text-xs text-text-muted">
                  Ставки актуальны на {TARIFF_META.lastUpdated} | Ориентировочный курс на {rates.date}
                </p>
              </motion.div>
            ) : (
              <div className="mt-10 text-center text-text-muted">
                <CalcIcon className="mx-auto h-12 w-12 text-border" />
                <p className="mt-4">Заполните данные и нажмите &laquo;Рассчитать пошлины&raquo;</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
