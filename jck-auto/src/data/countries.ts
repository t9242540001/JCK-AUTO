import { CONTACTS, type Country } from "@/lib/constants";

export interface CountryCard {
  accentColor: Country;
  flag: string;
  country: string;
  description: string;
  features: string[];
  specialist: (typeof CONTACTS.team)[number];
}

const getSpecialist = (country: Country) =>
  CONTACTS.team.find((m) => m.country === country)!;

export const countries: CountryCard[] = [
  {
    accentColor: "china",
    flag: "🇨🇳",
    country: "Китай",
    description:
      "Новые автомобили ведущих брендов: Changan, Haval, Geely, Chery, Li Auto и другие. Доставка автовозом через сухопутную границу.",
    features: ["Новые авто с завода", "Срок: 30-45 дней", "Гарантия ВСК до 2 лет"],
    specialist: getSpecialist("china"),
  },
  {
    accentColor: "korea",
    flag: "🇰🇷",
    country: "Южная Корея",
    description:
      "Новые и подержанные автомобили: Hyundai, Kia, Genesis, Samsung. Возврат корейского НДС для дополнительной выгоды.",
    features: ["Возврат НДС Кореи", "Срок: 35-50 дней", "Аукционы и дилеры"],
    specialist: getSpecialist("korea"),
  },
  {
    accentColor: "japan",
    flag: "🇯🇵",
    country: "Япония",
    description:
      "Легендарное японское качество: Toyota, Honda, Mazda, Subaru, Lexus. Автомобили с аукционов с прозрачной историей.",
    features: ["Аукционная история", "Срок: 35-55 дней", "Проверка на месте"],
    specialist: getSpecialist("japan"),
  },
];
