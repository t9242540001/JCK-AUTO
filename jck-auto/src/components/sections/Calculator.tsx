"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator as CalcIcon } from "lucide-react";
import {
  calculateTotal,
  formatPrice,
  type CalcInput,
  type CalcResult,
} from "@/lib/calculator";
import { type Country } from "@/lib/constants";

const countryOptions: { value: Country; label: string }[] = [
  { value: "china", label: "Китай" },
  { value: "korea", label: "Южная Корея" },
  { value: "japan", label: "Япония" },
];

const ageOptions: { value: CalcInput["carAge"]; label: string }[] = [
  { value: "new", label: "Новый" },
  { value: "1-3", label: "1-3 года" },
  { value: "3-5", label: "3-5 лет" },
  { value: "5+", label: "Более 5 лет" },
];

export default function Calculator() {
  const [country, setCountry] = useState<Country>("china");
  const [carPrice, setCarPrice] = useState("");
  const [engineVolume, setEngineVolume] = useState("");
  const [enginePower, setEnginePower] = useState("");
  const [carAge, setCarAge] = useState<CalcInput["carAge"]>("new");
  const [result, setResult] = useState<CalcResult | null>(null);

  const handleCalculate = () => {
    const price = Number(carPrice);
    const volume = Number(engineVolume);
    const power = Number(enginePower);

    if (!price || !volume || !power) return;

    setResult(
      calculateTotal({
        country,
        carPrice: price,
        engineVolume: volume,
        enginePower: power,
        carAge,
      })
    );
  };

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
          className="mx-auto mt-12 max-w-4xl rounded-2xl border border-border bg-surface p-6 md:p-8"
        >
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
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
                  Стоимость авто, ₽
                </label>
                <input
                  type="number"
                  value={carPrice}
                  onChange={(e) => setCarPrice(e.target.value)}
                  placeholder="2 000 000"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text">
                  Объём двигателя, см³
                </label>
                <input
                  type="number"
                  value={engineVolume}
                  onChange={(e) => setEngineVolume(e.target.value)}
                  placeholder="1500"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text">
                  Мощность, л.с.
                </label>
                <input
                  type="number"
                  value={enginePower}
                  onChange={(e) => setEnginePower(e.target.value)}
                  placeholder="150"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
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
                className="w-full rounded-xl bg-secondary px-6 py-3.5 font-medium text-white transition-colors hover:bg-secondary-hover"
              >
                Рассчитать
              </button>
            </div>

            <div className="flex flex-col items-center justify-center">
              {result ? (
                <div className="w-full space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Стоимость авто</span>
                    <span className="font-medium text-text">
                      {formatPrice(result.carPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">
                      Таможенные платежи
                    </span>
                    <span className="font-medium text-text">
                      {formatPrice(result.customsPayments)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Утилизационный сбор</span>
                    <span className="font-medium text-text">
                      {formatPrice(result.recyclingFee)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Логистика</span>
                    <span className="font-medium text-text">
                      {formatPrice(result.logistics)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between">
                      <span className="font-heading text-lg font-bold text-text">
                        Итого &laquo;под ключ&raquo;
                      </span>
                      <span className="font-heading text-lg font-bold text-primary">
                        {formatPrice(result.totalPrice)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted">
                    * Приблизительный расчёт. Точную стоимость уточняйте у
                    менеджера.
                  </p>
                </div>
              ) : (
                <div className="text-center text-text-muted">
                  <CalcIcon className="mx-auto h-12 w-12 text-border" />
                  <p className="mt-4 text-sm">
                    Заполните параметры и нажмите &laquo;Рассчитать&raquo;
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
