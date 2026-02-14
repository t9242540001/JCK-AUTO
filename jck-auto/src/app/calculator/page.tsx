"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator as CalcIcon, Check, Phone, Loader2, Send } from "lucide-react";
import {
  calculateTotal,
  formatPrice,
  type CalcInput,
  type CalcResult,
  type CarAge,
  type BuyerType,
} from "@/lib/calculator";
import { fetchCBRRates, type CBRRates, COUNTRY_CURRENCY } from "@/lib/currency";
import { CONTACTS, type Country } from "@/lib/constants";

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

export default function CalculatorPage() {
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
    <div className="min-h-screen bg-white pb-20 pt-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl px-4 text-center"
      >
        <p className="text-sm font-medium uppercase tracking-wider text-secondary">
          Калькулятор стоимости
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold text-text sm:text-3xl md:text-4xl lg:text-5xl">
          Сколько стоит привезти автомобиль?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
          Введите параметры и получите расчёт всех расходов &laquo;под ключ&raquo;: таможня, утильсбор, доставка, оформление
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-auto mt-12 max-w-5xl px-4"
      >
        <div className="rounded-2xl border border-border bg-surface p-6 md:p-10">
          {!rates ? (
            <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Загрузка курсов ЦБ РФ...</span>
            </div>
          ) : (
            <div className="grid gap-10 md:grid-cols-2">
              {/* Form */}
              <div className="space-y-5">
                <h3 className="font-heading font-semibold text-text">
                  Параметры автомобиля
                </h3>

                <div>
                  <label className="text-sm font-medium text-text">Страна</label>
                  <select
                    value={country}
                    onChange={(e) => { setCountry(e.target.value as Country); setResult(null); }}
                    className={selectClass}
                  >
                    {countryOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-text">Цена автомобиля</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={pricePlaceholder[country]}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    1 {COUNTRY_CURRENCY[country].code} = {rates[COUNTRY_CURRENCY[country].code].toFixed(2)} ₽
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-text">Объём двигателя</label>
                  <input
                    type="number"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    placeholder="см³, например 1500"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-text">Мощность двигателя</label>
                  <input
                    type="number"
                    value={power}
                    onChange={(e) => setPower(e.target.value)}
                    placeholder="л.с., например 150"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-text">Возраст автомобиля</label>
                  <select
                    value={age}
                    onChange={(e) => setAge(e.target.value as CarAge)}
                    className={selectClass}
                  >
                    {ageOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-text">Тип покупателя</label>
                  <select
                    value={buyerType}
                    onChange={(e) => setBuyerType(e.target.value as BuyerType)}
                    className={selectClass}
                  >
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3.5 font-medium text-white transition-colors hover:bg-secondary-hover"
                >
                  <CalcIcon className="h-5 w-5" />
                  Рассчитать стоимость
                </button>
              </div>

              {/* Result */}
              <div className="flex flex-col justify-center">
                {result ? (
                  <div>
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

                    <div className="mt-6 space-y-2.5">
                      <p className="text-sm font-medium text-text">В стоимость включено:</p>
                      {result.breakdown.map((item) => (
                        <div key={item.label} className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Check className="h-3 w-3 text-primary" />
                          </span>
                          <span className="text-sm text-text-muted">{item.label}</span>
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 break-words text-xs text-text-muted">
                      Курс ЦБ РФ на {result.currencyRate.date}:{" "}
                      1 EUR = {result.currencyRate.eurRate.toFixed(2)} ₽ |{" "}
                      1 {result.currencyRate.code} = {result.currencyRate.rate.toFixed(result.currencyRate.code === "KRW" ? 4 : 2)} ₽
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <a
                        href={CONTACTS.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3 font-medium text-white transition-colors hover:bg-secondary-hover"
                      >
                        <Send className="h-4 w-4" />
                        Написать в Telegram
                      </a>
                      <a
                        href={`tel:${CONTACTS.phoneRaw}`}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                      >
                        <Phone className="h-4 w-4" />
                        Позвонить специалисту
                      </a>
                    </div>

                    <p className="mt-6 text-xs leading-relaxed text-text-muted">
                      * Расчёт носит информационный характер. Итоговая стоимость может
                      отличаться в зависимости от фактического курса на дату оформления,
                      условий доставки и других факторов. Для точного расчёта свяжитесь
                      с менеджером.
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-text-muted">
                    <CalcIcon className="mx-auto h-12 w-12 text-border" />
                    <p className="mt-4">
                      Заполните данные и нажмите &laquo;Рассчитать стоимость&raquo;
                      для получения стоимости &laquo;под ключ&raquo;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
