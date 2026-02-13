"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator as CalcIcon, Phone } from "lucide-react";
import {
  calculateTotal,
  formatPrice,
  type CalcInput,
  type CalcResult,
} from "@/lib/calculator";
import { CONTACTS, type Country } from "@/lib/constants";

const countryOptions = [
  { value: "china" as Country, label: "🇨🇳 Китай" },
  { value: "korea" as Country, label: "🇰🇷 Южная Корея" },
  { value: "japan" as Country, label: "🇯🇵 Япония" },
];

const ageOptions: { value: CalcInput["carAge"]; label: string }[] = [
  { value: "new", label: "Новый" },
  { value: "1-3", label: "1-3 года" },
  { value: "3-5", label: "3-5 лет" },
  { value: "5+", label: "Более 5 лет" },
];

export default function CalculatorPage() {
  const [country, setCountry] = useState<Country>("china");
  const [carPrice, setCarPrice] = useState("");
  const [engineVolume, setEngineVolume] = useState("");
  const [enginePower, setEnginePower] = useState("");
  const [carAge, setCarAge] = useState<CalcInput["carAge"]>("new");
  const [result, setResult] = useState<CalcResult | null>(null);

  const andrey = CONTACTS.team[0];

  const handleCalculate = () => {
    const price = Number(carPrice);
    const volume = Number(engineVolume);
    const power = Number(enginePower);
    if (!price || !volume || !power) return;

    setResult(
      calculateTotal({ country, carPrice: price, engineVolume: volume, enginePower: power, carAge })
    );
  };

  const resultRows = result
    ? [
        { label: "Стоимость авто", value: result.carPrice },
        { label: "Таможенные платежи", value: result.customsPayments },
        { label: "Утилизационный сбор", value: result.recyclingFee },
        { label: "Логистика", value: result.logistics },
      ]
    : [];

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
        <h1 className="mt-2 font-heading text-3xl font-bold text-text md:text-4xl lg:text-5xl">
          Сколько стоит привезти автомобиль?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
          Введите параметры и получите приблизительную оценку всех расходов
          &laquo;под ключ&raquo;
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-auto mt-12 max-w-5xl px-4"
      >
        <div className="rounded-2xl border border-border bg-surface p-6 md:p-10">
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
                  onChange={(e) => setCountry(e.target.value as Country)}
                  className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {countryOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-text">
                  Стоимость автомобиля
                </label>
                <input
                  type="number"
                  value={carPrice}
                  onChange={(e) => setCarPrice(e.target.value)}
                  placeholder="2 000 000"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-text-muted">
                  Цена в стране покупки в рублях
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-text">
                  Объём двигателя
                </label>
                <input
                  type="number"
                  value={engineVolume}
                  onChange={(e) => setEngineVolume(e.target.value)}
                  placeholder="1500"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-text-muted">куб.см</p>
              </div>

              <div>
                <label className="text-sm font-medium text-text">
                  Мощность
                </label>
                <input
                  type="number"
                  value={enginePower}
                  onChange={(e) => setEnginePower(e.target.value)}
                  placeholder="150"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-text-muted">л.с.</p>
              </div>

              <div>
                <label className="text-sm font-medium text-text">
                  Возраст авто
                </label>
                <select
                  value={carAge}
                  onChange={(e) =>
                    setCarAge(e.target.value as CalcInput["carAge"])
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {ageOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
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
                  {resultRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between border-b border-border py-3.5"
                    >
                      <span className="text-sm text-text-muted">
                        {row.label}
                      </span>
                      <span className="text-sm font-medium text-text">
                        {formatPrice(row.value)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-6 flex items-center justify-between">
                    <span className="font-heading text-lg font-bold text-text">
                      Итого &laquo;под ключ&raquo;
                    </span>
                    <span className="font-heading text-3xl font-bold text-primary">
                      {formatPrice(result.totalPrice)}
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-text-muted">
                    * Приблизительный расчёт. Точную стоимость уточняйте у
                    специалиста.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <a
                      href={CONTACTS.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-xl bg-secondary px-6 py-3 text-center font-medium text-white transition-colors hover:bg-secondary-hover"
                    >
                      Получить точный расчёт
                    </a>
                    <a
                      href={`tel:${andrey.phone.replace(/\s|\(|\)|-/g, "")}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary px-6 py-3 font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                    >
                      <Phone className="h-4 w-4" />
                      Позвонить специалисту
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center text-text-muted">
                  <CalcIcon className="mx-auto h-12 w-12 text-border" />
                  <p className="mt-4">
                    Заполните параметры и нажмите
                    &laquo;Рассчитать стоимость&raquo;
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
