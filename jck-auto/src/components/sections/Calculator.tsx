"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator as CalcIcon, Check, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  calculateTotal,
  formatPrice,
  type CalcInput,
  type CalcResult,
  type CarAge,
  type BuyerType,
} from "@/lib/calculator";
import { fetchCBRRates, type CBRRates, COUNTRY_CURRENCY } from "@/lib/currency";
import { type Country } from "@/lib/constants";

const countryOptions: { value: Country; label: string }[] = [
  { value: "china", label: "Китай 🇨🇳" },
  { value: "korea", label: "Южная Корея 🇰🇷" },
  { value: "japan", label: "Япония 🇯🇵" },
];

const ageOptions: { value: CarAge; label: string }[] = [
  { value: "under3", label: "Новый (до 3 лет)" },
  { value: "3to5", label: "3–5 лет" },
  { value: "5to7", label: "5–7 лет" },
  { value: "over7", label: "Старше 7 лет" },
];

const buyerOptions: { value: BuyerType; label: string }[] = [
  { value: "individual", label: "Физическое лицо" },
  { value: "company", label: "Юридическое лицо (ИП)" },
];

const pricePlaceholder: Record<Country, string> = {
  china: "Цена в юанях (¥)",
  korea: "Цена в вонах (₩)",
  japan: "Цена в иенах (¥)",
};

export default function Calculator() {
  const [rates, setRates] = useState<CBRRates | null>(null);
  const [country, setCountry] = useState<Country>("china");
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [power, setPower] = useState("");
  const [age, setAge] = useState<CarAge>("under3");
  const [buyerType, setBuyerType] = useState<BuyerType>("individual");
  const [personalUse, setPersonalUse] = useState(true);
  const [result, setResult] = useState<CalcResult | null>(null);

  useEffect(() => {
    fetchCBRRates().then(setRates);
  }, []);

  const handleCalculate = () => {
    if (!rates) return;
    const p = Number(price);
    const v = Number(volume);
    const hp = Number(power);
    if (!p || !v || !hp) return;

    const input: CalcInput = {
      country,
      priceInCurrency: p,
      engineVolume: v,
      enginePower: hp,
      carAge: age,
      buyerType,
      personalUse: buyerType === "individual" ? personalUse : false,
    };
    setResult(calculateTotal(input, rates));
  };

  const selectClass =
    "mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
  const inputClass = selectClass;

  return (
    <section id="calculator" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            Калькулятор
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-text md:text-4xl">
            Рассчитайте стоимость
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
            Узнайте примерную стоимость импорта автомобиля &laquo;под ключ&raquo;
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-12 max-w-5xl rounded-2xl border border-border bg-surface p-6 md:p-8"
        >
          {!rates ? (
            <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Загрузка курсов ЦБ...</span>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2">
              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text">Страна</label>
                  <select value={country} onChange={(e) => { setCountry(e.target.value as Country); setResult(null); }} className={selectClass}>
                    {countryOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-text">Цена автомобиля</label>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={pricePlaceholder[country]} className={inputClass} />
                  <p className="mt-1 text-xs text-text-muted">
                    1 {COUNTRY_CURRENCY[country].code} = {rates[COUNTRY_CURRENCY[country].code].toFixed(2)} ₽
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-text">Объём двигателя</label>
                  <input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="см³, например 1500" className={inputClass} />
                </div>

                <div>
                  <label className="text-sm font-medium text-text">Мощность двигателя</label>
                  <input type="number" value={power} onChange={(e) => setPower(e.target.value)} placeholder="л.с., например 150" className={inputClass} />
                </div>

                <div>
                  <label className="text-sm font-medium text-text">Возраст автомобиля</label>
                  <select value={age} onChange={(e) => setAge(e.target.value as CarAge)} className={selectClass}>
                    {ageOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-text">Тип покупателя</label>
                  <select value={buyerType} onChange={(e) => setBuyerType(e.target.value as BuyerType)} className={selectClass}>
                    {buyerOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <AnimatePresence>
                  {buyerType === "individual" && (
                    <motion.label
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex cursor-pointer items-center gap-3 overflow-hidden"
                    >
                      <input
                        type="checkbox"
                        checked={personalUse}
                        onChange={(e) => setPersonalUse(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-text">Для личного пользования</span>
                    </motion.label>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleCalculate}
                  className="w-full rounded-xl bg-secondary px-6 py-3.5 font-medium text-white transition-colors hover:bg-secondary-hover"
                >
                  Рассчитать стоимость
                </button>
              </div>

              {/* Result */}
              <div className="flex flex-col justify-center">
                {result ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-text-muted">
                        Стоимость &laquo;под ключ&raquo;
                      </p>
                      <p className="mt-1 text-3xl font-bold text-primary">
                        {formatPrice(result.totalRub)}
                      </p>
                      <p className="mt-1 text-sm text-text-muted">
                        Доставка до {result.deliveryCity}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <p className="text-sm font-medium text-text">В стоимость включено:</p>
                      {result.breakdown.map((item) => (
                        <div key={item.label} className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Check className="h-3 w-3 text-primary" />
                          </span>
                          <span className="text-sm text-text-muted">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-text-muted">
                      Курс ЦБ РФ на {result.currencyRate.date}: 1 EUR = {result.currencyRate.eurRate.toFixed(2)} ₽ | 1 {result.currencyRate.code} = {result.currencyRate.rate.toFixed(result.currencyRate.code === "KRW" ? 4 : 2)} ₽
                    </p>

                    <Link
                      href="/calculator"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Подробный расчёт <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="text-center text-text-muted">
                    <CalcIcon className="mx-auto h-12 w-12 text-border" />
                    <p className="mt-4 text-sm">
                      Заполните данные и нажмите &laquo;Рассчитать&raquo; для получения стоимости &laquo;под ключ&raquo;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
