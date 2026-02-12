export const CONTACTS = {
  company: "JCK AUTO",
  legal: "ИП Дьяченко",
  telegram: "https://t.me/jck_auto",
  youtube: "https://youtube.com/@JCK_AUTO",
  whatsappBase: "https://wa.me/",
  team: [
    {
      name: "Андрей Кулешов",
      role: "Специалист по Китаю • Основатель",
      phone: "+7 (914) 708-73-91",
      whatsapp: "79147087391",
      country: "china" as const,
      flag: "🇨🇳",
    },
    {
      name: "Вячеслав",
      role: "Специалист по Южной Корее",
      phone: "+7 (924) 009-30-98",
      whatsapp: "79240093098",
      country: "korea" as const,
      flag: "🇰🇷",
    },
    {
      name: "Борис",
      role: "Специалист по Японии",
      phone: "+7 (914) 671-85-85",
      whatsapp: "79146718585",
      country: "japan" as const,
      flag: "🇯🇵",
    },
  ],
} as const;

export type Country = "china" | "korea" | "japan";
