"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator } from "lucide-react";
import { CONTACTS } from "@/lib/constants";
import type { Country } from "@/lib/constants";
import { formatPhone } from "@/lib/utils";
import {
  calculate,
  formatPrice,
  type AgeCategory,
  type CalculatorResult,
} from "@/lib/calculator";

export default function CalculatorPage() {
  const [country, setCountry] = useState<Country>("china");
  const [price, setPrice] = useState("");
  const [engineVolume, setEngineVolume] = useState("");
  const [power, setPower] = useState("");
  const [age, setAge] = useState<AgeCategory>("new");
  const [result, setResult] = useState<CalculatorResult | null>(null);

  function handleCalculate() {
    const priceNum = Number(price);
    const volumeNum = Number(engineVolume);
    const powerNum = Number(power);
    if (!priceNum || !volumeNum || !powerNum) return;

    setResult(
      calculate({
        country,
        price: priceNum,
        engineVolume: volumeNum,
        power: powerNum,
        age,
      })
    );
  }

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 },
  };

  return (
    <>
      <head>
        <title>Калькулятор стоимости | JCK AUTO</title>
        <meta
          name="description"
          content="Рассчитайте приблизительную стоимость импорта автомобиля из Китая, Кореи или Японии «под ключ»"
        />
      </head>

      <div className="min-h-screen bg-white pt-28 pb-20">
        {/* Header */}
        <motion.div
          className="mx-auto max-w-3xl px-4 text-center"
          {...fadeInUp}
        >
          <p className="text-sm font-medium uppercase tracking-wider text-secondary">
            КАЛЬКУЛЯТОР СТОИМОСТИ
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold text-text md:text-4xl lg:text-5xl">
            Сколько стоит привезти автомобиль?
          </h1>
          <p className="mt-4 text-lg text-text-muted">
            Введите параметры автомобиля и получите приблизительную оценку всех
            расходов «под ключ»
          </p>
        </motion.div>

        {/* Main block */}
        <motion.div
          className="mx-auto mt-12 max-w-5xl px-4"
          {...fadeInUp}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="rounded-2xl border border-border bg-surface p-6 md:p-10">
            <div className="grid gap-10 md:grid-cols-2">
              {/* Left — form */}
              <div className="space-y-5">
                <h3 className="mb-1 text-lg font-semibold text-text">
                  Параметры автомобиля
                </h3>

                {/* Country */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Страна
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value as Country)}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="china">🇨🇳 Китай</option>
                    <option value="korea">🇰🇷 Южная Корея</option>
                    <option value="japan">🇯🇵 Япония</option>
                  </select>
                </div>

                {/* Price */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Стоимость автомобиля
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="2 000 000"
                      className="w-full rounded-xl border border-border bg-white px-4 py-3 pr-10 text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                      ₽
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    Цена авто в стране покупки в рублях
                  </p>
                </div>

                {/* Engine volume */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Объём двигателя
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={engineVolume}
                      onChange={(e) => setEngineVolume(e.target.value)}
                      placeholder="1500"
                      className="w-full rounded-xl border border-border bg-white px-4 py-3 pr-20 text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                      куб.см
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    Рабочий объём в кубических сантиметрах
                  </p>
                </div>

                {/* Power */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Мощность двигателя
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={power}
                      onChange={(e) => setPower(e.target.value)}
                      placeholder="150"
                      className="w-full rounded-xl border border-border bg-white px-4 py-3 pr-14 text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                      л.с.
                    </span>
                  </div>
                </div>

                {/* Age */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Возраст автомобиля
                  </label>
                  <select
                    value={age}
                    onChange={(e) => setAge(e.target.value as AgeCategory)}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="new">Новый (до 1 года)</option>
                    <option value="1-3">1-3 года</option>
                    <option value="3-5">3-5 лет</option>
                    <option value="5+">Более 5 лет</option>
                  </select>
                </div>

                {/* Submit */}
                <button
                  onClick={handleCalculate}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3.5 text-lg font-medium text-white transition-colors hover:bg-secondary-hover"
                >
                  <Calculator size={20} />
                  Рассчитать стоимость
                </button>
              </div>

              {/* Right — result */}
              <div>
                {!result ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Calculator size={48} className="text-text-muted/30" />
                    <p className="mt-4 text-text-muted">
                      Заполните параметры и нажмите «Рассчитать»
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      Мы покажем примерную стоимость всех расходов
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold text-text">
                      Расчёт стоимости
                    </h3>

                    <div className="mt-4 space-y-0">
                      <div className="flex justify-between border-b border-border py-3.5">
                        <span className="text-text-muted">
                          Стоимость автомобиля
                        </span>
                        <span className="font-medium text-text">
                          {formatPrice(result.carPrice)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border py-3.5">
                        <span className="text-text-muted">
                          Таможенные платежи
                        </span>
                        <span className="font-medium text-text">
                          {formatPrice(result.customs)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border py-3.5">
                        <span className="text-text-muted">
                          Утилизационный сбор
                        </span>
                        <span className="font-medium text-text">
                          {formatPrice(result.recyclingFee)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border py-3.5">
                        <span className="text-text-muted">
                          Логистика и оформление
                        </span>
                        <span className="font-medium text-text">
                          {formatPrice(result.logistics)}
                        </span>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="mt-3 border-t-2 border-primary pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-text">
                          Итого «под ключ»
                        </span>
                        <span className="text-3xl font-bold text-primary">
                          {formatPrice(result.totalPrice)}
                        </span>
                      </div>
                    </div>

                    {/* Disclaimer */}
                    <p className="mt-4 text-xs text-text-muted">
                      * Приблизительный расчёт. Итоговая стоимость зависит от
                      актуального курса валют, точных таможенных ставок и условий
                      логистики.
                    </p>

                    {/* Action buttons */}
                    <div className="mt-6 space-y-3">
                      <a
                        href={CONTACTS.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full rounded-xl bg-secondary py-3 text-center font-medium text-white transition-colors hover:bg-secondary-hover"
                      >
                        Получить точный расчёт
                      </a>
                      <a
                        href={`tel:${formatPhone(CONTACTS.team[0].phone)}`}
                        className="block w-full rounded-xl border-2 border-primary py-3 text-center font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                      >
                        Позвонить специалисту
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
