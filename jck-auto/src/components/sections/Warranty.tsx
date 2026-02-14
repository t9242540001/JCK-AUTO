"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ShieldCheck } from "lucide-react";

const features = [
  "Гарантия распространяется на двигатель, КПП и основные узлы",
  "Действует на всей территории Российской Федерации",
  "Оформление в течение 24 часов после получения авто",
];

const stats = [
  { value: "2 года", label: "максимальный срок" },
  { value: "Полное", label: "покрытие ремонта" },
  { value: "РФ", label: "территория действия" },
];

export default function Warranty() {
  return (
    <section id="warranty" className="bg-primary py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-secondary">
              Эксклюзив
            </span>
            <h2 className="mt-4 font-heading text-2xl font-bold text-white sm:text-3xl md:text-4xl">
              Гарантия до 2 лет от Страхового Дома ВСК
            </h2>
            <p className="mt-4 text-lg text-white/70">
              На новые автомобили из Китая доступна продлённая гарантия до 2 лет.
              Ремонт только в авторизованных СТО с оригинальными запчастями.
              Действует на всей территории РФ.
            </p>

            <ul className="mt-6 space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <span className="text-white/80">{f}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-sm text-white/60">
              Это не просто обещание — это официальный страховой полис от одной
              из крупнейших страховых компаний России
            </p>

            <Link
              href="/calculator"
              className="mt-8 block w-full rounded-xl bg-secondary px-8 py-4 text-center font-medium text-white transition-colors hover:bg-secondary-hover sm:inline-block sm:w-auto"
            >
              Рассчитать стоимость
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm sm:p-8"
          >
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                <ShieldCheck className="h-10 w-10 text-secondary" />
              </div>
            </div>
            <h3 className="mt-6 text-center font-heading text-xl font-bold text-white">
              Страховой Дом ВСК
            </h3>
            <p className="mt-2 text-center text-sm text-white/60">
              Официальный партнёр JCK AUTO
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="font-heading text-2xl font-bold text-secondary">
                    {s.value}
                  </p>
                  <p className="mt-1 text-xs text-white/60">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
