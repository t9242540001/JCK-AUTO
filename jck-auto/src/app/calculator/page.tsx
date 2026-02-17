"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calculator as CalcIcon, Phone, Loader2, Send } from "lucide-react";
import {
  calculatePriceFromParams,
  type PriceParams,
  type PriceResult,
} from "@/lib/priceCalculator";
import { fetchCBRRates, type CBRRates } from "@/lib/currency";
import { CONTACTS } from "@/lib/constants";

function formatPrice(value: number): string {
  return value.toLocaleString("ru-RU") + " \u20BD";
}

const ageOptions = [
  { value: 2, label: "До 3 лет" },
  { value: 4, label: "3\u20135 лет" },
  { value: 6, label: "Старше 5 лет" },
];

export default function CalculatorPage() {
  const [rates, setRates] = useState<CBRRates | null>(null);
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [power, setPower] = useState("");
  const [age, setAge] = useState(4);
  const [result, setResult] = useState<PriceResult | null>(null);

  useEffect(() => {
    fetchCBRRates().then(setRates);
  }, []);

  const handleCalculate = () => {
    if (!rates) return;
    const p = Number(price);
    const v = Number(volume);
    const hp = Number(power);
    if (!p || !v || !hp) return;

    const params: PriceParams = {
      priceYuan: p,
      engineVolumeLiters: v,
      horsePower: hp,
      carAgeYears: age,
    };
    setResult(calculatePriceFromParams(params, rates));
  };

  const inputClass =
    "mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

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
          Сколько стоит привезти авто из Китая?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-text-muted sm:text-lg">
          Введите параметры и получите расчёт всех расходов &laquo;под ключ&raquo;
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
                  <label className="text-sm font-medium text-text">
                    Цена автомобиля в Китае
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => { setPrice(e.target.value); setResult(null); }}
                    placeholder="Цена в юанях (\u00A5), например 82000"
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Курс ЦБ: 1 CNY = {rates.CNY.toFixed(2)} \u20BD (расчёт по {(rates.CNY * 1.02).toFixed(2)} \u20BD)
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-text">
                    Объём двигателя (л)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={volume}
                    onChange={(e) => { setVolume(e.target.value); setResult(null); }}
                    placeholder="Например 1.5"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-text">
                    Мощность (л.с.)
                  </label>
                  <input
                    type="number"
                    value={power}
                    onChange={(e) => { setPower(e.target.value); setResult(null); }}
                    placeholder="Например 115"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-text">
                    Возраст автомобиля
                  </label>
                  <select
                    value={age}
                    onChange={(e) => { setAge(Number(e.target.value)); setResult(null); }}
                    className={inputClass}
                  >
                    {ageOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

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
                      <p className="mt-1 text-2xl font-bold text-primary sm:text-3xl">
                        {formatPrice(result.totalRub)}
                      </p>
                      <p className="mt-1 text-sm text-text-muted">
                        Доставка до Уссурийска
                      </p>
                    </div>

                    {/* Breakdown */}
                    <div className="mt-6 space-y-3">
                      <p className="text-sm font-medium text-text">Разбивка стоимости:</p>

                      {/* Car value */}
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-text-muted">Стоимость авто в \u20BD</span>
                        <span className="text-sm font-medium text-text">
                          {formatPrice(result.breakdown.carPriceRub)}
                        </span>
                      </div>

                      {/* Customs group */}
                      <div className="border-b border-border/50 pb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-muted">Таможенные платежи</span>
                          <span className="text-sm font-medium text-text">
                            {formatPrice(
                              result.breakdown.customsFee +
                              result.breakdown.customsDuty +
                              result.breakdown.recyclingFee
                            )}
                          </span>
                        </div>
                        <div className="mt-1 space-y-0.5 pl-3">
                          <div className="flex justify-between text-xs text-text-muted">
                            <span>Таможенное оформление</span>
                            <span>{formatPrice(result.breakdown.customsFee)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-text-muted">
                            <span>Единая таможенная ставка (ЕТС)</span>
                            <span>{formatPrice(result.breakdown.customsDuty)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-text-muted">
                            <span>Утилизационный сбор</span>
                            <span>{formatPrice(result.breakdown.recyclingFee)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Russia expenses */}
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-text-muted">Расходы в РФ (СБКТС, СВХ, брокер, логистика)</span>
                        <span className="text-sm font-medium text-text">
                          {formatPrice(result.breakdown.deliveryCost)}
                        </span>
                      </div>

                      {/* Commission */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-muted">Комиссия JCK AUTO</span>
                        <span className="text-sm font-medium text-text">
                          {formatPrice(result.breakdown.serviceFee)}
                        </span>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-text-muted">
                      Курс ЦБ РФ на {result.date}:{" "}
                      1 CNY = {rates.CNY.toFixed(2)} \u20BD |{" "}
                      1 EUR = {rates.EUR.toFixed(2)} \u20BD
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <a
                        href={CONTACTS.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-6 py-3 font-medium text-white transition-colors hover:bg-[#229ED9]"
                      >
                        <Send className="h-4 w-4" />
                        Написать в Telegram
                      </a>
                      <a
                        href={`tel:${CONTACTS.phoneRaw}`}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                      >
                        <Phone className="h-4 w-4" />
                        Позвонить
                      </a>
                    </div>

                    <p className="mt-6 text-xs leading-relaxed text-text-muted">
                      * Расчёт носит информационный характер. Итоговая стоимость может
                      отличаться в зависимости от курса валют на дату оформления. Для
                      точного расчёта свяжитесь с менеджером.
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-text-muted">
                    <CalcIcon className="mx-auto h-12 w-12 text-border" />
                    <p className="mt-4">
                      Заполните данные и нажмите &laquo;Рассчитать стоимость&raquo;
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
