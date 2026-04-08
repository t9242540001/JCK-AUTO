import {
  DELIVERY_CITIES,
  DELIVERY_DISCLAIMER,
  DELIVERY_NOTE,
} from "@/lib/deliveryConfig";

export default function NoscutDelivery() {
  return (
    <section className="mt-12">
      <h2 className="font-heading text-2xl font-bold text-text">Доставка</h2>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DELIVERY_CITIES.map((city) => (
          <div
            key={city.name}
            className="rounded-xl border border-border bg-white p-4 shadow-sm"
          >
            <p className="font-heading font-bold text-text">{city.name}</p>
            <p className="mt-1 text-sm text-primary">
              от {city.priceFrom.toLocaleString("ru-RU")} ₽
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {city.daysMin}–{city.daysMax} дней
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-text-muted">{DELIVERY_NOTE}</p>
      <p className="mt-2 text-xs text-text-muted">{DELIVERY_DISCLAIMER}</p>
    </section>
  );
}
